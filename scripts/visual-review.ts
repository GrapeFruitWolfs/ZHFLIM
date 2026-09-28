import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import sharp, { type OverlayOptions } from 'sharp';
import QRCode from 'qrcode';
import { loadFonts, escapeHtml, type DisplayDocument, type DisplayImage } from '../src/rendering/display.js';
import { renderHtml } from '../src/rendering/html.js';
import { startRenderer, renderTarget } from '../src/rendering/engine.js';
import { TEMPLATES } from '../src/shared/templates.js';

async function chart(width: number, height: number, after: boolean): Promise<DisplayImage> {
  const background = after ? '#344a42' : '#7c8986';
  const foreground = after ? '#e8bc94' : '#b9ada1';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 800 600" preserveAspectRatio="none"><defs><linearGradient id="ramp"><stop stop-color="${background}"/><stop offset="1" stop-color="${foreground}"/></linearGradient></defs><rect width="800" height="600" fill="url(#ramp)"/><rect x="12" y="12" width="776" height="576" fill="none" stroke="white" stroke-width="6"/><circle cx="400" cy="285" r="155" fill="none" stroke="white" stroke-width="4"/><path d="M20 20L780 580M780 20L20 580" stroke="white" stroke-opacity=".4" stroke-width="2"/><rect x="40" y="450" width="720" height="100" fill="#172027"/><text x="400" y="513" text-anchor="middle" fill="white" font-family="sans-serif" font-size="30">${after ? 'AFTER' : 'BEFORE'} / ${width} x ${height} / TEST</text></svg>`;
  const bytes = await sharp(Buffer.from(svg)).png().toBuffer();
  return { uri: `data:image/png;base64,${bytes.toString('base64')}`, width, height };
}

const directory = resolve('release', 'visual-review', new Date().toISOString().replaceAll(':', '-'));
await mkdir(directory, { recursive: true });
const fonts = await loadFonts(process.cwd());
if (fonts.issues.some(issue => issue.severity === 'error')) throw new Error(JSON.stringify(fonts.issues));
const landscapeBefore = await chart(1280, 720, false);
const landscapeAfter = await chart(1280, 720, true);
const portraitBefore = await chart(720, 1080, false);
const portraitAfter = await chart(720, 1080, true);
const downloadUrl = 'https://example.com/wedding-demo';
const display: DisplayDocument = {
  templateId: 'editorial', accent: '#a78964', tagline: '为真实的情绪，留一份底片。', studio: '行间影像 · 演示工作室',
  output: { mode: 'both', imageWidth: 1080, segmentHeight: 12000, allowImageSegments: true, allowComparisonPageBreak: true },
  blocks: [
    { id: 'intro', type: 'intro', title: '婚礼交付', salutation: '亲爱的你们', names: '林岚 & 周屿', weddingDate: '2026-09-12', deliveryDate: '2026-09-28', projectNo: 'DEMO-20260928' },
    { id: 'delivery', type: 'deliveries', title: '为你交付', items: [{ id: 'film', title: '婚礼完整成片', format: '4K UHD · MP4 · 约 36 分钟', description: '从清晨的准备，到晚宴后的拥抱。那些来不及细看的瞬间，都留在了这份影像里。', accessNote: '演示链接，不包含真实影片。\n下载后请保留至少两份副本，并检查声音和画面是否完整。', links: [{ label: '下载与保存', url: downloadUrl, host: 'example.com', qr: await QRCode.toDataURL(downloadUrl, { width: 344, margin: 4 }) }] }] },
    { id: 'notes', type: 'text', title: '观看与保存建议', content: '建议先下载原文件，再在电视或电脑上观看。手机适合随时重温，大屏幕更适合看清画面的层次。\n\n请将这份交付文档与影片一起保存；如需修改，请同时注明影片时间点和具体内容。' },
    { id: 'landscape', type: 'comparisons', title: '横向画面 · 上下对比', layout: 'stacked', comparisons: [{ id: 'wide', number: '01', title: '测试图：检查四边完整、前后顺序与渐变', before: landscapeBefore, after: landscapeAfter }] },
    { id: 'portrait', type: 'comparisons', title: '竖向画面 · 左右对比', layout: 'split', comparisons: [{ id: 'tall', number: '02', title: '测试图：检查竖图比例与标签', before: portraitBefore, after: portraitAfter }] },
    { id: 'signature', type: 'signature', title: '谢谢你们的信任', photographer: '演示摄影师', studio: '行间影像' },
  ],
};
const { browser, dependencies } = await startRenderer();
const report: { template: string; pdfPages?: number; imageSegments: number; bodyFont: string; labelFont: string; dateFont: string; artifacts: string[] }[] = [];
const cards: string[] = [];
const covers: OverlayOptions[] = [];
try {
  for (const [index, template] of TEMPLATES.entries()) {
    display.templateId = template.id;
    const html = renderHtml(display, 'image', fonts);
    const pdfs = await renderTarget(browser, renderHtml(display, 'pdf', fonts), 'pdf', display.output, join(directory, template.id, 'pdf'));
    const images = await renderTarget(browser, html, 'image', display.output, join(directory, template.id, 'image'));
    const page = await browser.newPage({ viewport: { width: 432, height: 768 } });
    let metrics;
    try {
      await page.setContent(html, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      metrics = await page.evaluate(() => {
        return {
          bodyFont: getComputedStyle(document.querySelector('.body-copy')!).fontSize,
          labelFont: getComputedStyle(document.querySelector('.comparison-label')!).fontSize,
          dateFont: getComputedStyle(document.querySelector('.date-value, .archive-ledger > div:nth-child(2) dd')!).fontSize,
        };
      });
    } finally { await page.close(); }
    const cover = await sharp(images[0].path).resize({ width: 300 }).extract({ left: 0, top: 0, width: 300, height: 550 }).png().toBuffer();
    covers.push({ input: cover, left: index * 316 + 16, top: 48 });
    const label = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="32"><text x="0" y="23" font-family="sans-serif" font-size="18" fill="#222">${template.name}</text></svg>`);
    covers.push({ input: label, left: index * 316 + 16, top: 10 });
    const imagePaths = images.map(image => `${template.id}/image/${image.filename}`);
    const pdfPath = `${template.id}/pdf/${pdfs[0].filename}`;
    report.push({ template: template.id, pdfPages: pdfs[0].pages, imageSegments: images.length, ...metrics, artifacts: [pdfPath, ...imagePaths] });
    cards.push(`<article><h2>${escapeHtml(template.name)} · ${escapeHtml(template.label)}</h2><p><a href="${pdfPath}">打开 PDF（${pdfs[0].pages} 页）</a></p>${imagePaths.map((file, segment) => `<a href="${file}">查看长图 ${segment + 1} 原图</a><img src="${file}" alt="${escapeHtml(template.name)} 长图第 ${segment + 1} 段">`).join('')}</article>`);
    console.log(`${template.name}: ${pdfs[0].pages} PDF pages, ${images.length} image segments`);
  }
} finally { await browser.close(); }
await sharp({ create: { width: 1596, height: 614, channels: 3, background: '#eeede8' } }).composite(covers).png().toFile(join(directory, 'template-overview.png'));
await writeFile(join(directory, 'report.json'), JSON.stringify({ generatedAt: new Date().toISOString(), dependencies, fixture: 'Synthetic names, diagnostic charts and example.com link; no real wedding photos.', report }, null, 2));
await writeFile(join(directory, 'index.html'), `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>交付样张 · 五模板视觉检查</title><style>*{box-sizing:border-box}body{margin:0;padding:28px;background:#eeede8;color:#292722;font:16px/1.8 system-ui,sans-serif}h1{font-size:26px}h2{font-size:20px}a{color:#354f43;text-underline-offset:4px}header{max-width:900px;margin-bottom:30px}.samples{display:flex;align-items:start;gap:28px;overflow-x:auto;padding-bottom:24px}article{width:375px;flex:0 0 375px}article img{display:block;width:100%;height:auto;margin-top:16px}article>a{display:block;margin-top:12px}</style><header><h1>同一份交付，五种表达</h1><p>虚构资料与带边框的测试图，用于检查文字、比例、分页和标签；不代表真实照片的调色效果。长图按 375 像素宽展示，横向滚动比较，点击链接打开原文件。二维码指向 example.com 演示地址。</p></header><main class="samples">${cards.join('')}</main></html>`);
console.log(`Visual review: ${directory}`);
