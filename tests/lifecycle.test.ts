import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { SqliteStudioStore } from '../src/server/store.js';
import { createProject, createTextBlock, applyPreset } from '../src/shared/defaults.js';
import { moveChapter } from '../src/shared/chapters.js';
import { buildApp } from '../src/server/app.js';
import type { ProjectRecord } from '../src/shared/model.js';

test('trash survives reopening, preserves archived state, and purge removes only owned files and records', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'wds-lifecycle-'));
  let store = new SqliteStudioStore(directory);
  t.after(async () => { store.close(); await rm(directory, { recursive: true, force: true }); });
  let project = createProject({ title: '删除验收', settings: store.getSettings() });
  project.archived = true;
  project = store.saveProject(project, 0);
  const other = store.saveProject(createProject({ title: '其他项目', settings: store.getSettings() }), 0);
  for (const id of [project.id, other.id]) {
    for (const folder of ['assets', 'exports']) {
      await mkdir(join(directory, folder, id), { recursive: true });
      await writeFile(join(directory, folder, id, 'keep.txt'), 'content');
    }
    store.putRecord('candidate', `candidate-${id}`, { candidate: { projectId: id } });
    store.putRecord('export', `export-${id}`, { record: { projectId: id } });
    store.putRecord('artifact', `artifact-${id}`, { projectId: id });
    store.putRecord('import-run', `run-${id}`, { projectId: id });
  }
  store.putRecord('preset', 'reusable', { name: '保留方案' });
  await writeFile(join(directory, 'source-photo.txt'), 'original');
  const deleted = store.trashProject(project.id, project.draftRevision);
  assert.ok(deleted.deletedAt);
  assert.throws(() => store.getProject(project.id), /回收站/);
  assert.throws(() => store.saveProject(project, project.draftRevision));
  assert.equal(await readFile(join(directory, 'assets', project.id, 'keep.txt'), 'utf8'), 'content');
  store.close(); store = new SqliteStudioStore(directory);
  assert.equal(store.listProjects().find(item => item.id === project.id)?.deletedAt, deleted.deletedAt);
  const restored = store.restoreProject(project.id, deleted.draftRevision);
  assert.equal(restored.archived, true);
  assert.equal(restored.deletedAt, undefined);
  assert.equal(restored.title, project.title);
  assert.throws(() => store.saveProject(project, project.draftRevision));
  await assert.rejects(store.purgeProject(project.id, restored.draftRevision), /回收站/);
  const again = store.trashProject(project.id, restored.draftRevision);
  await assert.rejects(store.purgeProject(project.id, restored.draftRevision), /状态已改变/);
  await store.purgeProject(project.id, again.draftRevision);
  assert.throws(() => store.getProject(project.id, true), /不存在/);
  for (const folder of ['assets', 'exports']) {
    await assert.rejects(readFile(join(directory, folder, project.id, 'keep.txt')));
    assert.equal(await readFile(join(directory, folder, other.id, 'keep.txt'), 'utf8'), 'content');
  }
  for (const kind of ['candidate', 'export', 'artifact', 'import-run']) assert.equal(store.listRecords(kind).length, 1);
  assert.equal(store.listRecords('project-purge').length, 0);
  assert.ok(store.getRecord('preset', 'reusable'));
  assert.equal(await readFile(join(directory, 'source-photo.txt'), 'utf8'), 'original');
});

test('incomplete permanent deletion cannot be restored after restart and can be retried without touching external folders', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'wds-purge-failure-'));
  const outside = await mkdtemp(join(tmpdir(), 'wds-external-'));
  let store = new SqliteStudioStore(directory);
  t.after(async () => { store.close(); await rm(directory, { recursive: true, force: true }); await rm(outside, { recursive: true, force: true }); });
  const project = store.saveProject(createProject({ title: '中断删除', settings: store.getSettings() }), 0);
  const deleted = store.trashProject(project.id, project.draftRevision);
  await mkdir(join(outside, project.id));
  await writeFile(join(outside, project.id, 'keep.txt'), 'external');
  await symlink(outside, join(directory, 'exports'), 'junction');
  await assert.rejects(store.purgeProject(project.id, deleted.draftRevision), /清理未完成/);
  store.close(); store = new SqliteStudioStore(directory);
  assert.equal(store.listProjects()[0].purgePending, true);
  assert.throws(() => store.restoreProject(project.id, deleted.draftRevision), /无法恢复/);
  assert.equal(await readFile(join(outside, project.id, 'keep.txt'), 'utf8'), 'external');
  await rm(join(directory, 'exports'));
  await store.purgeProject(project.id, deleted.draftRevision);
  assert.equal(store.listProjects().length, 0);
});

