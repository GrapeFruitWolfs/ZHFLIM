import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import sharp from 'sharp';
import { createProject } from '../src/shared/defaults.js';
import { newId, type ImportObservation, type ProjectRecord } from '../src/shared/model.js';
import { recognizePath, preserveManualDecisions } from '../src/domain/recognition.js';
import { normalizeRelativePath, validateProject } from '../src/domain/validation.js';
import { SqliteStudioStore } from '../src/server/store.js';
import { acceptAssetVersion, beginImport, finalizeImport, importImage } from '../src/server/imports.js';

const observations = (...paths: string[]): ImportObservation[] => paths.map(relativePath => ({ relativePath, size: 100, type: 'image/jpeg', lastModified: 0 }));
const comparisons = (project: ProjectRecord) => project.document.blocks.flatMap(block => block.type === 'comparisons' ? block.comparisons : []);
const makeImage = (color: string) => sharp({ create: { width: 32, height: 24, channels: 3, background: color } }).jpeg().toBuffer();
async function fixture(t: { after(fn: () => Promise<void>): void }) {
  const directory = await mkdtemp(join(tmpdir(), 'wds-domain-'));
  const store = new SqliteStudioStore(directory);
  t.after(async () => { store.close(); await rm(directory, { recursive: true, force: true }); });
  const project = store.saveProject(createProject({ title: '领域测试婚礼', presetId: 'signature', settings: store.getSettings() }), 0);
  return { directory, store, project };
}

test('recognition rules keep directory boundaries and support both numeric directions and words', () => {
  assert.equal(recognizePath('root', 'A/01-1.jpg', 'after-first')?.role, 'after');
  assert.equal(recognizePath('root', 'A/01-1.jpg', 'before-first')?.role, 'before');
  assert.equal(recognizePath('root', 'before_01.jpg', 'words')?.role, 'before');
  assert.equal(recognizePath('root', '01_AFTER.jpg', 'words')?.role, 'after');
  assert.notEqual(recognizePath('root', 'A/01-1.jpg', 'after-first')?.sourceKey, recognizePath('root', 'B/01-1.jpg', 'after-first')?.sourceKey);
  assert.equal(recognizePath('root', '01-1.jpg', 'manual'), null);
});

test('relative file paths reject Windows and POSIX escape forms', () => {
  for (const path of ['../secret.jpg', '/absolute.jpg', 'C:\\photo.jpg', 'a/../../b.jpg', 'a//b.jpg', 'a/./b.jpg', 'a\u0000.jpg']) assert.throws(() => normalizeRelativePath(path));
  assert.equal(normalizeRelativePath('调色\\01-1.jpg'), '调色/01-1.jpg');
});

test('aggregate validation rejects foreign tenant and unowned asset refs', async t => {
  const { store, project } = await fixture(t);
  assert.throws(() => validateProject({ ...project, tenantId: newId() }, store.getSettings().tenantId));
  project.document.brand.logo = { assetId: newId(), versionId: newId() };
  assert.throws(() => validateProject(project, store.getSettings().tenantId), /图片引用/);
});

test('optimistic revision protects newer edits and SQLite survives reopen', async t => {
  const { directory, store, project } = await fixture(t);
  const saved = store.saveProject({ ...project, title: '保存的新标题' }, project.draftRevision);
  assert.equal(saved.draftRevision, project.draftRevision + 1);
  assert.throws(() => store.saveProject({ ...project, title: '过期标题' }, project.draftRevision), /已有更新/);
  const reopened = new SqliteStudioStore(directory);
  try { assert.equal(reopened.getProject(project.id).title, '保存的新标题'); } finally { reopened.close(); }
});

