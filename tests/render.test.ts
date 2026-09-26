import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import Fastify from 'fastify';
import { createProject, createTextBlock } from '../src/shared/defaults.js';
import type { AssetVersion, ComparisonBlock, ProjectRecord, StudioSettings } from '../src/shared/model.js';
import type { StudioStore } from '../src/server/contracts.js';
import { candidateIsStale, digest, loadFonts, prepareDisplay, resolvedDeliveryDate, safeDeliveryUrl, settingsFingerprint } from '../src/rendering/display.js';
import { renderHtml, textChunks } from '../src/rendering/html.js';
import { checkGlyphCoverage } from '../src/rendering/fonts.js';
import { RenderFailure, renderTarget, startRenderer } from '../src/rendering/engine.js';
import { registerExportRoutes } from '../src/server/export-service.js';
import { StudioError } from '../src/domain/errors.js';

const settings: StudioSettings = { tenantId: 'studio-test', studioName: '行间影像', photographerName: 'ZH', tagline: '为真实的情绪留一份底片。', accent: '#9a805f', timezone: 'Asia/Shanghai' };
function sample(): ProjectRecord {
  const result = createProject({ title: 'PRIVATE_PROJECT_TITLE', presetId: 'blank', settings });
  result.document.fields.coupleNames.value = '林与陈'; result.document.fields.weddingDate.value = '2026-09-19';
  result.internalNotes = 'NEVER_RENDER_PRIVATE_NOTE'; result.draftRevision = 1;
  return result;
}
class MemoryStore implements StudioStore {
  records = new Map<string, unknown>(); paths = new Map<string, { path: string; version: AssetVersion }>();
  constructor(public dataDir: string, public current: ProjectRecord, public studioSettings: StudioSettings = structuredClone(settings)) {}
  getProject(id: string) { if (id !== this.current.id) throw new StudioError('PROJECT_NOT_FOUND', '项目不存在。', 404); return structuredClone(this.current); }
  listProjects() { return []; }
  saveProject(project: ProjectRecord) { this.current = structuredClone(project); return this.getProject(project.id); }
  getSettings() { return structuredClone(this.studioSettings); }
  saveSettings(value: StudioSettings) { this.studioSettings = structuredClone(value); return this.getSettings(); }
  listPresets() { return []; }
  assetPath(_projectId: string, versionId: string) { const value = this.paths.get(versionId); if (!value) throw new Error('missing'); return value; }
  putRecord<T>(kind: string, id: string, value: T) { this.records.set(`${kind}:${id}`, structuredClone(value)); }
  getRecord<T>(kind: string, id: string) { return structuredClone(this.records.get(`${kind}:${id}`)) as T | undefined; }
  listRecords<T>(kind: string) { return [...this.records.entries()].filter(([key]) => key.startsWith(`${kind}:`)).map(([, value]) => structuredClone(value) as T); }
}

test('render whitelist excludes hidden fields, hidden blocks, unused assets and internal project metadata', async () => {
  const project = sample();
  project.document.fields.salutation = { visible: false, value: 'HIDDEN_SALUTATION' };
  project.document.fields.studioName = { visible: false, value: 'HIDDEN_STUDIO' };
  project.document.fields.projectNo = { visible: false, value: 'HIDDEN_PROJECT_NUMBER' };
  project.document.blocks.push({ ...createTextBlock('HIDDEN_TITLE', 'HIDDEN_CONTENT'), visible: false });
  project.document.blocks.push({ id: 'hidden-comparison', type: 'comparisons', title: 'Hidden pictures', order: 5, visible: false, layout: 'stacked', comparisons: [{ id: 'private-pair', visible: true, order: 0, title: '', locked: true, before: { assetId: 'private', versionId: 'private' }, after: null }] });
  const store = new MemoryStore('/tmp/unused', project);
  const prepared = await prepareDisplay(project, store, '2026-09-26');
  const html = renderHtml(prepared.display, 'pdf', { css: '', hashes: {}, issues: [] });
  for (const hidden of ['NEVER_RENDER_PRIVATE_NOTE', 'PRIVATE_PROJECT_TITLE', 'HIDDEN_SALUTATION', 'HIDDEN_STUDIO', 'HIDDEN_PROJECT_NUMBER', 'HIDDEN_TITLE', 'HIDDEN_CONTENT', 'private-pair']) assert.ok(!html.includes(hidden), hidden);
  assert.equal(prepared.issues.filter(issue => issue.severity === 'error').length, 0);
  assert.equal(prepared.assets.length, 0);
  assert.ok(html.includes('林与陈'));
});

