import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.WDS_PORT || 4318);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('WDS_PORT is invalid.');
const url = `http://127.0.0.1:${port}`;
const open = () => {
  if (process.env.WDS_NO_OPEN === '1') return;
  if (process.platform === 'win32') spawn('cmd.exe', ['/c', 'start', '', url], { windowsHide: true, stdio: 'ignore' }).unref();
  else if (process.platform === 'darwin') spawn('open', [url], { stdio: 'ignore' }).unref();
  else console.log(`Open ${url} in your browser.`);
};
async function health() {
  try {
    const response = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(1500) });
    if (!response.ok) return false;
    const body = await response.json();
    return body.app === 'wedding-delivery-studio';
  } catch { return false; }
}
if (await health()) {
  console.log(`Wedding Delivery Studio is already running at ${url}`);
  open();
} else {
  if (!existsSync(join(root, 'dist-server', 'index.js'))) throw new Error('The application build is missing. Extract the complete release archive first.');
  const appData = process.env.LOCALAPPDATA;
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    WDS_PORT: String(port),
    WDS_DATA_DIR: process.env.WDS_DATA_DIR || (process.platform === 'win32' && appData ? join(appData, 'WeddingDeliveryStudio') : join(root, '.studio-data')),
    WDS_CHROMIUM_PATH: process.env.WDS_CHROMIUM_PATH || (process.platform === 'win32' ? join(root, 'chromium', 'chrome-win64', 'chrome.exe') : '')
  };
  const child = spawn(process.execPath, [join(root, 'dist-server', 'index.js')], { cwd: root, env, stdio: 'inherit' });
  let stopped = false;
  child.on('exit', code => { stopped = true; process.exitCode = code ?? 1; });
  child.on('error', error => { stopped = true; console.error(error.message); process.exitCode = 1; });
  process.on('SIGINT', () => { child.kill('SIGINT'); });
  process.on('SIGTERM', () => { child.kill('SIGTERM'); });
  console.log('Starting Wedding Delivery Studio. Keep this window open while working.');
  let ready = false;
  for (let attempt = 0; attempt < 60 && !stopped; attempt++) {
    if (await health()) { ready = true; break; }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (ready) { console.log(`Ready: ${url}`); open(); }
  else if (!stopped) { console.error('Startup did not complete. Check the messages above; no other process will be stopped.'); child.kill('SIGTERM'); process.exitCode = 1; }
}
