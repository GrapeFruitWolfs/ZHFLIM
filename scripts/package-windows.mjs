import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { cp, mkdir, mkdtemp, open, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(await readFile(join(root, 'package-lock.json'), 'utf8'));
if (!existsSync(join(root, 'dist', 'index.html')) || !existsSync(join(root, 'dist-server', 'index.js'))) throw new Error('Run npm run build before packaging.');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const releaseName = `WeddingDeliveryStudio-${pkg.version}-win-x64-${stamp}`;
const output = join(root, 'release', releaseName);
const temporary = await mkdtemp(join(tmpdir(), 'wds-windows-'));
await mkdir(output, { recursive: true });
const run = (command, args, cwd = root, env = process.env) => new Promise((resolveRun, reject) => {
  const processRun = spawn(command, args, { cwd, env, stdio: 'inherit', shell: false });
  processRun.on('error', reject);
  processRun.on('exit', code => code === 0 ? resolveRun() : reject(new Error(`${command} exited with ${code}`)));
});
async function download(url, path) {
  console.log(`Downloading ${new URL(url).hostname}: ${url.split('/').at(-1)}`);
  const response = await fetch(url, { signal: AbortSignal.timeout(300000) });
  if (!response.ok || !response.body) throw new Error(`Download failed: ${response.status} ${url}`);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(path));
  return { url, sha256: await hash(path) };
}
async function hash(path) {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return digest.digest('hex');
}
async function unzip(file, destination) {
  await mkdir(destination, { recursive: true });
  if (process.platform === 'win32') await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'Expand-Archive -LiteralPath $env:WDS_ARCHIVE -DestinationPath $env:WDS_EXTRACT'], root, { ...process.env, WDS_ARCHIVE: file, WDS_EXTRACT: destination });
  else await run('unzip', ['-q', file, '-d', destination]);
}
const nodeVersion = '24.19.0';
const nodeFilename = `node-v${nodeVersion}-win-x64.zip`;
const nodeUrl = `https://nodejs.org/dist/v${nodeVersion}/${nodeFilename}`;
const browsers = JSON.parse(await readFile(join(root, 'node_modules', 'playwright-core', 'browsers.json'), 'utf8'));
const chromiumVersion = browsers.browsers.find(browser => browser.name === 'chromium').browserVersion;
const chromeUrl = `https://storage.googleapis.com/chrome-for-testing-public/${chromiumVersion}/win64/chrome-win64.zip`;
const [nodeDownload, chromeDownload] = await Promise.all([
  download(nodeUrl, join(temporary, 'node.zip')),
  download(chromeUrl, join(temporary, 'chromium.zip'))
]);
const sums = await fetch(`https://nodejs.org/dist/v${nodeVersion}/SHASUMS256.txt`, { signal: AbortSignal.timeout(30000) });
if (!sums.ok) throw new Error('Cannot verify Node runtime checksum.');
const expected = (await sums.text()).split('\n').find(line => line.endsWith(`  ${nodeFilename}`))?.split(/\s+/)[0];
if (!expected || expected !== nodeDownload.sha256) throw new Error('Node runtime checksum mismatch.');
await unzip(join(temporary, 'node.zip'), join(temporary, 'node'));
await mkdir(join(output, 'runtime'), { recursive: true });
for (const file of ['node.exe', 'LICENSE']) await cp(join(temporary, 'node', `node-v${nodeVersion}-win-x64`, file), join(output, 'runtime', file));
await unzip(join(temporary, 'chromium.zip'), join(output, 'chromium'));
for (const directory of ['dist', 'dist-server', 'public']) await cp(join(root, directory), join(output, directory), { recursive: true });
await cp(join(root, 'scripts', 'launcher.mjs'), join(output, 'launcher.mjs'));
await cp(join(root, 'scripts', 'start-windows.cmd'), join(output, 'Start-Studio.cmd'));
const dependencies = Object.fromEntries(Object.keys(pkg.dependencies).map(name => [name, lock.packages[`node_modules/${name}`].version]));
// Preserve the tested dependency tree, including transitive packages, during cross-install.
await cp(join(root, 'package.json'), join(output, 'package.json'));
await cp(join(root, 'package-lock.json'), join(output, 'package-lock.json'));
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run packaging using npm run package:windows.');
await run(process.execPath, [npmCli, 'ci', '--omit=dev', '--ignore-scripts', '--include=optional', '--os=win32', '--cpu=x64', '--no-audit', '--no-fund'], output);
const sharpDirectory = join(output, 'node_modules', '@img', 'sharp-win32-x64', 'lib');
const sharpFiles = await readdir(sharpDirectory);
const sharpNative = sharpFiles.filter(file => /^sharp-win32-x64(?:-[\d.]+)?\.node$/.test(file));
if (sharpNative.length !== 1 || !sharpFiles.includes('libvips-42.dll') || !sharpFiles.some(file => /^libvips-cpp-.*\.dll$/.test(file))) throw new Error('Windows Sharp native addon or required DLLs are missing.');
const sharpBinaries = sharpFiles.filter(file => file.endsWith('.node') || file.endsWith('.dll')).map(file => join(sharpDirectory, file));
for (const file of [join(output, 'runtime', 'node.exe'), join(output, 'chromium', 'chrome-win64', 'chrome.exe'), ...sharpBinaries]) {
  const handle = await open(file, 'r');
  try {
    const data = Buffer.alloc(2);
    await handle.read(data, 0, 2, 0);
    if (data.toString() !== 'MZ') throw new Error(`Missing Windows executable: ${file}`);
  } finally { await handle.close(); }
}
const windowsExecutionVerified = process.platform === 'win32';
if (windowsExecutionVerified) await run(process.execPath, [join(root, 'scripts', 'smoke-runtime.mjs'), output]);
await writeFile(join(output, 'README.txt'), [
  'Wedding Delivery Studio — Windows x64 本地预览版', '',
  '1. 将整个 ZIP 解压到普通文件夹，不要直接在压缩包内启动。',
  '2. 双击 Start-Studio.cmd，无需另外安装 Node、npm 或渲染浏览器。',
  '3. 保持控制台窗口开启；浏览器将打开 http://127.0.0.1:4318。',
  '4. 项目数据独立保存在 %LOCALAPPDATA%\\WeddingDeliveryStudio。',
  '5. 备份时先关闭 Studio，再复制完整数据目录（不只是数据库文件）。',
  '6. 选择文件夹只扫描目录，默认仅复制候选对比图；不会上传完整婚礼影片。',
  '7. 先使用脱敏副本试做一次交付，确认中文字体、配对、分页及长图后再用于真实项目。', '',
  windowsExecutionVerified ? '这是未签名的便携预览版，已在 Windows 自动化环境完成启动、导入、双格式输出与重开验收；实际手机和个人电脑仍需试用。' : '这是未签名的便携预览版，已在其他系统完成构建与测试，尚未在 Windows 执行。',
  '本机服务只监听回环地址，不是可直接部署到公网的 SaaS；客户不需要运行此软件。',
  'PDF 与长图生成后，由你通过微信或网盘发送给客户。客户网页和账号登录尚未实现。',
  'Node、Chromium、依赖和字体遵循各自随包许可证。',
  '端口被占用时请检查已有 Studio 实例，或设置 WDS_PORT；不要结束无关程序。', ''
].join('\r\n'));
const buildFiles = ['package-lock.json', 'dist/index.html', 'dist-server/index.js', 'launcher.mjs', 'Start-Studio.cmd'];
const buildHashes = Object.fromEntries(await Promise.all(buildFiles.map(async file => [file, await hash(join(output, file))])));
await writeFile(join(output, 'build-manifest.json'), JSON.stringify({ appVersion: pkg.version, builtAt: new Date().toISOString(), target: 'win32-x64', buildHost: process.platform, windowsExecutionVerified, nodeVersion, chromiumVersion, downloads: [nodeDownload, chromeDownload], dependencies, buildHashes }, null, 2));
const zipPath = `${output}.zip`;
if (process.platform === 'win32') await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'Compress-Archive -LiteralPath $env:WDS_RELEASE -DestinationPath $env:WDS_RELEASE_ZIP'], root, { ...process.env, WDS_RELEASE: output, WDS_RELEASE_ZIP: zipPath });
else await run('zip', ['-q', '-r', zipPath, releaseName], join(root, 'release'));
const releaseHash = await hash(zipPath);
await writeFile(`${zipPath}.sha256`, `${releaseHash}  ${releaseName}.zip\n`);
console.log(`Windows portable archive: ${zipPath}\nSHA-256: ${releaseHash}\nWindows runtime smoke verified: ${windowsExecutionVerified}.`);
