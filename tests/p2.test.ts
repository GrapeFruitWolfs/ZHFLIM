import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { cloneBlocks, createCover, createProject, createStillsBlock, createTimelineBlock } from '../src/shared/defaults.js';
import { newId, type ImportObservation, type IntroBlock, type ProjectRecord, type StillsBlock, type StudioSettings, type TimelineBlock } from '../src/shared/model.js';
import { validateProject } from '../src/domain/validation.js';
import { SqliteStudioStore } from '../src/server/store.js';
import { acceptAssetVersion, beginImport, finalizeImport, importImage } from '../src/server/imports.js';
import { renderShareCard, startRenderer } from '../src/rendering/engine.js';

const settings: StudioSettings = { tenantId: 'test-workspace', studioName: '测试工作室', photographerName: '测试摄影师', tagline: 'A STORY IN MOTION', accent: '#88775b', timezone: 'Asia/Shanghai' };
const observations = (...paths: string[]): ImportObservation[] => paths.map(relativePath => ({ relativePath, size: 100, type: 'image/jpeg', lastModified: 0 }));
const makeImage = (color: string) => sharp({ create: { width: 32, height: 24, channels: 3, background: color } }).jpeg().toBuffer();
const intro = (project: ProjectRecord) => project.document.blocks.find((block): block is IntroBlock => block.type === 'intro')!;
const stills = (project: ProjectRecord) => project.document.blocks.find((block): block is StillsBlock => block.type === 'stills')!;
const timeline = (project: ProjectRecord) => project.document.blocks.find((block): block is TimelineBlock => block.type === 'timeline')!;

function richProject(): ProjectRecord {
  const project = createProject({ title: '高光与时间线', settings, presetId: 'signature' });
  const strip = createStillsBlock();
  strip.frames = strip.frames.map((frame, index) => ({ ...frame, caption: `高光 ${index + 1}` }));
  const day = createTimelineBlock();
  day.entries = day.entries.slice(0, 2).map(entry => ({ ...entry, note: '私密备注' }));
  const blocks = project.document.blocks;
  blocks.splice(blocks.length - 1, 0, strip, day);
  blocks.forEach((block, order) => { block.order = order; });
  intro(project).cover = { ...createCover(), teaser: { url: 'https://example.com/teaser', label: '预告片' } };
  return project;
}

test('validation accepts stills, timeline and cover teaser', () => {
  const project = richProject();
  const valid = validateProject(structuredClone(project), settings.tenantId);
  assert.equal(stills(valid).frames.length, 3);
  assert.equal(timeline(valid).entries.length, 2);
  assert.deepEqual(intro(valid).cover?.teaser, { url: 'https://example.com/teaser', label: '预告片' });
});

test('validation rejects invalid stills frames and teaser links', () => {
  const longCaption = richProject();
  stills(longCaption).frames[0].caption = '长'.repeat(201);
  assert.throws(() => validateProject(longCaption, settings.tenantId));

  const unknownField = richProject();
  (stills(unknownField).frames[0] as unknown as Record<string, unknown>).extra = true;
  assert.throws(() => validateProject(unknownField, settings.tenantId));

  const duplicate = richProject();
  stills(duplicate).frames[1].id = stills(duplicate).frames[0].id;
  assert.throws(() => validateProject(duplicate, settings.tenantId), /重复/);

  const duplicateEntry = richProject();
  timeline(duplicateEntry).entries[0].id = stills(duplicateEntry).frames[0].id;
  assert.throws(() => validateProject(duplicateEntry, settings.tenantId), /重复/);

  const foreign = richProject();
  stills(foreign).frames[0].image = { assetId: newId(), versionId: newId() };
  assert.throws(() => validateProject(foreign, settings.tenantId), /图片引用/);

  const foreignEntry = richProject();
  timeline(foreignEntry).entries[0].image = { assetId: newId(), versionId: newId() };
  assert.throws(() => validateProject(foreignEntry, settings.tenantId), /图片引用/);

  const tooMany = richProject();
  timeline(tooMany).entries = Array.from({ length: 25 }, (_, order) => ({ ...timeline(tooMany).entries[0], id: newId(), order }));
  assert.throws(() => validateProject(tooMany, settings.tenantId));

  const badTeaser = richProject();
  intro(badTeaser).cover!.teaser = { url: 'javascript:alert(1)', label: '预告片' };
  assert.throws(() => validateProject(badTeaser, settings.tenantId));

  const longLabel = richProject();
  intro(longLabel).cover!.teaser = { url: 'https://example.com/teaser', label: '长'.repeat(61) };
  assert.throws(() => validateProject(longLabel, settings.tenantId));
});

