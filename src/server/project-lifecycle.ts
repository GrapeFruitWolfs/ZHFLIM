import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { StudioError } from '../domain/errors.js';
import type { SqliteStudioStore } from './store.js';

/** Lifecycle changes cannot overlap any request using the project's files or revisions. */
export function registerProjectLifecycle(app: FastifyInstance, store: SqliteStudioStore) {
  const active = new Map<string, number>();
  const exclusive = new Set<string>();
  const leases = new WeakMap<FastifyRequest, { id: string; exclusive: boolean }>();
  app.addHook('preHandler', async request => {
    const route = request.routeOptions.url ?? '';
    let id = (request.params as { id?: string })?.id;
    if (route === '/api/presets' && request.method === 'POST') id = (request.body as { projectId?: string })?.projectId;
    else if (!route.startsWith('/api/projects/:id')) return;
    if (typeof id !== 'string') return;
    const lifecycle = route.endsWith('/trash') || route.endsWith('/restore') || (route === '/api/projects/:id' && request.method === 'DELETE');
    if (exclusive.has(id) || (lifecycle && active.get(id))) throw new StudioError('PROJECT_BUSY', '项目正在读取、保存或导出，请稍后重试。', 409);
    if (lifecycle) exclusive.add(id);
    active.set(id, (active.get(id) ?? 0) + 1);
    leases.set(request, { id, exclusive: lifecycle });
  });
  const release = (request: FastifyRequest) => {
    const lease = leases.get(request);
    if (!lease) return;
    leases.delete(request);
    const count = (active.get(lease.id) ?? 1) - 1;
    if (count) active.set(lease.id, count); else active.delete(lease.id);
    if (lease.exclusive) exclusive.delete(lease.id);
  };
  app.addHook('onResponse', async request => { release(request); });
  // Keep leases until the handler ends even if its client disconnects: an export
  // or image conversion may still be writing files after the socket closes.
  app.addHook('onError', async request => { release(request); });
  app.addHook('onSend', async (request, reply, payload) => {
    // An aborted request may never emit onResponse. Only release once its handler
    // has finished; live file streams retain the lease until they close.
    if (payload && typeof payload === 'object' && 'once' in payload && typeof payload.once === 'function') {
      payload.once('close', () => release(request));
    } else if (reply.raw.destroyed) release(request);
    return payload;
  });
  const input = z.object({ expectedRevision: z.number().int().nonnegative() }).strict();
  app.post<{ Params: { id: string } }>('/api/projects/:id/trash', async request => store.trashProject(request.params.id, input.parse(request.body).expectedRevision));
  app.post<{ Params: { id: string } }>('/api/projects/:id/restore', async request => store.restoreProject(request.params.id, input.parse(request.body).expectedRevision));
  app.delete<{ Params: { id: string } }>('/api/projects/:id', async (request, reply) => {
    await store.purgeProject(request.params.id, input.parse(request.body).expectedRevision);
    return reply.code(204).send();
  });
}
