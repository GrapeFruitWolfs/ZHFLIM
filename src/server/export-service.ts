import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { Browser } from 'playwright';
import type { Artifact, ExportRecord, Issue, OutputSettings, OutputTarget, PreviewCandidate, ProjectRecord, TargetResult } from '../shared/model.js';
import { outputTargets } from '../shared/model.js';
import { StudioError } from '../domain/errors.js';
import type { ServerConfig, StudioStore } from './contracts.js';
import { candidateIsStale, digest, escapeHtml, loadFonts, makeIssue, prepareDisplay, resolvedDeliveryDate, settingsFingerprint, verifyAssets, RENDER_BUDGET, type AssetDependency } from '../rendering/display.js';
import { renderHtml } from '../rendering/html.js';
import { checkGlyphCoverage } from '../rendering/fonts.js';
import { RenderFailure, renderShareCard, renderTarget, startRenderer, type EngineDependencies, type RenderedFile } from '../rendering/engine.js';

interface StoredArtifact { tenantId: string; projectId: string; candidateId: string; artifact: Artifact; relativePath: string }
interface StoredCandidate {
  candidate: PreviewCandidate; tenantId: string; snapshot: ProjectRecord; settingsHash: string; snapshotHash: string;
  assets: AssetDependency[]; sources: Partial<Record<OutputTarget, { relativePath: string; hash: string }>>;
  dependencies: { fonts: Record<string, string>; engine?: EngineDependencies }; exportId?: string;
}
interface StoredExport { record: ExportRecord; tenantId: string; frozen: StoredCandidate }

const expectedRevision = z.number().int().nonnegative();
const targetSchema = z.enum(['pdf', 'image']);
const knownTargetError = (error: unknown, target: OutputTarget): { result: TargetResult; issue: Issue } => {
  const controlled = error instanceof RenderFailure;
  const message = controlled ? error.message : '生成未完成，请检查本机磁盘空间与渲染环境后重试；已完成产物不受影响。';
  return {
    result: { target, status: controlled ? 'blocked' : 'failed', error: message, artifacts: [] },
    issue: makeIssue(controlled ? error.code : 'RENDER_FAILED', message, 'error', target, controlled ? { blockId: error.blockId, comparisonId: error.comparisonId } : {}),
  };
};

function recordStatus(results: TargetResult[]): ExportRecord['status'] {
  return results.every(result => result.status === 'success') ? 'success' : results.some(result => result.status === 'success') ? 'partial' : 'failed';
}