test('visible incomplete content reports actionable errors, hiding its chapter removes those errors', async () => {
  const project = sample();
  const empty: ComparisonBlock = { id: 'empty', type: 'comparisons', title: '色彩', visible: true, order: 1, layout: 'inherit', comparisons: [] };
  project.document.blocks.push(empty, { ...createTextBlock('', ''), order: 2 });
  const store = new MemoryStore('/tmp/unused', project);
  const prepared = await prepareDisplay(project, store, '2026-09-26');
  assert.ok(prepared.issues.some(issue => issue.code === 'COMPARISONS_EMPTY' && issue.blockId === 'empty'));
  assert.ok(prepared.issues.some(issue => issue.code === 'TEXT_EMPTY'));
  empty.visible = false;
  const next = await prepareDisplay(project, store, '2026-09-26');
  assert.ok(!next.issues.some(issue => issue.code === 'COMPARISONS_EMPTY'));
});

test('HTML escapes visible text and rejects executable, credential-bearing and temporary signed URLs', async () => {
  const project = sample(); project.document.fields.coupleNames.value = '<script>BAD()</script>';
  const prepared = await prepareDisplay(project, new MemoryStore('/tmp/unused', project), '2026-09-26');
  const html = renderHtml(prepared.display, 'pdf', { css: '', hashes: {}, issues: [] });
  assert.ok(!html.includes('<script>')); assert.ok(html.includes('&lt;script&gt;'));
  for (const url of ['javascript:alert(1)', 'file:///etc/passwd', 'https://user:secret@example.com', 'https://bucket.example/video?X-Amz-Signature=secret', 'http://localhost:4318/']) assert.ok(safeDeliveryUrl(url).error, url);
  assert.equal(safeDeliveryUrl('https://pan.baidu.com/s/example?pwd=1234').url?.hostname, 'pan.baidu.com');
});

test('automatic date candidates expire across the workspace midnight, hidden and manual dates stay stable', () => {
  const project = sample();
  const before = new Date('2026-09-26T15:59:00Z'); const after = new Date('2026-09-26T16:01:00Z');
  const date = resolvedDeliveryDate(project.document, settings.timezone, before);
  assert.equal(date, '2026-09-26');
  const candidate = { draftRevision: 1, resolvedDate: date, settingsHash: settingsFingerprint(settings) };
  assert.equal(candidateIsStale(candidate, project, settings, before), false);
  assert.equal(candidateIsStale(candidate, project, settings, after), true);
  project.document.deliveryDate = { visible: true, mode: 'manual', manualDate: date };
  assert.equal(candidateIsStale(candidate, project, settings, after), false);
  project.document.deliveryDate.visible = false;
  assert.equal(candidateIsStale({ ...candidate, resolvedDate: '' }, project, settings, after), false);
  project.draftRevision = 2;
  assert.equal(candidateIsStale({ ...candidate, resolvedDate: '' }, project, settings, after), true);
});

test('paragraph chunking preserves long text including supplementary-plane names', () => {
  const text = '这是婚礼影像的说明，𠮷田。'.repeat(900) + 'FINAL_VISIBLE_TEXT';
  const chunks = textChunks(text);
  assert.ok(chunks.length > 10); assert.equal(chunks.join(''), text);
  assert.ok(chunks.every(chunk => Array.from(chunk).length <= 220));
});

