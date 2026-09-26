import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { StudioError } from '../domain/errors.js';
import type { ServerConfig } from './contracts.js';

interface Session { token: string; expiresAt: number }
const cookieName = 'wds_session';
function cookie(request: FastifyRequest) { return request.headers.cookie?.split(';').map(value => value.trim()).find(value => value.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1); }
export function registerSecurity(app: FastifyInstance, config: ServerConfig) {
  const sessions = new Map<string, Session>();
  const allowedHosts = new Set(['127.0.0.1', 'localhost', '[::1]']);
  app.addHook('onRequest', async (request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('X-Frame-Options', 'SAMEORIGIN');
    const host = request.headers.host;
    let parsed: URL;
    try { parsed = new URL(`http://${host ?? ''}`); } catch { throw new StudioError('INVALID_HOST', '仅允许从本机地址访问工作台。', 403); }
    if (!host || !/^(localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/i.test(host) || !allowedHosts.has(parsed.hostname) || parsed.username || parsed.password || parsed.pathname !== '/') throw new StudioError('INVALID_HOST', '仅允许从本机地址访问工作台。', 403);
    const origin = request.headers.origin;
    if (origin) {
      let source: URL;
      try { source = new URL(origin); } catch { throw new StudioError('INVALID_ORIGIN', '请求来源无效。', 403); }
      const port = source.port || '80';
      const devOrigin = process.env.NODE_ENV !== 'production' && port === '5173';
      if (source.protocol !== 'http:' || !allowedHosts.has(source.hostname) || (port !== String(config.port) && !devOrigin)) throw new StudioError('INVALID_ORIGIN', '此来源无权访问本机工作台。', 403);
    }
    if (request.headers['sec-fetch-site'] === 'cross-site') throw new StudioError('CROSS_SITE_REQUEST', '已拒绝跨站请求。', 403);
    if (!request.url.startsWith('/api/')) return;
    reply.header('Cache-Control', 'no-store');
    if (request.method === 'GET' && ['/api/session', '/api/health'].includes(request.url.split('?')[0])) return;
    const session = sessions.get(cookie(request) ?? '');
    if (!session || session.expiresAt < Date.now()) throw new StudioError('SESSION_REQUIRED', '本机会话已失效，请刷新工作台。', 401);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      const token = request.headers['x-studio-token'];
      if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token) || !timingSafeEqual(Buffer.from(token), Buffer.from(session.token))) throw new StudioError('CSRF_TOKEN', '会话校验失败，请刷新工作台后重试。', 403);
    }
  });
  return (request: FastifyRequest, reply: { header(name: string, value: string): unknown }): string => {
    const existingId = cookie(request);
    const existing = sessions.get(existingId ?? '');
    if (existing && existing.expiresAt > Date.now()) return existing.token;
    for (const [id, session] of sessions) if (session.expiresAt < Date.now()) sessions.delete(id);
    if (sessions.size > 1000) sessions.delete(sessions.keys().next().value!);
    const sessionId = randomBytes(32).toString('hex');
    const token = randomBytes(32).toString('hex');
    sessions.set(sessionId, { token, expiresAt: Date.now() + 24 * 60 * 60 * 1000 });
    reply.header('Set-Cookie', `${cookieName}=${sessionId}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`);
    return token;
  };
}