test('opening a future SQLite schema refuses downgrade without changing its data or version', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'wds-future-schema-'));
  t.after(async () => { await rm(directory, { recursive: true, force: true }); });
  const filename = join(directory, 'workspace.sqlite');
  const future = new DatabaseSync(filename);
  future.exec("PRAGMA user_version=2; CREATE TABLE future_marker(value TEXT); INSERT INTO future_marker VALUES('preserve-me');");
  future.close();
  assert.throws(() => new SqliteStudioStore(directory), /较新版本/);
  const reopened = new DatabaseSync(filename);
  try {
    assert.equal(reopened.prepare('PRAGMA user_version').get()!.user_version, 2);
    assert.equal(reopened.prepare('SELECT value FROM future_marker').get()!.value, 'preserve-me');
    assert.equal(reopened.prepare("SELECT count(*) AS count FROM sqlite_master WHERE name='projects'").get()!.count, 0);
  } finally { reopened.close(); }
});

test('same source import is idempotent and preserves locked, hidden manual pairing', async t => {
  const { store, project } = await fixture(t);
  const files = observations('02/01-1.jpg', '02/01-2.jpg');
  const run = beginImport(store, project.id, { label: '婚礼目录', rule: 'after-first', files });
  const red = await makeImage('#ff0000'); const blue = await makeImage('#0000ff');
  await importImage(store, project.id, run.rootId, files[0].relativePath, red);
  await importImage(store, project.id, run.rootId, files[1].relativePath, blue);
  const initial = finalizeImport(store, project.id, run.rootId).project;
  assert.equal(initial.assets.length, 2);
  const pair = comparisons(initial)[0];
  [pair.before, pair.after] = [pair.after, pair.before]; pair.locked = true; pair.visible = false;
  store.saveProject(initial, initial.draftRevision);
  beginImport(store, project.id, { rootId: run.rootId, label: '婚礼目录', rule: 'after-first', files });
  await importImage(store, project.id, run.rootId, files[0].relativePath, red);
  await importImage(store, project.id, run.rootId, files[1].relativePath, blue);
  const repeated = finalizeImport(store, project.id, run.rootId);
  assert.equal(repeated.project.assets.length, 2);
  assert.equal(comparisons(repeated.project).length, 1);
  assert.deepEqual(comparisons(repeated.project)[0], pair);
  assert.equal(repeated.report.reused, 2);
});

test('automatic comparison chapter precedes signature while later manual positioning remains unchanged', async t => {
  const { store } = await fixture(t);
  const project = store.saveProject(createProject({ title: '简约方案导入', presetId: 'essential', settings: store.getSettings() }), 0);
  const originalIds = project.document.blocks.map(block => block.id);
  const files = observations('01-1.jpg');
  const run = beginImport(store, project.id, { label: '调色对比', rule: 'after-first', files });
  const imported = await importImage(store, project.id, run.rootId, files[0].relativePath, await makeImage('#998877'));
  const blocks = imported.project.document.blocks;
  const comparison = blocks.find(block => block.type === 'comparisons')!;
  const signature = blocks.find(block => block.type === 'signature')!;
  assert.equal(comparison.order + 1, signature.order);
  assert.deepEqual(blocks.filter(block => block.id !== comparison.id).map(block => block.id), originalIds);
  comparison.order = blocks.length;
  const reordered = store.saveProject(imported.project, imported.project.draftRevision);
  const rescanned = beginImport(store, project.id, { rootId: run.rootId, label: '调色对比', rule: 'after-first', files });
  assert.deepEqual(rescanned.project.document.blocks.map(block => ({ id: block.id, order: block.order })), reordered.document.blocks.map(block => ({ id: block.id, order: block.order })));
});