test('packaged font coverage checks actual visible characters and locates missing glyphs', async () => {
  const project = sample();
  project.document.fields.salutation = { value: String.fromCodePoint(0x10ffff), visible: false };
  const store = new MemoryStore('/tmp/unused', project);
  let prepared = await prepareDisplay(project, store, '2026-09-26');
  assert.deepEqual(await checkGlyphCoverage(prepared.display, process.cwd()), []);
  project.document.fields.salutation.visible = true;
  prepared = await prepareDisplay(project, store, '2026-09-26');
  const issues = await checkGlyphCoverage(prepared.display, process.cwd());
  assert.ok(issues.some(issue => issue.code === 'FONT_GLYPH_MISSING' && issue.blockId === project.document.blocks[0].id));
});

test('resource budget rejects excessive visible comparisons before asset access, hiding them restores the normal scope', async () => {
  const project = sample();
  const comparisons: ComparisonBlock = { id: 'budget-block', type: 'comparisons', title: 'Budget', visible: true, order: 2, layout: 'stacked', comparisons: Array.from({ length: 101 }, (_, index) => ({ id: `budget-${index}`, title: '', visible: true, order: index, locked: true, before: { assetId: 'a', versionId: 'a-v' }, after: { assetId: 'b', versionId: 'b-v' } })) };
  project.document.blocks.push(comparisons);
  const store = new MemoryStore('/tmp/unused', project);
  let touched = 0; store.assetPath = () => { touched += 1; throw new Error('Must not read'); };
  const blocked = await prepareDisplay(project, store, '2026-09-26');
  assert.ok(blocked.issues.some(issue => issue.code === 'RESOURCE_BUDGET')); assert.equal(touched, 0);
  comparisons.visible = false;
  const allowed = await prepareDisplay(project, store, '2026-09-26');
  assert.ok(!allowed.issues.some(issue => issue.code === 'RESOURCE_BUDGET')); assert.equal(touched, 0);
});

async function addPortraits(store: MemoryStore, directory: string): Promise<void> {
  const refs = [];
  for (let index = 0; index < 2; index++) {
    const bytes = await sharp({ create: { width: 900, height: 1350, channels: 3, background: index ? '#b5bd98' : '#828e88' } }).png().toBuffer();
    const location = path.join(directory, `portrait-${index}.png`); await writeFile(location, bytes);
    const id = `asset-${index}`; const versionId = `version-${index}`;
    const version: AssetVersion = { id: versionId, hash: digest(bytes), derivativeHash: digest(bytes), filename: `original-${index}.png`, width: 900, height: 1350, mime: 'image/png', byteSize: bytes.length, storageKey: location, originalStorageKey: location, createdAt: new Date().toISOString() };
    store.current.assets.push({ id, tenantId: settings.tenantId, projectId: store.current.id, rootId: 'root', relativePath: `PRIVATE_SOURCE_PATH_${index}.png`, versions: [version], latestVersionId: versionId });
    store.paths.set(versionId, { path: location, version }); refs.push({ assetId: id, versionId });
  }
  store.current.document.blocks.push({ id: 'portraits', type: 'comparisons', title: '色彩与情绪', visible: true, order: 1, layout: 'stacked', comparisons: [{ id: 'pair', title: '誓言时刻', visible: true, order: 0, locked: true, before: refs[0], after: refs[1] }] });
}

test('selected asset version is hash verified and never silently replaced by latest metadata', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'wds-render-assets-')); t.after(() => rm(directory, { recursive: true, force: true }));
  const store = new MemoryStore(directory, sample()); await addPortraits(store, directory);
  store.current.assets[0].latestVersionId = 'unselected-newer-version';
  const prepared = await prepareDisplay(store.current, store, '2026-09-26');
  assert.equal(prepared.assets.length, 2); assert.equal(prepared.assets[0].versionId, 'version-0');
  await writeFile(store.paths.get('version-0')!.path, 'corrupted');
  const broken = await prepareDisplay(store.current, store, '2026-09-26');
  assert.ok(broken.issues.some(issue => issue.code === 'ASSET_UNAVAILABLE' && issue.assetId === 'asset-0'));
});

