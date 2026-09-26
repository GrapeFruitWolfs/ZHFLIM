import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { buildApp } from '../src/server/app.js';
import type { Asset, ExportRecord, PreviewCandidate, ProjectRecord } from '../src/shared/model.js';

test('real delivery workflow: import, manual corrections, immutable PDF/image exports, stale candidate rejection', { timeout: 180000 }, async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'wds-workflow-'));
  const app = await buildApp({ dataDir, rootDir: resolve('.'), testing: true, port: 4318 });
  try {
    const session = await app.inject({ method: 'GET', url: '/api/session', headers: { host: '127.0.0.1:4318' } });
    assert.equal(session.statusCode, 200);
    const token = session.json().token as string;
    const rawCookie = session.headers['set-cookie'];
    const cookie = (Array.isArray(rawCookie) ? rawCookie[0] : rawCookie)!.split(';')[0];
    const headers = { host: '127.0.0.1:4318', cookie, 'x-studio-token': token };
    const create = await app.inject({ method: 'POST', url: '/api/projects', headers, payload: { title: '虚构验收项目', presetId: 'essential' } });
    assert.equal(create.statusCode, 200, create.body);
    let project = create.json<ProjectRecord>();
    project.document.fields.coupleNames.value = '林岚 & 周屿';
    project.document.fields.weddingDate.value = '2026-09-12';
    project.document.fields.projectNo = { value: 'HIDDEN-PROJECT-CODE', visible: false };
    project.internalNotes = 'PRIVATE-NOTE-NOT-FOR-CLIENT';
    const deliveries = project.document.blocks.find(block => block.type === 'deliveries');
    assert.ok(deliveries?.type === 'deliveries');
    deliveries.items[0].downloadUrl = 'https://pan.baidu.com/s/wds-fictional-test';
    deliveries.items[0].accessNote = '取件说明：这是虚构验收链接';
    let saved = await app.inject({ method: 'PUT', url: `/api/projects/${project.id}`, headers, payload: { project, expectedRevision: project.draftRevision } });
    assert.equal(saved.statusCode, 200, saved.body); project = saved.json();
    const before = await sharp({ create: { width: 1280, height: 720, channels: 3, background: '#6a7372' } }).png().toBuffer();
    const after = await sharp({ create: { width: 1280, height: 720, channels: 3, background: '#b3a089' } }).png().toBuffer();
    const files = [
      { relativePath: '02_调色对比/01-1.png', size: after.length, type: 'image/png', lastModified: 1 },
      { relativePath: '02_调色对比/01-2.png', size: before.length, type: 'image/png', lastModified: 1 },
      { relativePath: '01_交付/完整成片.mp4', size: 48_000_000_000, type: 'video/mp4', lastModified: 1 }
    ];
    const imported = await app.inject({ method: 'POST', url: `/api/projects/${project.id}/imports`, headers, payload: { label: '虚构素材', rule: 'after-first', files } });
    assert.equal(imported.statusCode, 200, imported.body);
    const rootId = imported.json().rootId as string;
    const upload = async (relativePath: string, data: Buffer) => {
      const boundary = 'wds-fixture-boundary-2026';
      const payload = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="rootId"\r\n\r\n${rootId}\r\n--${boundary}\r\nContent-Disposition: form-data; name="relativePath"\r\n\r\n${relativePath}\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="fixture.png"\r\nContent-Type: image/png\r\n\r\n`),
        data, Buffer.from(`\r\n--${boundary}--\r\n`)
      ]);
      const response = await app.inject({ method: 'POST', url: `/api/projects/${project.id}/assets`, headers: { ...headers, 'content-type': `multipart/form-data; boundary=${boundary}` }, payload });
      assert.equal(response.statusCode, 200, response.body);
      return response.json() as { project: ProjectRecord; asset: Asset };
    };
    await upload(files[0].relativePath, after);
    await upload(files[1].relativePath, before);
    const finalized = await app.inject({ method: 'POST', url: `/api/projects/${project.id}/imports/${rootId}/finalize`, headers, payload: {} });
    assert.equal(finalized.statusCode, 200, finalized.body); project = finalized.json().project;
    assert.equal(project.assets.length, 2);
    assert.equal(finalized.json().report.videos, 1);
    const comparisonBlock = project.document.blocks.find(block => block.type === 'comparisons');
    assert.ok(comparisonBlock?.type === 'comparisons');
    assert.equal(comparisonBlock.comparisons.length, 1);
    const comparison = comparisonBlock.comparisons[0];
    [comparison.before, comparison.after] = [comparison.after, comparison.before]; comparison.locked = true;
    const manualBefore = comparison.before?.assetId;
    saved = await app.inject({ method: 'PUT', url: `/api/projects/${project.id}`, headers, payload: { project, expectedRevision: project.draftRevision } });
    assert.equal(saved.statusCode, 200, saved.body); project = saved.json();
    const rescan = await app.inject({ method: 'POST', url: `/api/projects/${project.id}/imports`, headers, payload: { rootId, label: '虚构素材', rule: 'after-first', files } });
    assert.equal(rescan.statusCode, 200, rescan.body);
    await upload(files[0].relativePath, after); await upload(files[1].relativePath, before);
    const refinal = await app.inject({ method: 'POST', url: `/api/projects/${project.id}/imports/${rootId}/finalize`, headers, payload: {} });
    assert.equal(refinal.statusCode, 200, refinal.body); project = refinal.json().project;
    const preserved = project.document.blocks.find(block => block.type === 'comparisons');
    assert.ok(preserved?.type === 'comparisons');
    assert.equal(preserved.comparisons.length, 1);
    assert.equal(preserved.comparisons[0].before?.assetId, manualBefore);

    const preview = await app.inject({ method: 'GET', url: `/api/projects/${project.id}/preview?target=pdf`, headers });
    assert.equal(preview.statusCode, 200, preview.body.slice(0, 300));
    assert.ok(preview.body.includes('林岚'));
    assert.ok(!preview.body.includes('PRIVATE-NOTE-NOT-FOR-CLIENT'));
    assert.ok(!preview.body.includes('HIDDEN-PROJECT-CODE'));
    assert.notEqual(preview.headers['x-frame-options'], 'DENY');

    const candidateResponse = await app.inject({ method: 'POST', url: `/api/projects/${project.id}/candidates`, headers, payload: { expectedRevision: project.draftRevision } });
    assert.equal(candidateResponse.statusCode, 200, candidateResponse.body.slice(0, 1000));
    const candidate = candidateResponse.json<PreviewCandidate>();
    assert.deepEqual(candidate.issues.filter(issue => issue.severity === 'error'), [], JSON.stringify(candidate.issues));
    assert.ok(candidate.results.every(result => result.status === 'ready'));
    const generated = await app.inject({ method: 'POST', url: `/api/projects/${project.id}/exports`, headers, payload: { candidateId: candidate.id, expectedRevision: project.draftRevision, acknowledgeWarnings: true, allowPartial: false } });
    assert.equal(generated.statusCode, 200, generated.body);
    const exported = generated.json<ExportRecord>();
    assert.equal(exported.status, 'success');
    const artifacts = exported.results.flatMap(result => result.artifacts);
    const pdf = artifacts.find(artifact => artifact.target === 'pdf');
    const image = artifacts.find(artifact => artifact.target === 'image');
    assert.ok(pdf && image);
    const pdfFile = await app.inject({ method: 'GET', url: pdf.url, headers });
    assert.equal(pdfFile.statusCode, 200, pdfFile.body.slice(0, 200));
    assert.equal(pdfFile.rawPayload.subarray(0, 4).toString(), '%PDF');
    const imageFile = await app.inject({ method: 'GET', url: image.url, headers });
    assert.equal(imageFile.statusCode, 200);
    assert.equal((await sharp(imageFile.rawPayload).metadata()).width, 1080);
    assert.ok((await readFile(join(dataDir, 'workspace.sqlite'))).length > 0);

    project.document.fields.coupleNames.value = '新版本的姓名';
    saved = await app.inject({ method: 'PUT', url: `/api/projects/${project.id}`, headers, payload: { project, expectedRevision: project.draftRevision } });
    assert.equal(saved.statusCode, 200, saved.body); project = saved.json();
    const stale = await app.inject({ method: 'POST', url: `/api/projects/${project.id}/exports`, headers, payload: { candidateId: candidate.id, expectedRevision: project.draftRevision, acknowledgeWarnings: true, allowPartial: false } });
    assert.equal(stale.statusCode, 409, stale.body);
    const historyPdf = await app.inject({ method: 'GET', url: pdf.url, headers });
    assert.deepEqual(historyPdf.rawPayload, pdfFile.rawPayload, 'editing the draft must not change the existing artifact');
    const privateRead = await app.inject({ method: 'GET', url: pdf.url, headers: { host: '127.0.0.1:4318' } });
    assert.equal(privateRead.statusCode, 401);
  } finally { await app.close(); await rm(dataDir, { recursive: true, force: true }); }
});
