import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { loadFonts, type DisplayDocument } from '../src/rendering/display.js';
import { renderHtml } from '../src/rendering/html.js';
import { startRenderer } from '../src/rendering/engine.js';
import { TEMPLATE_IDS } from '../src/shared/templates.js';

const directory = resolve('public/template-previews');
await mkdir(directory, { recursive: true });
const fonts = await loadFonts(process.cwd());
if (fonts.issues.length) throw new Error(JSON.stringify(fonts.issues));
const { browser } = await startRenderer();
try {
  for (const templateId of TEMPLATE_IDS) {
    const display: DisplayDocument = {
      templateId, accent: '#78806d', tagline: '', studio: 'YOUR STUDIO',
      output: { mode: 'both', imageWidth: 1080, segmentHeight: 12000, allowImageSegments: true, allowComparisonPageBreak: true },
      blocks: [{ id: 'cover', type: 'intro', title: '婚礼影像', names: '林岚 & 周屿', weddingDate: '2026-09-12', deliveryDate: '2026-09-28' }],
    };
    const page = await browser.newPage({ viewport: { width: 432, height: 650 } });
    try {
      await page.setContent(renderHtml(display, 'image', fonts), { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      await sharp(await page.screenshot()).resize(324).png().toFile(resolve(directory, `${templateId}.png`));
    } finally { await page.close(); }
    console.log(`Template preview: ${templateId}`);
  }
} finally { await browser.close(); }