test('Chromium produces real PDF and bounded long-image segments without truncating final text', { timeout: 120_000 }, async t => {
  if (!process.env.WDS_CHROMIUM_PATH && existsSync('/usr/bin/chromium')) process.env.WDS_CHROMIUM_PATH = '/usr/bin/chromium';
  const directory = await mkdtemp(path.join(os.tmpdir(), 'wds-render-engine-')); t.after(() => rm(directory, { recursive: true, force: true }));
  const store = new MemoryStore(directory, sample());
  store.current.document.blocks.splice(1, 0, { ...createTextBlock('制作与保存说明', '请妥善保存这些影像，让每次重温都能回到这一天。'.repeat(80) + '最终段落完整保留。'), order: 1 });
  store.current.document.output.segmentHeight = 2000;
  const prepared = await prepareDisplay(store.current, store, '2026-09-26');
  const fonts = await loadFonts(process.cwd());
  const { browser } = await startRenderer(); t.after(() => browser.close());
  const html = renderHtml(prepared.display, 'pdf', fonts);
  const pdf = await renderTarget(browser, html, 'pdf', store.current.document.output, path.join(directory, 'pdf'));
  assert.ok(pdf[0].pages! > 2); assert.equal((await readFile(pdf[0].path)).subarray(0, 5).toString(), '%PDF-');
  if (existsSync('/usr/bin/pdftotext')) {
    const extracted = await promisify(execFile)('/usr/bin/pdftotext', [pdf[0].path, '-']);
    assert.ok(extracted.stdout.includes('最终段落完整保留。'));
  }
  await assert.rejects(renderTarget(browser, renderHtml(prepared.display, 'image', fonts), 'image', store.current.document.output, path.join(directory, 'blocked')), (error: unknown) => error instanceof RenderFailure && error.code === 'IMAGE_TOO_LONG');
  const images = await renderTarget(browser, renderHtml(prepared.display, 'image', fonts), 'image', { ...store.current.document.output, allowImageSegments: true }, path.join(directory, 'image'));
  assert.ok(images.length > 2); assert.ok(images.every(image => image.width === 1080 && image.height! <= 2002));
  assert.ok(html.includes('最终段落完整保留。'));
  const portraitStore = new MemoryStore(directory, sample()); await addPortraits(portraitStore, directory);
  const portraitDisplay = await prepareDisplay(portraitStore.current, portraitStore, '2026-09-26');
  portraitDisplay.display.templateId = 'cinematic';
  const portraitPdf = await renderTarget(browser, renderHtml(portraitDisplay.display, 'pdf', fonts), 'pdf', { ...portraitStore.current.document.output, allowComparisonPageBreak: true }, path.join(directory, 'portrait-pdf'));
  assert.ok(portraitPdf[0].pages! >= 3);
  if (existsSync('/usr/bin/pdftotext')) {
    const extracted = await promisify(execFile)('/usr/bin/pdftotext', [portraitPdf[0].path, '-']);
    const chapterPages = extracted.stdout.split('\f').filter(page => page.includes('色彩与情绪'));
    assert.ok(chapterPages.length >= 1);
    assert.ok(chapterPages.every(page => /BEFORE|AFTER|Before|After/.test(page)), 'A comparison chapter title must share a page with its comparison');
  }
});

