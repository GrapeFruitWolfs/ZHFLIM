import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { createConnection, createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const root = resolve(process.argv[2] || join(dirname(fileURLToPath(import.meta.url)), '..'));
const portable = existsSync(join(root, 'runtime', 'node.exe'));
if (portable && process.platform !== 'win32') throw new Error('The Windows runtime smoke check must run on Windows.');
const runtime = portable ? join(root, 'runtime', 'node.exe') : process.execPath;
const launcher = join(root, portable ? 'launcher.mjs' : 'scripts/launcher.mjs');
const temporary = await mkdtemp(join(tmpdir(), 'wds-runtime-smoke-'));
const dataDir = join(temporary, '中文 工作室资料');
await mkdir(dataDir);
const probe = createServer();
await new Promise((ok, fail) => { probe.once('error', fail); probe.listen(0, '127.0.0.1', ok); });
const port = probe.address().port;
await new Promise((ok, fail) => probe.close(error => error ? fail(error) : ok()));
const base = `http://127.0.0.1:${port}`;
let child;
let cookie = '';
let token = '';
let logs = '';
const delay = ms => new Promise(ok => setTimeout(ok, ms));

async function start() {
  const env = { ...process.env, WDS_PORT: String(port), WDS_DATA_DIR: dataDir, WDS_NO_OPEN: '1' };
  // The lite package has no bundled browser and must find the system Edge／Chrome by itself.
  const bundled = join(root, 'chromium', 'chrome-win64', 'chrome.exe');
  if (portable && existsSync(bundled)) env.WDS_CHROMIUM_PATH = bundled;
  child = spawn(runtime, [launcher, root], { cwd: temporary, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  child.on('error', error => { logs += error.message; });
  for (const stream of [child.stdout, child.stderr]) stream.on('data', data => { logs = (logs + data.toString()).slice(-24000); });
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null || child.signalCode !== null) throw new Error(`Studio exited during startup.\n${logs}`);
    try {
      const health = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(1000) });
      if (health.ok && (await health.json()).app === 'wedding-delivery-studio') {
        assert.equal(child.exitCode, null, 'The launcher must still own the running server.');
        assert.equal(child.signalCode, null);
        const session = await fetch(`${base}/api/session`);
        assert.equal(session.status, 200);
        cookie = session.headers.getSetCookie()[0].split(';')[0];
        token = (await session.json()).token;
        return;
      }
    } catch { /* The server may still be starting. */ }
    await delay(200);
  }
  throw new Error(`Studio startup timed out.\n${logs}`);
}

async function stop() {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const stopped = new Promise(ok => child.once('exit', ok));
  child.kill('SIGTERM');
  await Promise.race([stopped, delay(5000)]);
  if (child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); await stopped; }
  const listening = await new Promise((ok, fail) => {
    const socket = createConnection({ host: '127.0.0.1', port });
    socket.once('connect', () => { socket.destroy(); ok(true); });
    socket.once('error', error => { socket.destroy(); error.code === 'ECONNREFUSED' ? ok(false) : fail(error); });
    socket.setTimeout(1500, () => { socket.destroy(); fail(new Error('Cannot verify that the Studio port closed.')); });
  });
  assert.equal(listening, false, 'Closing the launcher must close its server before reopening SQLite.');
}

async function request(path, payload, method = 'POST') {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { cookie, 'x-studio-token': token, ...(payload instanceof FormData ? {} : { 'content-type': 'application/json' }) },
    body: payload === undefined ? undefined : payload instanceof FormData ? payload : JSON.stringify(payload),
    signal: AbortSignal.timeout(120000),
  });
  const result = await response.json();
  assert.ok(response.ok, `${method} ${path}: ${response.status} ${JSON.stringify(result)}`);
  return result;
}

// Deterministic synthetic RGB PNGs exercise packaged Sharp without importing any development dependency.
function png(rgb) {
  const chunk = (name, data) => {
    const type = Buffer.from(name); let crc = 0xffffffff;
    for (const byte of Buffer.concat([type, data])) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    const size = Buffer.alloc(4); size.writeUInt32BE(data.length);
    const check = Buffer.alloc(4); check.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([size, type, data, check]);
  };
  const width = 1000; const height = 600; const stride = width * 3 + 1;
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) for (let channel = 0; channel < 3; channel++) pixels[y * stride + 1 + x * 3 + channel] = rgb[channel];
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]);
}