export async function registerExportRoutes(app: FastifyInstance, store: StudioStore, config: ServerConfig): Promise<void> {
  const exportRoot = path.resolve(config.dataDir, 'exports');
  await mkdir(exportRoot, { recursive: true });
  const activeBrowsers = new Set<Browser>();
  const activeRetries = new Set<string>();
  let queue: Promise<unknown> = Promise.resolve();
  const serialized = <T>(work: () => Promise<T>): Promise<T> => {
    const next = queue.then(work, work); queue = next.catch(() => undefined); return next;
  };
  app.addHook('onClose', async () => { await Promise.all([...activeBrowsers].map(browser => browser.close())); });

  function resourcePath(relativePath: string): string {
    const result = path.resolve(exportRoot, relativePath);
    if (!result.startsWith(`${exportRoot}${path.sep}`)) throw new StudioError('RESOURCE_SCOPE', '导出资源不在允许的目录中。', 403);
    return result;
  }
  function project(id: string): ProjectRecord {
    const value = store.getProject(id);
    if (value.tenantId !== store.getSettings().tenantId) throw new StudioError('PROJECT_NOT_FOUND', '项目不存在。', 404);
    return value;
  }
  function ownedCandidate(projectId: string, candidateId: string): StoredCandidate {
    const current = project(projectId);
    const value = store.getRecord<StoredCandidate>('candidate', candidateId);
    if (!value || value.candidate.projectId !== current.id || value.tenantId !== current.tenantId) throw new StudioError('CANDIDATE_NOT_FOUND', '正式预览不存在，请重新生成。', 404);
    return value;
  }
  function ownedExport(projectId: string, exportId: string): StoredExport {
    const current = project(projectId);
    const value = store.getRecord<StoredExport>('export', exportId);
    if (!value || value.record.projectId !== current.id || value.tenantId !== current.tenantId) throw new StudioError('EXPORT_NOT_FOUND', '导出记录不存在。', 404);
    return value;
  }
  function registerArtifacts(files: RenderedFile[], target: OutputTarget, stored: StoredCandidate): Artifact[] {
    return files.map(file => {
      const id = randomUUID();
      const artifact: Artifact = {
        id, target, filename: file.filename, mime: file.mime, byteSize: file.byteSize, hash: file.hash,
        ...(file.width !== undefined ? { width: file.width } : {}), ...(file.height !== undefined ? { height: file.height } : {}), ...(file.pages !== undefined ? { pages: file.pages } : {}),
        ...(file.role !== undefined ? { role: file.role } : {}),
        url: `/api/projects/${stored.candidate.projectId}/artifacts/${id}`,
      };
      store.putRecord<StoredArtifact>('artifact', id, { tenantId: stored.tenantId, projectId: stored.candidate.projectId, candidateId: stored.candidate.id, artifact, relativePath: path.relative(exportRoot, file.path) });
      return artifact;
    });
  }
  /** Long-image segments first (unchanged order), then the optional share card. */
  async function renderOutput(browser: Browser, html: string, target: OutputTarget, settings: OutputSettings, directory: string): Promise<RenderedFile[]> {
    const files = await renderTarget(browser, html, target, settings, directory);
    if (target !== 'image') return files;
    const share = await renderShareCard(browser, html, directory);
    return share ? [...files, share] : files;
  }
  async function artifactBytes(projectId: string, artifact: Artifact): Promise<Buffer> {
    const value = store.getRecord<StoredArtifact>('artifact', artifact.id);
    if (!value || value.projectId !== projectId || value.tenantId !== store.getSettings().tenantId) throw new StudioError('ARTIFACT_NOT_FOUND', '导出文件不存在。', 404);
    try {
      const bytes = await readFile(resourcePath(value.relativePath));
      if (bytes.length !== artifact.byteSize || digest(bytes) !== artifact.hash) throw new Error('checksum');
      return bytes;
    } catch { throw new StudioError('ARTIFACT_UNAVAILABLE', '导出文件缺失或已变化，请恢复文件或重试该目标。', 409); }
  }
  async function createCandidate(projectId: string, revision: number): Promise<PreviewCandidate> {
    const current = project(projectId);
    if (current.draftRevision !== revision) throw new StudioError('REVISION_CONFLICT', '项目已在另一处更新，请保存当前修改并重新载入后预览。', 409);
    const snapshot = structuredClone(current);
    const settings = store.getSettings();
    const date = resolvedDeliveryDate(snapshot.document, settings.timezone);
    const prepared = await prepareDisplay(snapshot, store, date);
    const fonts = await loadFonts(config.rootDir);
    const glyphIssues = await checkGlyphCoverage(prepared.display, config.rootDir);
    const id = randomUUID();
    const candidate: PreviewCandidate = {
      id, projectId, draftRevision: revision, createdAt: new Date().toISOString(), resolvedDate: date, timezone: settings.timezone,
      targets: outputTargets(snapshot.document.output.mode), issues: [...prepared.issues, ...fonts.issues, ...glyphIssues], results: [], previewUrls: {},
    };
    const stored: StoredCandidate = { candidate, tenantId: snapshot.tenantId, snapshot, settingsHash: settingsFingerprint(settings), snapshotHash: digest(JSON.stringify(snapshot)), assets: prepared.assets, sources: {}, dependencies: { fonts: fonts.hashes } };
    store.putRecord('candidate', id, stored);
    let browser: Browser | undefined;
    try {
      for (const target of candidate.targets) {
        try {
          const directory = resourcePath(`${projectId}/${id}/${target}`);
          const sourceFile = path.join(directory, 'source.html');
          const html = renderHtml(prepared.display, target, fonts);
          if (Buffer.byteLength(html, 'utf8') > RENDER_BUDGET.htmlBytes) throw new RenderFailure('RESOURCE_BUDGET', '本次渲染内容超过 96MiB 工作预算，请减少可见图片或分为不同文档。');
          await mkdir(directory, { recursive: true });
          await writeFile(sourceFile, html, { flag: 'wx' });
          stored.sources[target] = { relativePath: path.relative(exportRoot, sourceFile), hash: digest(html) };
          const blockers = candidate.issues.filter(issue => issue.severity === 'error' && (issue.scope === 'all' || issue.scope === target));
          if (blockers.length) { candidate.results.push({ target, status: 'blocked', error: blockers.map(issue => issue.message).join('；'), artifacts: [] }); continue; }
          if (!browser) {
            const started = await startRenderer(); browser = started.browser; stored.dependencies.engine = started.dependencies; activeBrowsers.add(browser);
          }
          candidate.results.push({ target, status: 'running', artifacts: [] });
          store.putRecord('candidate', id, stored);
          const files = await renderOutput(browser, html, target, snapshot.document.output, directory);
          const artifacts = registerArtifacts(files, target, stored);
          candidate.results[candidate.results.findIndex(result => result.target === target)] = { target, status: 'ready', artifacts };
          candidate.previewUrls[target] = target === 'pdf' ? artifacts[0].url : `/api/projects/${projectId}/candidates/${id}/preview/image`;
        } catch (error) {
          app.log.error({ err: error, target, candidateId: id }, 'Rendering failed');
          const failure = knownTargetError(error, target);
          const index = candidate.results.findIndex(result => result.target === target);
          if (index >= 0) candidate.results[index] = failure.result; else candidate.results.push(failure.result);
          candidate.issues.push(failure.issue);
        }
        store.putRecord('candidate', id, stored);
      }
    } finally {
      if (browser) { activeBrowsers.delete(browser); await browser.close(); }
      store.putRecord('candidate', id, stored);
    }
    return candidate;
  }

  app.get<{ Params: { id: string }; Querystring: { target?: string } }>('/api/projects/:id/preview', async (request, reply) => {
    const current = project(request.params.id);
    const target = targetSchema.parse(request.query.target ?? 'pdf');
    const prepared = await prepareDisplay(current, store, resolvedDeliveryDate(current.document, store.getSettings().timezone));
    const fonts = await loadFonts(config.rootDir, false);
    return reply.header('Cache-Control', 'no-store').type('text/html; charset=utf-8').send(renderHtml(prepared.display, target, fonts));
  });
  app.post<{ Params: { id: string } }>('/api/projects/:id/candidates', async request => {
    const input = z.object({ expectedRevision }).strict().parse(request.body);
    return serialized(() => createCandidate(request.params.id, input.expectedRevision));
  });
  app.post<{ Params: { id: string } }>('/api/projects/:id/exports', async request => {
    const input = z.object({ candidateId: z.string().uuid(), expectedRevision, acknowledgeWarnings: z.boolean().default(false), allowPartial: z.boolean().default(false) }).strict().parse(request.body);
    const stored = ownedCandidate(request.params.id, input.candidateId);
    let current = project(request.params.id);
    const assertCurrent = () => {
      current = project(request.params.id);
      if (input.expectedRevision !== current.draftRevision || candidateIsStale({ ...stored.candidate, settingsHash: stored.settingsHash }, current, store.getSettings()) || digest(JSON.stringify(stored.snapshot)) !== stored.snapshotHash) throw new StudioError('CANDIDATE_STALE', '内容、日期或设置已变化，请重新生成正式预览后导出。', 409);
    };
    assertCurrent();
    try { await verifyAssets(stored.snapshot, store, stored.assets); } catch { throw new StudioError('CANDIDATE_ASSETS_CHANGED', '预览使用的图片管理副本缺失或已变化，请检查素材并重新预览。', 409); }
    const results = structuredClone(stored.candidate.results);
    for (const result of results) {
      if (result.status !== 'ready') continue;
      try { for (const artifact of result.artifacts) await artifactBytes(current.id, artifact); result.status = 'success'; }
      catch { result.status = 'failed'; result.error = '正式预览产物缺失或已变化，请重新生成预览。'; }
    }
    if (!results.some(result => result.status === 'success')) throw new StudioError('NO_READY_OUTPUT', '没有可交付的产物，请处理正式预览中的问题。', 422);
    if (results.some(result => result.status !== 'success') && !input.allowPartial) throw new StudioError('PARTIAL_REQUIRES_ACK', '部分输出尚未完成；请修复问题，或明确选择先保存可用产物。', 409);
    if (stored.candidate.issues.some(issue => issue.severity === 'warning') && !input.acknowledgeWarnings) throw new StudioError('WARNINGS_REQUIRE_ACK', '请检查并确认正式预览中的提醒后再导出。', 409);
    assertCurrent(); // No await between this optimistic revision check and the synchronous durable write.
    const latestCandidate = ownedCandidate(current.id, stored.candidate.id);
    if (latestCandidate.exportId) return ownedExport(current.id, latestCandidate.exportId).record;
    const recovered = store.listRecords<StoredExport>('export').find(item => item.tenantId === current.tenantId && item.record.projectId === current.id && item.record.candidateId === stored.candidate.id);
    if (recovered) {
      stored.exportId = recovered.record.id; store.putRecord('candidate', stored.candidate.id, stored);
      return recovered.record;
    }
    const record: ExportRecord = { id: randomUUID(), projectId: current.id, candidateId: stored.candidate.id, draftRevision: stored.candidate.draftRevision, createdAt: new Date().toISOString(), resolvedDate: stored.candidate.resolvedDate, status: recordStatus(results), results };
    store.putRecord<StoredExport>('export', record.id, { record, tenantId: current.tenantId, frozen: structuredClone(stored) });
    stored.exportId = record.id; store.putRecord('candidate', stored.candidate.id, stored);
    return record;
  });
  app.get<{ Params: { id: string } }>('/api/projects/:id/exports', async request => {
    const current = project(request.params.id);
    const records = store.listRecords<StoredExport>('export').filter(item => item.record.projectId === current.id && item.tenantId === current.tenantId);
    for (const entry of records) {
      for (const result of entry.record.results) {
        if (result.status === 'running' && !activeRetries.has(entry.record.id)) { result.status = 'failed'; result.error = '上次生成已中断，可以重试该目标。'; }
        if (result.status !== 'success') continue;
        try {
          for (const artifact of result.artifacts) {
            const file = store.getRecord<StoredArtifact>('artifact', artifact.id);
            if (!file || file.projectId !== current.id || file.tenantId !== current.tenantId || (await stat(resourcePath(file.relativePath))).size !== artifact.byteSize) throw new Error('missing');
          }
        } catch { result.status = 'failed'; result.error = '导出文件缺失或大小已变化，可以重试该目标。'; }
      }
      // The list is a lightweight observation, not a new durable state transition or a content-integrity claim.
      entry.record.status = entry.record.results.some(result => result.status === 'running') ? 'running' : recordStatus(entry.record.results);
    }
    return records.map(item => item.record).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });
  app.post<{ Params: { id: string; exportId: string } }>('/api/projects/:id/exports/:exportId/retry', async request => {
    const input = z.object({ target: targetSchema }).strict().parse(request.body);
    return serialized(async () => {
      const entry = ownedExport(request.params.id, request.params.exportId);
      const result = entry.record.results.find(item => item.target === input.target);
      if (!result) throw new StudioError('TARGET_NOT_SELECTED', '该历史版本未选择这个输出目标，请创建新版本。');
      if (result.status === 'success') {
        try { for (const artifact of result.artifacts) await artifactBytes(entry.record.projectId, artifact); return entry.record; }
        catch { result.status = 'failed'; result.error = '原产物缺失或已变化，正在使用原交付版本重新生成。'; store.putRecord('export', entry.record.id, entry); }
      }
      const source = entry.frozen.sources[input.target];
      if (!source) throw new StudioError('HISTORICAL_SOURCE_MISSING', '历史渲染输入缺失，无法重试；请恢复备份或创建新版本。', 409);
      const blockers = entry.frozen.candidate.issues.filter(issue => issue.severity === 'error' && (issue.scope === 'all' || issue.scope === input.target) && !['RENDER_FAILED', 'BROWSER_MISSING', 'BROWSER_LAUNCH_FAILED'].includes(issue.code));
      if (blockers.length) throw new StudioError('HISTORICAL_INPUT_BLOCKED', '这个历史版本存在内容或排版问题。请修改项目后生成新版本，历史内容不会被改写。', 409);
      let html: string;
      try { html = await readFile(resourcePath(source.relativePath), 'utf8'); if (digest(html) !== source.hash) throw new Error('checksum'); }
      catch { throw new StudioError('HISTORICAL_SOURCE_CHANGED', '历史渲染输入缺失或已变化，无法安全重试。', 409); }
      let browser: Browser | undefined;
      activeRetries.add(entry.record.id);
      try {
        const started = await startRenderer(); browser = started.browser; activeBrowsers.add(browser);
        if (entry.frozen.dependencies.engine && (entry.frozen.dependencies.engine.chromium !== started.dependencies.chromium || entry.frozen.dependencies.engine.renderer !== started.dependencies.renderer)) throw new StudioError('HISTORICAL_ENGINE_CHANGED', '渲染器版本已变化，请从当前项目创建新版本；原有成功产物仍保留。', 409);
        result.status = 'running'; entry.record.status = 'running'; store.putRecord('export', entry.record.id, entry);
        const files = await renderOutput(browser, html, input.target, entry.frozen.snapshot.document.output, resourcePath(`${entry.record.projectId}/${entry.record.candidateId}/retry-${randomUUID()}/${input.target}`));
        result.artifacts = registerArtifacts(files, input.target, entry.frozen); result.status = 'success'; delete result.error;
      } catch (error) {
        if (error instanceof StudioError) throw error;
        app.log.error({ err: error, exportId: entry.record.id, target: input.target }, 'Historical rendering retry failed');
        const failure = knownTargetError(error, input.target); result.status = failure.result.status; result.error = failure.result.error;
      } finally {
        activeRetries.delete(entry.record.id);
        if (browser) { activeBrowsers.delete(browser); await browser.close(); }
        entry.record.status = recordStatus(entry.record.results); store.putRecord('export', entry.record.id, entry);
      }
      return entry.record;
    });
  });
  app.get<{ Params: { id: string; artifactId: string } }>('/api/projects/:id/artifacts/:artifactId', async (request, reply) => {
    project(request.params.id);
    const stored = store.getRecord<StoredArtifact>('artifact', request.params.artifactId);
    if (!stored || stored.projectId !== request.params.id || stored.tenantId !== store.getSettings().tenantId) throw new StudioError('ARTIFACT_NOT_FOUND', '导出文件不存在。', 404);
    const bytes = await artifactBytes(request.params.id, stored.artifact);
    return reply.header('Cache-Control', 'private, no-store').header('Content-Disposition', `inline; filename="${stored.artifact.filename}"`).type(stored.artifact.mime).send(bytes);
  });
  app.get<{ Params: { id: string; candidateId: string } }>('/api/projects/:id/candidates/:candidateId/preview/image', async (request, reply) => {
    const stored = ownedCandidate(request.params.id, request.params.candidateId);
    const result = stored.candidate.results.find(value => value.target === 'image');
    if (!result || result.status !== 'ready') throw new StudioError('PREVIEW_NOT_READY', '长图正式预览尚未就绪。', 409);
    const segments = result.artifacts.filter(artifact => artifact.role !== 'share');
    const share = result.artifacts.find(artifact => artifact.role === 'share');
    const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self'; style-src 'unsafe-inline'"><title>长图正式预览</title><style>html{background:#e7e6e2}body{margin:0;padding:12px;font:12px sans-serif;color:#595952}figure{margin:0 auto 20px;max-width:600px}img{display:block;width:100%;height:auto}figcaption{padding:10px 0;text-align:center}h2{margin:28px auto 12px;max-width:600px;font-size:13px;font-weight:600;text-align:center}figure.share{max-width:360px}</style><body>${segments.map((artifact, index) => `<figure><img src="${escapeHtml(artifact.url)}" alt="交付长图 ${index + 1}"><figcaption>${index + 1} / ${segments.length} · ${artifact.width} × ${artifact.height}</figcaption></figure>`).join('')}${share ? `<h2>分享卡 · 1080 × 1920</h2><figure class="share"><img src="${escapeHtml(share.url)}" alt="分享卡"><figcaption>${share.width} × ${share.height}</figcaption></figure>` : ''}</body></html>`;
    return reply.header('Cache-Control', 'no-store').type('text/html; charset=utf-8').send(html);
  });
}