test('candidate API allows a successful image beside blocked PDF, rejects stale commits and keeps historical artifacts', { timeout: 120_000 }, async t => {
  if (!process.env.WDS_CHROMIUM_PATH && existsSync('/usr/bin/chromium')) process.env.WDS_CHROMIUM_PATH = '/usr/bin/chromium';
  const directory = await mkdtemp(path.join(os.tmpdir(), 'wds-render-api-')); t.after(() => rm(directory, { recursive: true, force: true }));
  const store = new MemoryStore(directory, sample()); await addPortraits(store, directory);
  const app = Fastify({ logger: false }); t.after(() => app.close());
  app.setErrorHandler((error, _request, reply) => reply.code(error instanceof StudioError ? error.statusCode : 500).send({ code: error instanceof StudioError ? error.code : 'UNKNOWN', message: error instanceof Error ? error.message : 'error' }));
  await registerExportRoutes(app, store, { dataDir: directory, rootDir: process.cwd(), host: '127.0.0.1', port: 4318, testing: true });
  const response = await app.inject({ method: 'POST', url: `/api/projects/${store.current.id}/candidates`, payload: { expectedRevision: 1 } });
  assert.equal(response.statusCode, 200, response.body);
  const candidate = response.json();
  assert.equal(candidate.results.find((item: { target: string }) => item.target === 'pdf').status, 'blocked');
  assert.equal(candidate.results.find((item: { target: string }) => item.target === 'image').status, 'ready');
  assert.ok(!response.body.includes('NEVER_RENDER_PRIVATE_NOTE')); assert.ok(!response.body.includes('PRIVATE_SOURCE_PATH'));
  const commit = (allowPartial: boolean) => app.inject({ method: 'POST', url: `/api/projects/${store.current.id}/exports`, payload: { candidateId: candidate.id, expectedRevision: 1, acknowledgeWarnings: true, allowPartial } });
  assert.equal((await commit(false)).json().code, 'PARTIAL_REQUIRES_ACK');
  const [committed, concurrent] = await Promise.all([commit(true), commit(true)]);
  assert.equal(committed.statusCode, 200, committed.body); assert.equal(committed.json().status, 'partial');
  assert.equal(concurrent.json().id, committed.json().id); assert.equal(store.listRecords('export').length, 1);
  const image = committed.json().results.find((item: { target: string }) => item.target === 'image').artifacts[0];
  const content = await app.inject({ method: 'GET', url: image.url }); assert.equal(content.statusCode, 200); assert.equal(content.headers['content-type'], 'image/jpeg');
  store.current.draftRevision = 2; store.current.document.fields.coupleNames.value = '新的姓名';
  assert.equal((await commit(true)).json().code, 'CANDIDATE_STALE');
  const stillAvailable = await app.inject({ method: 'GET', url: image.url }); assert.equal(digest(stillAvailable.rawPayload), image.hash);
  const artifactRecord = store.getRecord<{ relativePath: string }>('artifact', image.id)!;
  await rm(path.resolve(directory, 'exports', artifactRecord.relativePath));
  // No intervening history refresh: retry itself must discover the missing successful file.
  const retry = await app.inject({ method: 'POST', url: `/api/projects/${store.current.id}/exports/${committed.json().id}/retry`, payload: { target: 'image' } });
  assert.equal(retry.statusCode, 200, retry.body);
  const retried = retry.json().results.find((item: { target: string }) => item.target === 'image');
  assert.equal(retried.status, 'success'); assert.notEqual(retried.artifacts[0].id, image.id);
  assert.equal(retried.artifacts[0].hash, image.hash); assert.equal(retry.json().resolvedDate, committed.json().resolvedDate);
});

test('a later target source-write failure preserves the earlier ready PDF and candidate response', { timeout: 90_000 }, async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'wds-render-write-failure-')); t.after(() => rm(directory, { recursive: true, force: true }));
  const store = new MemoryStore(directory, sample());
  const originalPut = store.putRecord.bind(store);
  store.putRecord = <T>(kind: string, id: string, value: T) => {
    originalPut(kind, id, value);
    if (kind !== 'candidate') return;
    const data = value as { candidate: { projectId: string; results: unknown[] } };
    if (data.candidate.results.length) return;
    const candidateDirectory = path.join(directory, 'exports', data.candidate.projectId, id);
    mkdirSync(candidateDirectory, { recursive: true });
    writeFileSync(path.join(candidateDirectory, 'image'), 'Simulated destination conflict');
  };
  const app = Fastify({ logger: false }); t.after(() => app.close());
  await registerExportRoutes(app, store, { dataDir: directory, rootDir: process.cwd(), host: '127.0.0.1', port: 4318, testing: true });
  const response = await app.inject({ method: 'POST', url: `/api/projects/${store.current.id}/candidates`, payload: { expectedRevision: 1 } });
  assert.equal(response.statusCode, 200, response.body);
  const candidate = response.json();
  assert.equal(candidate.results.find((result: { target: string }) => result.target === 'pdf').status, 'ready');
  assert.equal(candidate.results.find((result: { target: string }) => result.target === 'image').status, 'failed');
  assert.ok(candidate.previewUrls.pdf); assert.ok(candidate.id);
});