test('source overwrite creates immutable bytes without changing draft slot until accepted', async t => {
  const { store, project } = await fixture(t);
  const files = observations('01-1.jpg', '01-2.jpg');
  const run = beginImport(store, project.id, { label: '素材', rule: 'after-first', files });
  const firstBytes = await makeImage('#cccccc');
  await importImage(store, project.id, run.rootId, '01-1.jpg', firstBytes);
  await importImage(store, project.id, run.rootId, '01-2.jpg', await makeImage('#555555'));
  const original = finalizeImport(store, project.id, run.rootId).project;
  const oldRef = comparisons(original)[0].after!;
  beginImport(store, project.id, { rootId: run.rootId, label: '素材', rule: 'after-first', files });
  const replacement = await importImage(store, project.id, run.rootId, '01-1.jpg', await makeImage('#cc9933'));
  assert.equal(replacement.asset.id, oldRef.assetId);
  assert.equal(replacement.asset.versions.length, 2);
  assert.deepEqual(comparisons(replacement.project)[0].after, oldRef);
  assert.ok(replacement.report.issues.some(issue => issue.code === 'SOURCE_UPDATED'));
  const oldVersion = replacement.asset.versions[0];
  assert.deepEqual(await readFile(store.storagePath(oldVersion.originalStorageKey)), firstBytes);
  const managed = await readFile(store.assetPath(project.id, oldVersion.id).path);
  assert.equal(createHash('sha256').update(managed).digest('hex'), oldVersion.derivativeHash);
  assert.equal((await sharp(managed).metadata()).format, 'png');
  const accepted = acceptAssetVersion(store, project.id, replacement.asset.id, replacement.asset.latestVersionId, replacement.project.draftRevision);
  assert.equal(comparisons(accepted)[0].after!.versionId, replacement.asset.latestVersionId);
  assert.equal(original.assets.find(asset => asset.id === oldRef.assetId)!.versions.length, 1);
});

test('duplicate candidate conflict never selects last file and missing pair stays explicit', async t => {
  const { store, project } = await fixture(t);
  const files = observations('01-1.jpg', '01-1.png', '01-2.jpg', '02-1.jpg');
  const run = beginImport(store, project.id, { label: '冲突素材', rule: 'after-first', files });
  const jpeg = await makeImage('#ffffff');
  for (const file of files) await importImage(store, project.id, run.rootId, file.relativePath, jpeg);
  const result = finalizeImport(store, project.id, run.rootId);
  assert.ok(result.report.issues.some(issue => issue.code === 'PAIR_CONFLICT' && issue.paths.length === 3));
  assert.ok(result.report.issues.some(issue => issue.code === 'PAIR_INCOMPLETE' && issue.paths.includes('02-1.jpg')));
  assert.equal(comparisons(result.project).length, 1);
  assert.equal(comparisons(result.project)[0].before, null);
});

test('deleting an auto group creates exclusion and re-scan does not resurrect it', async t => {
  const { store, project } = await fixture(t);
  const files = observations('01-1.jpg', '01-2.jpg');
  const run = beginImport(store, project.id, { label: '排除素材', rule: 'after-first', files });
  for (const file of files) await importImage(store, project.id, run.rootId, file.relativePath, await makeImage('#abcdef'));
  const previous = finalizeImport(store, project.id, run.rootId).project;
  const removed = structuredClone(previous);
  for (const block of removed.document.blocks) if (block.type === 'comparisons') block.comparisons = [];
  preserveManualDecisions(previous, removed);
  assert.equal(removed.excludedSourceKeys.length, 1);
  store.saveProject(removed, previous.draftRevision);
  const repeated = beginImport(store, project.id, { rootId: run.rootId, label: '排除素材', rule: 'after-first', files });
  assert.equal(comparisons(repeated.project).length, 0);
});

test('large video is metadata only and corrupt images are recorded without destroying draft', async t => {
  const { store, project } = await fixture(t);
  const files = [{ relativePath: '完整成片/film.mp4', size: 48_000_000_000, type: 'video/mp4', lastModified: 0 }, ...observations('01-1.jpg')];
  const run = beginImport(store, project.id, { label: '大素材', rule: 'after-first', files });
  assert.equal(run.report.videos, 1); assert.equal(run.project.assets.length, 0);
  await assert.rejects(() => importImage(store, project.id, run.rootId, '01-1.jpg', Buffer.from('bad image')), /图片读取失败/);
  const result = finalizeImport(store, project.id, run.rootId, true);
  assert.ok(result.report.issues.some(issue => issue.code === 'IMAGE_IMPORT_FAILED'));
  assert.equal(result.project.assets.length, 0); assert.equal(result.report.cancelled, true);
});

