import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { buildApp } from '../src/server/app.js';
import type { ProjectRecord } from '../src/shared/model.js';

async function fixture(t: { after(fn: () => Promise<void>): void }) {
  const directory = await mkdtemp(join(tmpdir(), 'wds-server-'));
  const app = await buildApp({ dataDir: directory, rootDir: process.cwd(), testing: true });
  t.after(async () => { await app.close(); await rm(directory, { recursive: true, force: true }); });
  const session = await app.inject({ method: 'GET', url: '/api/session' });
  assert.equal(session.statusCode, 200, session.body);
  const headers = { cookie: String(session.headers['set-cookie']).split(';')[0], 'x-studio-token': session.json().token };
  const created = await app.inject({ method: 'POST', url: '/api/projects', headers, payload: { title: '接口测试婚礼', presetId: 'signature' } });
  assert.equal(created.statusCode, 200, created.body);
  return { app, headers, project: created.json<ProjectRecord>() };
}
function multipartPayload(rootId: string, relativePath: string, bytes: Buffer, importId?: string) {
  const boundary = 'wds-test-boundary';
  const fields = [['rootId', rootId], ['relativePath', relativePath], ...(importId ? [['importId', importId]] : [])];
  const payload = Buffer.concat([
    ...fields.map(([name, value]) => Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`)),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
    bytes, Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return { payload, contentType: `multipart/form-data; boundary=${boundary}` };
}

test('local API requires session, valid Host/Origin and write token while health stays public', async t => {
  const { app, headers } = await fixture(t);
  assert.equal((await app.inject('/api/health')).json().app, 'wedding-delivery-studio');
  assert.equal((await app.inject('/api/projects')).statusCode, 401);
  assert.equal((await app.inject({ url: '/api/session', headers: { host: 'attacker.example' } })).statusCode, 403);
  assert.equal((await app.inject({ url: '/api/session', headers: { origin: 'https://attacker.example' } })).statusCode, 403);
  assert.equal((await app.inject({ method: 'POST', url: '/api/projects', headers: { cookie: headers.cookie }, payload: { title: '伪造写入' } })).statusCode, 403);
  assert.equal((await app.inject({ method: 'POST', url: '/api/projects', headers: { ...headers, 'x-studio-token': '界'.repeat(64) }, payload: { title: '伪造写入' } })).statusCode, 403);
  const allowed = await app.inject({ method: 'GET', url: '/api/projects', headers });
  assert.equal(allowed.statusCode, 200); assert.equal(allowed.json().length, 1);
  assert.equal(allowed.headers['x-frame-options'], 'SAMEORIGIN');
});

test('project save preserves newer revisions and rejects managed metadata or foreign identities', async t => {
  const { app, headers, project } = await fixture(t);
  const revised = structuredClone(project); revised.title = '已保存标题'; revised.archived = true;
  const saved = await app.inject({ method: 'PUT', url: `/api/projects/${project.id}`, headers, payload: { project: revised, expectedRevision: project.draftRevision } });
  assert.equal(saved.statusCode, 200, saved.body);
  const stale = await app.inject({ method: 'PUT', url: `/api/projects/${project.id}`, headers, payload: { project, expectedRevision: project.draftRevision } });
  assert.equal(stale.statusCode, 409);
  const changed = saved.json<ProjectRecord>(); changed.tenantId = 'foreign-workspace';
  assert.equal((await app.inject({ method: 'PUT', url: `/api/projects/${project.id}`, headers, payload: { project: changed, expectedRevision: changed.draftRevision } })).statusCode, 403);
  const managed = saved.json<ProjectRecord>(); managed.importRoots.push({ id: 'forged-root', label: 'fake', rule: 'manual', createdAt: new Date().toISOString() });
  assert.equal((await app.inject({ method: 'PUT', url: `/api/projects/${project.id}`, headers, payload: { project: managed, expectedRevision: managed.draftRevision } })).statusCode, 409);
  const fresh = await app.inject({ url: `/api/projects/${project.id}`, headers });
  assert.equal(fresh.json().title, '已保存标题'); assert.equal(fresh.json().archived, true);
});

test('duplicate and saved preset strip wedding-specific fields and keep independent IDs', async t => {
  const { app, headers, project } = await fixture(t);
  project.document.fields.coupleNames.value = '上一对新人'; project.document.fields.weddingDate.value = '2026-09-26';
  const block = project.document.blocks.find(block => block.type === 'deliveries')!;
  if (block.type !== 'deliveries') throw new Error('fixture');
  block.items[0].downloadUrl = 'https://pan.baidu.com/s/private-link'; block.items[0].accessNote = 'private-code';
  assert.equal((await app.inject({ method: 'PUT', url: `/api/projects/${project.id}`, headers, payload: { project, expectedRevision: project.draftRevision } })).statusCode, 200);
  const duplicate = await app.inject({ method: 'POST', url: `/api/projects/${project.id}/duplicate`, headers });
  assert.equal(duplicate.statusCode, 200, duplicate.body);
  const copy = duplicate.json<ProjectRecord>();
  assert.notEqual(copy.id, project.id); assert.notEqual(copy.document.id, project.document.id);
  assert.equal(copy.document.fields.coupleNames.value, ''); assert.equal(copy.document.fields.weddingDate.value, ''); assert.equal(copy.assets.length, 0);
  const delivery = copy.document.blocks.find(block => block.type === 'deliveries')!;
  assert.equal(delivery.type, 'deliveries');
  if (delivery.type === 'deliveries') { assert.notEqual(delivery.items[0].id, block.items[0].id); assert.equal(delivery.items[0].downloadUrl, ''); assert.equal(delivery.items[0].accessNote, ''); }
  const preset = await app.inject({ method: 'POST', url: '/api/presets', headers, payload: { projectId: project.id, name: '我的方案' } });
  assert.equal(preset.statusCode, 200, preset.body);
  assert.equal(JSON.stringify(preset.json()).includes('private-link'), false);
  const empty = await app.inject({ method: 'POST', url: '/api/projects', headers, payload: { title: '' } });
  assert.equal(empty.statusCode, 200); assert.equal(empty.json().title, '未命名婚礼项目');
});

test('multipart images preserve original metadata, serve PNG and cannot be fetched from another project', async t => {
  const { app, headers, project } = await fixture(t);
  const bytes = await sharp({ create: { width: 24, height: 12, channels: 3, background: '#aabbcc' } }).jpeg().toBuffer();
  const scanning = await app.inject({ method: 'POST', url: `/api/projects/${project.id}/imports`, headers, payload: { label: '手选图片', rule: 'manual', includeUnclassifiedImages: true, files: [{ relativePath: 'portrait.jpg', size: bytes.length, type: 'image/jpeg', lastModified: 0 }] } });
  assert.equal(scanning.statusCode, 200, scanning.body);
  const multipart = multipartPayload(scanning.json().rootId, 'portrait.jpg', bytes, scanning.json().report.id);
  const uploaded = await app.inject({ method: 'POST', url: `/api/projects/${project.id}/assets`, headers: { ...headers, 'content-type': multipart.contentType }, payload: multipart.payload });
  assert.equal(uploaded.statusCode, 200, uploaded.body);
  const version = uploaded.json().asset.versions[0]; assert.equal(version.mime, 'image/jpeg'); assert.ok(version.originalStorageKey); assert.ok(version.derivativeHash);
  const served = await app.inject({ url: `/api/projects/${project.id}/assets/${version.id}`, headers });
  assert.equal(served.statusCode, 200); assert.match(String(served.headers['content-type']), /image\/png/); assert.equal((await sharp(served.rawPayload).metadata()).format, 'png');
  const duplicate = await app.inject({ method: 'POST', url: `/api/projects/${project.id}/duplicate`, headers });
  assert.equal((await app.inject({ url: `/api/projects/${duplicate.json().id}/assets/${version.id}`, headers })).statusCode, 404);
  const traversal = await app.inject({ method: 'POST', url: `/api/projects/${project.id}/imports`, headers, payload: { label: 'malicious', rule: 'manual', files: [{ relativePath: '../secret.jpg', size: 0, type: 'image/jpeg', lastModified: 0 }] } });
  assert.equal(traversal.statusCode, 400);
  const replacement = await app.inject({ method: 'POST', url: `/api/projects/${project.id}/imports`, headers, payload: { rootId: scanning.json().rootId, label: '新扫描', rule: 'manual', includeUnclassifiedImages: true, files: [{ relativePath: 'portrait.jpg', size: bytes.length, type: 'image/jpeg', lastModified: 0 }] } });
  assert.equal(replacement.statusCode, 200);
  assert.equal((await app.inject({ method: 'POST', url: `/api/projects/${project.id}/assets`, headers: { ...headers, 'content-type': multipart.contentType }, payload: multipart.payload })).statusCode, 409);
  assert.equal((await app.inject({ method: 'POST', url: `/api/projects/${project.id}/imports/${scanning.json().rootId}/finalize`, headers, payload: { importId: scanning.json().report.id, cancelled: true } })).statusCode, 409);
  assert.equal((await app.inject({ method: 'POST', url: `/api/projects/${project.id}/imports/${scanning.json().rootId}/finalize`, headers, payload: { importId: replacement.json().report.id } })).statusCode, 200);
});