try {
  await start();
  const home = await fetch(base);
  assert.equal(home.status, 200);
  assert.match(await home.text(), /<div id="root">/);
  let project = await request('/api/projects', { title: '运行环境验收 · 虚构婚礼', presetId: 'essential' });
  const projectPath = `/api/projects/${project.id}`;
  const files = [png([178, 143, 111]), png([131, 137, 139])];
  const relativePaths = ['中文 项目/02_调色对比/01-1.png', '中文 项目/02_调色对比/01-2.png'];
  const imported = await request(`${projectPath}/imports`, {
    label: '中文 素材目录', rule: 'after-first',
    files: files.map((bytes, index) => ({ relativePath: relativePaths[index], size: bytes.length, type: 'image/png', lastModified: 1 })),
  });
  for (let index = 0; index < files.length; index++) {
    const form = new FormData();
    form.append('rootId', imported.rootId); form.append('importId', imported.report.id); form.append('relativePath', relativePaths[index]);
    form.append('file', new Blob([files[index]], { type: 'image/png' }), `01-${index + 1}.png`);
    await request(`${projectPath}/assets`, form);
  }
  project = (await request(`${projectPath}/imports/${imported.rootId}/finalize`, { importId: imported.report.id })).project;
  assert.equal(project.assets.length, 2);
  assert.equal(project.document.blocks.flatMap(block => block.type === 'comparisons' ? block.comparisons : []).length, 1);
  project.document.fields.coupleNames.value = '林岚 & 周屿';
  project.document.fields.weddingDate.value = '2026-09-12';
  project.document.deliveryDate.mode = 'manual'; project.document.deliveryDate.manualDate = '2026-09-27';
  project.document.blocks.find(block => block.type === 'deliveries').items[0].downloadUrl = 'https://example.com/fictional-wedding';
  project.document.output.allowImageSegments = true;
  project.document.output.allowComparisonPageBreak = true;
  project = await request(projectPath, { project, expectedRevision: project.draftRevision }, 'PUT');
  const candidate = await request(`${projectPath}/candidates`, { expectedRevision: project.draftRevision });
  assert.deepEqual(candidate.results.map(result => result.status), ['ready', 'ready'], JSON.stringify(candidate.issues));
  const record = await request(`${projectPath}/exports`, { candidateId: candidate.id, expectedRevision: project.draftRevision, acknowledgeWarnings: true, allowPartial: false });
  assert.equal(record.status, 'success');
  assert.deepEqual(record.results.map(result => result.target), ['pdf', 'image']);
  assert.ok(record.results.every(result => result.status === 'success' && result.artifacts.length > 0), 'Both targets must contain actual artifacts.');
  for (const artifact of record.results.flatMap(result => result.artifacts)) {
    const response = await fetch(`${base}${artifact.url}`, { headers: { cookie } });
    assert.equal(response.status, 200);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(createHash('sha256').update(bytes).digest('hex'), artifact.hash);
    if (artifact.target === 'pdf') assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
    else assert.equal(bytes.readUInt16BE(0), 0xffd8);
  }
  await stop();
  await start();
  const reopened = await request(projectPath, undefined, 'GET');
  assert.equal(reopened.document.fields.coupleNames.value, '林岚 & 周屿');
  const history = await request(`${projectPath}/exports`, undefined, 'GET');
  assert.equal(history[0].id, record.id); assert.equal(history[0].status, 'success');
  console.log(JSON.stringify({ verified: true, platform: process.platform, arch: process.arch, portable, checks: ['launcher', 'unicode-data-directory', 'sqlite-reopen', 'native-image-import', 'comparison-pairing', 'pdf', 'jpeg', 'artifact-hashes', 'export-history'] }));
} catch (error) {
  console.error(logs);
  throw error;
} finally {
  await stop();
  await rm(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 });
}
