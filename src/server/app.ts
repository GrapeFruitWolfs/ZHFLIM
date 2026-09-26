import Fastify, { type FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import staticFiles from '@fastify/static';
import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { z } from 'zod';
import { applyPreset, cloneBlocks, createProject } from '../shared/defaults.js';
import { newId, type Preset, type ProjectRecord } from '../shared/model.js';
import { StudioError } from '../domain/errors.js';
import { preserveManualDecisions } from '../domain/recognition.js';
import { normalizeRelativePath, parseObservations, parseSettings, recognitionRuleSchema, validateProject } from '../domain/validation.js';
import { SqliteStudioStore } from './store.js';
import { registerSecurity } from './security.js';
import { acceptAssetVersion, beginImport, finalizeImport, importImage, MAX_IMAGE_BYTES } from './imports.js';
import type { ServerConfig } from './contracts.js';

const expectedRevisionSchema = z.number().int().nonnegative();
const body = (value: unknown) => z.record(z.string(), z.unknown()).parse(value);
export async function buildApp(options: Partial<ServerConfig> = {}): Promise<FastifyInstance> {
  const rootDir = resolve(options.rootDir ?? process.cwd());
  const defaultData = process.platform === 'win32' && process.env.LOCALAPPDATA ? resolve(process.env.LOCALAPPDATA, 'WeddingDeliveryStudio') : resolve(homedir(), '.local', 'share', 'wedding-delivery-studio');
  const config: ServerConfig = { dataDir: resolve(options.dataDir ?? process.env.WDS_DATA_DIR ?? defaultData), port: options.port ?? Number(process.env.WDS_PORT ?? 4318), host: options.host ?? '127.0.0.1', rootDir, testing: options.testing };
  if (!['127.0.0.1', '::1'].includes(config.host) || !Number.isInteger(config.port) || config.port < 0 || config.port > 65535) throw new StudioError('INVALID_SERVER_CONFIG', '本机服务必须监听 loopback 地址和有效端口。');
  const app = Fastify({ logger: !config.testing, bodyLimit: 48 * 1024 * 1024, requestTimeout: 120000 });
  const store = new SqliteStudioStore(config.dataDir);
  app.addHook('onClose', async () => store.close());
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof z.ZodError) { reply.status(400).send({ code: 'VALIDATION_ERROR', message: '输入资料格式有误，请检查字段。', details: error.issues.slice(0, 20).map(issue => ({ path: issue.path.join('.'), message: issue.message })) }); return; }
    if (error instanceof StudioError) { reply.status(error.statusCode).send({ code: error.code, message: error.message }); return; }
    const known = error as { statusCode?: number; code?: string };
    if (known.statusCode && known.statusCode >= 400 && known.statusCode < 500) { reply.status(known.statusCode).send({ code: known.code ?? 'REQUEST_ERROR', message: known.statusCode === 413 ? '上传文件超过允许大小。' : '请求无法处理，请检查输入后重试。' }); return; }
    request.log.error(error);
    reply.status(500).send({ code: 'INTERNAL_ERROR', message: '操作未完成，已保存的资料不受影响。请重试或查看本机日志。' });
  });
  const issueSession = registerSecurity(app, config);
  await app.register(multipart, { limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 4, fieldSize: 4000, parts: 5 } });
  app.get('/api/health', async () => ({ app: 'wedding-delivery-studio', version: '0.1.0' }));
  app.get('/api/session', async (request, reply) => ({ token: issueSession(request, reply), settings: store.getSettings() }));
  app.get('/api/settings', async () => store.getSettings());
  app.put('/api/settings', async request => store.saveSettings(parseSettings(body(request.body).settings)));
  app.get('/api/projects', async () => store.listProjects());
  app.post('/api/projects', async request => {
    const input = z.object({ title: z.string().trim().max(200).default(''), presetId: z.string().max(128).optional() }).strict().parse(request.body);
    const preset = input.presetId ? store.listPresets().find(item => item.id === input.presetId) : undefined;
    if (input.presetId && !preset) throw new StudioError('PRESET_NOT_FOUND', '方案不存在。', 404);
    return store.saveProject(createProject({ ...input, settings: store.getSettings(), preset }), 0);
  });
  app.get<{ Params: { id: string } }>('/api/projects/:id', async request => store.getProject(request.params.id));
  app.put<{ Params: { id: string } }>('/api/projects/:id', async request => {
    const input = body(request.body);
    const previous = store.getProject(request.params.id);
    const project = validateProject(input.project, store.getSettings().tenantId);
    const expectedRevision = expectedRevisionSchema.parse(input.expectedRevision);
    if (project.id !== previous.id || project.document.id !== previous.document.id || project.clientId !== previous.clientId || project.createdAt !== previous.createdAt) throw new StudioError('IMMUTABLE_IDENTITY', '项目身份和创建记录不可修改。');
    if (!isDeepStrictEqual(project.assets, previous.assets) || !isDeepStrictEqual(project.importRoots, previous.importRoots) || !isDeepStrictEqual(project.importReports, previous.importReports)) throw new StudioError('MANAGED_METADATA', '素材与导入记录由服务管理，请重新载入项目后保存。', 409);
    preserveManualDecisions(previous, project);
    return store.saveProject(project, expectedRevision);
  });
  app.post<{ Params: { id: string } }>('/api/projects/:id/duplicate', async request => {
    const original = store.getProject(request.params.id);
    const fresh = createProject({ title: `${original.title} · 副本`, settings: store.getSettings() });
    fresh.document.blocks = cloneBlocks(original.document.blocks, true);
    fresh.document.templateId = original.document.templateId;
    fresh.document.comparisonLayout = original.document.comparisonLayout;
    fresh.document.output = structuredClone(original.document.output);
    return store.saveProject(fresh, 0);
  });
  app.get('/api/presets', async () => store.listPresets());
  app.post('/api/presets', async request => {
    const input = z.object({ projectId: z.string(), name: z.string().trim().min(1).max(100) }).strict().parse(request.body);
    const project = store.getProject(input.projectId);
    const preset: Preset = { id: newId(), version: 1, name: input.name, description: '从项目保存的可编辑交付方案；不包含客户资料、链接或项目图片。', builtin: false, blocks: cloneBlocks(project.document.blocks, true), templateId: project.document.templateId, comparisonLayout: project.document.comparisonLayout };
    store.putRecord('preset', preset.id, preset);
    return preset;
  });
  app.post<{ Params: { id: string } }>('/api/projects/:id/apply-preset', async request => {
    const input = z.object({ presetId: z.string(), expectedRevision: expectedRevisionSchema }).strict().parse(request.body);
    const project = store.getProject(request.params.id);
    const preset = store.listPresets().find(item => item.id === input.presetId);
    if (!preset) throw new StudioError('PRESET_NOT_FOUND', '方案不存在。', 404);
    const next = applyPreset(project, preset);
    preserveManualDecisions(project, next);
    return store.saveProject(next, input.expectedRevision);
  });
  app.post<{ Params: { id: string } }>('/api/projects/:id/imports', async request => {
    const input = body(request.body);
    return beginImport(store, request.params.id, { rootId: z.string().max(128).optional().parse(input.rootId), label: z.string().max(200).parse(input.label), rule: recognitionRuleSchema.parse(input.rule), files: parseObservations(input.files), includeUnclassifiedImages: z.boolean().optional().parse(input.includeUnclassifiedImages) });
  });
  app.post<{ Params: { id: string } }>('/api/projects/:id/assets', async request => {
    let rootId = ''; let relativePath = ''; let importId: string | undefined; let bytes: Buffer | undefined;
    for await (const part of request.parts()) {
      if (part.type === 'file') { if (part.fieldname !== 'file') throw new StudioError('FILE_FIELD', '图片上传字段无效。'); bytes = await part.toBuffer(); if (part.file.truncated) throw new StudioError('IMAGE_TOO_LARGE', '图片超过 40 MiB。', 413); }
      else if (part.fieldname === 'rootId') rootId = String(part.value);
      else if (part.fieldname === 'relativePath') relativePath = String(part.value);
      else if (part.fieldname === 'importId') importId = z.string().min(1).max(128).parse(part.value);
    }
    if (!bytes || !rootId || !relativePath) throw new StudioError('MISSING_UPLOAD', '请提供素材来源、相对路径和图片文件。');
    return importImage(store, request.params.id, rootId, normalizeRelativePath(relativePath), bytes, importId);
  });
  app.post<{ Params: { id: string; rootId: string } }>('/api/projects/:id/imports/:rootId/finalize', async request => {
    const input = z.object({ cancelled: z.boolean().optional(), importId: z.string().min(1).max(128).optional() }).strict().parse(request.body ?? {});
    return finalizeImport(store, request.params.id, request.params.rootId, input.cancelled, input.importId);
  });
  app.get<{ Params: { id: string; versionId: string } }>('/api/projects/:id/assets/:versionId', async (request, reply) => {
    const { path } = store.assetPath(request.params.id, request.params.versionId);
    try { await stat(path); } catch { throw new StudioError('ASSET_MISSING', '图片管理副本缺失，请重新导入或恢复备份。', 404); }
    return reply.type('image/png').send(createReadStream(path));
  });
  app.post<{ Params: { id: string; assetId: string } }>('/api/projects/:id/assets/:assetId/accept-version', async request => {
    const input = z.object({ versionId: z.string(), expectedRevision: expectedRevisionSchema }).strict().parse(request.body);
    return acceptAssetVersion(store, request.params.id, request.params.assetId, input.versionId, input.expectedRevision);
  });
  const { registerExportRoutes } = await import('./export-service.js');
  await registerExportRoutes(app, store, config);
  const dist = resolve(rootDir, 'dist');
  if (existsSync(resolve(dist, 'index.html'))) {
    await app.register(staticFiles, { root: dist, prefix: '/', index: ['index.html'], list: false });
    app.setNotFoundHandler((request, reply) => request.url.startsWith('/api/') ? reply.code(404).send({ code: 'NOT_FOUND', message: '接口不存在。' }) : reply.sendFile('index.html'));
  } else {
    const fonts = resolve(rootDir, 'public', 'fonts');
    if (existsSync(fonts)) await app.register(staticFiles, { root: fonts, prefix: '/fonts/', list: false });
    app.get('/', async (_request, reply) => reply.type('text/html').send('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>Wedding Delivery Studio</title><p>本机服务已启动。开发时请在浏览器打开 http://127.0.0.1:5173；正式使用前请运行构建。</p></html>'));
  }
  return app;
}