test('cloneBlocks strips stills, timeline and teaser project data and renews nested ids', () => {
  const project = richProject();
  const ref = { assetId: 'asset-a', versionId: 'version-a' };
  stills(project).frames.forEach(frame => { frame.image = ref; });
  timeline(project).entries.forEach(entry => { entry.image = ref; });
  const oldIds = new Set([...stills(project).frames.map(frame => frame.id), ...timeline(project).entries.map(entry => entry.id), ...project.document.blocks.map(block => block.id)]);
  const copy = { ...project, document: { ...project.document, blocks: cloneBlocks(project.document.blocks, true) } } as ProjectRecord;
  const strip = stills(copy); const day = timeline(copy);
  assert.equal(strip.frames.length, 3);
  assert.ok(strip.frames.every(frame => frame.image === null && frame.caption === ''));
  assert.deepEqual(strip.frames.map(frame => frame.order), [0, 1, 2]);
  assert.deepEqual(day.entries.map(entry => [entry.time, entry.title]), timeline(project).entries.map(entry => [entry.time, entry.title]));
  assert.ok(day.entries.every(entry => entry.note === '' && entry.image === null));
  assert.equal(intro(copy).cover?.teaser, undefined);
  assert.ok(!('teaser' in intro(copy).cover!));
  const newIds = [...strip.frames.map(frame => frame.id), ...day.entries.map(entry => entry.id), ...copy.document.blocks.map(block => block.id)];
  assert.ok(newIds.every(value => !oldIds.has(value)));
  assert.equal(new Set(newIds).size, newIds.length);
  assert.ok(!JSON.stringify(copy.document.blocks).includes('私密备注'));
  // Without stripping, content stays but ids are still renewed.
  const kept = cloneBlocks(project.document.blocks);
  const keptStrip = kept.find((block): block is StillsBlock => block.type === 'stills')!;
  assert.equal(keptStrip.frames[0].caption, '高光 1');
  assert.deepEqual(keptStrip.frames[0].image, ref);
  assert.ok(!oldIds.has(keptStrip.frames[0].id));
  assert.equal(kept.find((block): block is IntroBlock => block.type === 'intro')!.cover?.teaser?.label, '预告片');
});

test('accepting a new asset version re-points stills, timeline, cover and details images', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'wds-p2-'));
  const store = new SqliteStudioStore(directory);
  t.after(async () => { store.close(); await rm(directory, { recursive: true, force: true }); });
  const created = richProject();
  created.tenantId = store.getSettings().tenantId;
  let project = store.saveProject(created, 0);
  const files = observations('01-1.jpg', '01-2.jpg');
  const run = beginImport(store, project.id, { label: '素材', rule: 'after-first', files });
  await importImage(store, project.id, run.rootId, '01-1.jpg', await makeImage('#cccccc'));
  await importImage(store, project.id, run.rootId, '01-2.jpg', await makeImage('#555555'));
  project = finalizeImport(store, project.id, run.rootId).project;
  const asset = project.assets.find(item => item.relativePath === '01-1.jpg')!;
  const other = project.assets.find(item => item.relativePath === '01-2.jpg')!;
  const oldRef = { assetId: asset.id, versionId: asset.latestVersionId };
  const otherRef = { assetId: other.id, versionId: other.latestVersionId };
  stills(project).frames[0].image = oldRef;
  stills(project).frames[1].image = otherRef;
  timeline(project).entries[0].image = oldRef;
  intro(project).cover!.image = oldRef;
  const text = project.document.blocks.find(block => block.type === 'text')!;
  if (text.type !== 'text') throw new Error('Missing text block');
  text.details = { content: '说明', image: oldRef, caption: '', placement: 'inline' };
  project = store.saveProject(project, project.draftRevision);

  beginImport(store, project.id, { rootId: run.rootId, label: '素材', rule: 'after-first', files });
  const replacement = await importImage(store, project.id, run.rootId, '01-1.jpg', await makeImage('#cc9933'));
  assert.equal(replacement.asset.versions.length, 2);
  assert.deepEqual(stills(replacement.project).frames[0].image, oldRef);
  const newVersion = replacement.asset.latestVersionId;
  const accepted = acceptAssetVersion(store, project.id, asset.id, newVersion, replacement.project.draftRevision);
  assert.equal(stills(accepted).frames[0].image?.versionId, newVersion);
  assert.deepEqual(stills(accepted).frames[1].image, otherRef);
  assert.equal(stills(accepted).frames[2].image, null);
  assert.equal(timeline(accepted).entries[0].image?.versionId, newVersion);
  assert.equal(timeline(accepted).entries[1].image, null);
  assert.equal(intro(accepted).cover?.image?.versionId, newVersion);
  const acceptedText = accepted.document.blocks.find(block => block.id === text.id)!;
  assert.equal(acceptedText.type === 'text' ? acceptedText.details?.image?.versionId : undefined, newVersion);
});