test('legacy chapter order, new chapters and reusable presets keep anchors and preserve middle content', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'wds-chapter-order-'));
  let store = new SqliteStudioStore(directory);
  t.after(async () => { store.close(); await rm(directory, { recursive: true, force: true }); });
  let project = store.saveProject(createProject({ title: '顺序', settings: store.getSettings() }), 0);
  const middle = project.document.blocks.filter(block => !['intro', 'signature'].includes(block.type));
  const intro = project.document.blocks.find(block => block.type === 'intro')!;
  const signature = project.document.blocks.find(block => block.type === 'signature')!;
  const legacy = [signature, ...middle.toReversed(), intro].map((block, order) => ({ ...block, order }));
  store.close();
  const database = new DatabaseSync(join(directory, 'workspace.sqlite'));
  database.prepare('UPDATE projects SET data=? WHERE id=?').run(JSON.stringify({ ...project, document: { ...project.document, blocks: legacy } }), project.id);
  database.exec('PRAGMA user_version=2'); database.close();
  store = new SqliteStudioStore(directory);
  project = store.getProject(project.id);
  assert.equal(project.document.blocks[0].id, intro.id);
  assert.equal(project.document.blocks.at(-1)!.id, signature.id);
  assert.deepEqual(project.document.blocks.slice(1, -1).map(block => block.id), middle.toReversed().map(block => block.id));
  const added = { ...createTextBlock('新章节', '文字保留'), order: 100 };
  project.document.blocks.push(added);
  project = store.saveProject(project, project.draftRevision);
  assert.equal(project.document.blocks.at(-2)!.id, added.id);
  assert.equal(moveChapter(project.document.blocks, added.id, -10)[1].id, added.id);
  assert.equal(moveChapter(project.document.blocks, intro.id, 5)[0].id, intro.id);
  const applied = applyPreset(project, { id: 'custom', name: '旧方案', description: '', version: 1, builtin: false, blocks: legacy, templateId: 'editorial', comparisonLayout: 'stacked' });
  assert.equal(applied.document.blocks[0].type, 'intro');
  assert.equal(applied.document.blocks.at(-1)!.type, 'signature');
  assert.deepEqual(applied.document.blocks.slice(1, -1).map(block => block.title), middle.toReversed().map(block => block.title));
});

test('lifecycle API rejects concurrent use and stale revisions; trashed projects cannot be read, edited or exported', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'wds-lifecycle-api-'));
  const app = await buildApp({ dataDir: directory, rootDir: process.cwd(), testing: true });
  let started!: () => void; let finish!: () => void;
  const begun = new Promise<void>(resolve => { started = resolve; });
  const completion = new Promise<void>(resolve => { finish = resolve; });
  app.get('/api/projects/:id/test-held-read', async () => { started(); await completion; return { done: true }; });
  t.after(async () => { finish(); await app.close(); await rm(directory, { recursive: true, force: true }); });
  const session = await app.inject('/api/session');
  const headers = { cookie: String(session.headers['set-cookie']).split(';')[0], 'x-studio-token': session.json().token };
  const project = (await app.inject({ method: 'POST', url: '/api/projects', headers, payload: { title: '接口删除' } })).json<ProjectRecord>();
  const base = `/api/projects/${project.id}`;
  const payload = { expectedRevision: project.draftRevision };
  const held = app.inject({ url: `${base}/test-held-read`, headers }).then(result => result);
  await begun;
  assert.equal((await app.inject({ method: 'POST', url: `${base}/trash`, headers, payload })).json().code, 'PROJECT_BUSY');
  finish(); await held;
  const noAnchor = structuredClone(project); noAnchor.document.blocks = noAnchor.document.blocks.filter(block => block.type !== 'intro');
  assert.equal((await app.inject({ method: 'PUT', url: base, headers, payload: { project: noAnchor, expectedRevision: project.draftRevision } })).json().code, 'FIXED_CHAPTER');
  const deleted = await app.inject({ method: 'POST', url: `${base}/trash`, headers, payload });
  assert.equal(deleted.statusCode, 200, deleted.body);
  assert.equal((await app.inject({ url: base, headers })).statusCode, 410);
  assert.equal((await app.inject({ method: 'PUT', url: base, headers, payload: { project, ...payload } })).statusCode, 410);
  assert.equal((await app.inject({ method: 'POST', url: `${base}/candidates`, headers, payload })).statusCode, 410);
  assert.equal((await app.inject({ method: 'POST', url: `${base}/duplicate`, headers })).statusCode, 410);
  assert.equal((await app.inject({ method: 'POST', url: `${base}/restore`, headers, payload })).statusCode, 409);
  const restored = await app.inject({ method: 'POST', url: `${base}/restore`, headers, payload: { expectedRevision: deleted.json().draftRevision } });
  assert.equal(restored.statusCode, 200, restored.body);
  const trashed = await app.inject({ method: 'POST', url: `${base}/trash`, headers, payload: { expectedRevision: restored.json().draftRevision } });
  const purged = await app.inject({ method: 'DELETE', url: base, headers, payload: { expectedRevision: trashed.json().draftRevision } });
  assert.equal(purged.statusCode, 204, purged.body);
  assert.equal((await app.inject({ url: base, headers })).statusCode, 404);
});
