import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// An explicit root is useful for the source-tree smoke check; the portable launcher needs no arguments.
const root = process.argv[2] ? resolve(process.argv[2]) : dirname(fileURLToPath(import.meta.url));
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
  process.env.NODE_ENV = 'production';
  process.env.WDS_PORT = String(port);
  const bundledChrome = join(root, 'chromium', 'chrome-win64', 'chrome.exe');
  if (!process.env.WDS_CHROMIUM_PATH && process.platform === 'win32' && existsSync(bundledChrome)) process.env.WDS_CHROMIUM_PATH = bundledChrome;
  const dataDir = process.env.WDS_DATA_DIR || (process.platform === 'win32' && appData ? join(appData, 'WeddingDeliveryStudio') : join(root, '.studio-data'));
  // Run the server in this process. Closing the Windows console must not orphan a child server.
  const { buildApp, resolveChromiumPath } = await import(pathToFileURL(join(root, 'dist-server', 'index.js')).href);
  const browser = resolveChromiumPath();
  if (browser.source === 'system') console.log(`Export browser: ${browser.path}`);
  if (browser.source === 'missing') console.warn('未找到 Microsoft Edge 或 Google Chrome：可以编辑项目，但生成 PDF／长图前请安装浏览器，或设置 WDS_CHROMIUM_PATH。');
  const app = await buildApp({ port, rootDir: root, dataDir });
  let closing = false;
  const close = () => {
    if (closing) return;
    closing = true;
    void app.close().catch(error => { console.error(error.message); process.exitCode = 1; });
  };
  process.once('SIGINT', close);
  process.once('SIGTERM', close);
  console.log('Starting Wedding Delivery Studio. Keep this window open while working.');
  try {
    await app.listen({ host: '127.0.0.1', port });
    console.log(`Ready: ${url}`);
    open();
  } catch (error) {
    await app.close();
    throw error;
  }
}