const shareCss = '<style>body{margin:0}.render-root{width:600px;height:900px;background:#eee}.share-card{display:none} html[data-mode=share] .render-root{display:none} html[data-mode=share] .share-card{display:block;width:432px;height:768px;background:#123}</style>';

test('renderShareCard captures a 1080×1920 sRGB JPEG and skips HTML without a share card', { timeout: 120_000 }, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'wds-share-'));
  const { browser } = await startRenderer();
  t.after(async () => { await browser.close(); await rm(directory, { recursive: true, force: true }); });
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">${shareCss}</head><body><div class="render-root">长图</div><section class="share-card"><p style="color:#fff;margin:0">分享卡</p></section></body></html>`;
  const file = await renderShareCard(browser, html, directory);
  assert.ok(file);
  assert.equal(file.filename, 'wedding-share-card.jpg');
  assert.equal(file.role, 'share');
  assert.equal(file.mime, 'image/jpeg');
  assert.equal(file.width, 1080);
  assert.equal(file.height, 1920);
  const bytes = await readFile(file.path);
  assert.equal(bytes.length, file.byteSize);
  const metadata = await sharp(bytes).metadata();
  assert.equal(metadata.format, 'jpeg');
  assert.equal(metadata.width, 1080);
  assert.equal(metadata.height, 1920);
  const { data } = await sharp(bytes).extract({ left: 540, top: 1600, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
  assert.ok(Math.abs(data[0] - 0x11) <= 3 && Math.abs(data[1] - 0x22) <= 3 && Math.abs(data[2] - 0x33) <= 3, `unexpected share card colour ${[...data]}`);

  const plain = `<!doctype html><html><head><meta charset="utf-8">${shareCss}</head><body><div class="render-root">长图</div></body></html>`;
  assert.equal(await renderShareCard(browser, plain, join(directory, 'none')), undefined);

  const wrongSize = html.replace('height:768px', 'height:700px');
  await assert.rejects(renderShareCard(browser, wrongSize, join(directory, 'wrong')), (error: Error & { code?: string }) => error.code === 'SHARE_CARD_DIMENSION_MISMATCH');
});

test('export browser: explicit path wins; lite Windows uses system Edge, then Chrome, and reports when neither exists', async () => {
  const { resolveChromiumPath } = await import('../src/rendering/engine.js');
  const env = { 'ProgramFiles(x86)': 'C:\\Program Files (x86)', ProgramFiles: 'C:\\Program Files', LOCALAPPDATA: 'C:\\Users\\A\\AppData\\Local' };
  const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const chrome = 'C:\\Users\\A\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';
  assert.deepEqual(resolveChromiumPath({ ...env, WDS_CHROMIUM_PATH: 'D:\\chrome.exe' }, 'win32', () => true), { path: 'D:\\chrome.exe', source: 'env' });
  assert.deepEqual(resolveChromiumPath(env, 'win32', file => file === edge || file === chrome), { path: edge, source: 'system' });
  assert.deepEqual(resolveChromiumPath(env, 'win32', file => file === chrome), { path: chrome, source: 'system' });
  assert.deepEqual(resolveChromiumPath(env, 'win32', () => false), { source: 'missing' });
  assert.deepEqual(resolveChromiumPath({}, 'darwin', () => false), { source: 'playwright' });
});