test('folder scan only selects comparison candidates; manual selection can opt in other photos', async t => {
  const { store, project } = await fixture(t);
  const files = observations('01_交付/全套照片/DSC1234.jpg', '02_调色对比/portrait.jpg', '03/01-1.jpg', '03/01-2.jpg');
  const automatic = beginImport(store, project.id, { label: '婚礼', rule: 'after-first', files });
  assert.deepEqual(automatic.imagePaths, files.slice(1).map(file => file.relativePath));
  assert.deepEqual(automatic.unclassifiedImagePaths, [files[0].relativePath]);
  assert.equal(automatic.report.images, 4);
  await assert.rejects(() => importImage(store, project.id, automatic.rootId, files[0].relativePath, Buffer.from('not read')), /仅建立索引/);
  const selected = beginImport(store, project.id, { rootId: automatic.rootId, label: '婚礼', rule: 'manual', files, includeUnclassifiedImages: true });
  assert.equal(selected.imagePaths.length, 4);
  await importImage(store, project.id, selected.rootId, files[0].relativePath, await makeImage('#123456'));
  assert.equal(store.getProject(project.id).assets.length, 1);
});

test('reimport repairs a missing managed image without changing its version identity', async t => {
  const { store, project } = await fixture(t);
  const files = observations('01-1.jpg');
  const run = beginImport(store, project.id, { label: '恢复素材', rule: 'after-first', files });
  const bytes = await makeImage('#445566');
  const initial = await importImage(store, project.id, run.rootId, '01-1.jpg', bytes);
  finalizeImport(store, project.id, run.rootId);
  const version = initial.asset.versions[0];
  await rm(store.assetPath(project.id, version.id).path);
  beginImport(store, project.id, { rootId: run.rootId, label: '恢复素材', rule: 'after-first', files });
  const restored = await importImage(store, project.id, run.rootId, '01-1.jpg', bytes);
  assert.equal(restored.asset.versions.length, 1);
  assert.equal(restored.asset.latestVersionId, version.id);
  assert.ok(restored.report.issues.some(issue => issue.code === 'ASSET_RECOVERED'));
  assert.equal(createHash('sha256').update(await readFile(store.assetPath(project.id, version.id).path)).digest('hex'), version.derivativeHash);
});

test('a queued upload remains bound to its original scan and cannot contaminate a replacement scan', async t => {
  const { store, project } = await fixture(t);
  const files = observations('01-1.jpg');
  const bytes = await makeImage('#334455');
  const first = beginImport(store, project.id, { label: '第一批素材', rule: 'after-first', files });
  const queuedUpload = importImage(store, project.id, first.rootId, files[0].relativePath, bytes);
  const replacement = beginImport(store, project.id, { rootId: first.rootId, label: '第二批素材', rule: 'after-first', files });
  await assert.rejects(() => queuedUpload, /新的扫描替换/);
  assert.equal(store.getProject(project.id).assets.length, 0);
  const latestReport = store.getProject(project.id).importReports.at(-1)!;
  assert.equal(latestReport.id, replacement.report.id);
  assert.equal(latestReport.imported, 0);
  assert.equal(latestReport.issues.some(issue => issue.code === 'IMAGE_IMPORT_FAILED'), false);
  await assert.rejects(() => importImage(store, project.id, first.rootId, files[0].relativePath, bytes, first.report.id), /新的扫描替换/);
  assert.throws(() => finalizeImport(store, project.id, first.rootId, true, first.report.id), /另一批导入/);
  const accepted = await importImage(store, project.id, replacement.rootId, files[0].relativePath, bytes, replacement.report.id);
  assert.equal(accepted.asset.versions.length, 1);
  assert.equal(finalizeImport(store, project.id, replacement.rootId, false, replacement.report.id).report.imported, 1);
});
