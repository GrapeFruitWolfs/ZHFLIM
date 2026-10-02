import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { loadFonts, type DisplayDocument, type DisplayImage } from '../src/rendering/display.js';
import { renderHtml } from '../src/rendering/html.js';
import { startRenderer } from '../src/rendering/engine.js';
import { TEMPLATE_IDS } from '../src/shared/templates.js';

/**
 * Template cards must match real output, which almost always has a cover photograph. Customer
 * pictures are never bundled, so a synthetic warm-light frame stands in for the cover still.
 */
async function sampleStill(): Promise<DisplayImage> {
  const bokeh = Array.from({ length: 34 }, (_, index) => {
    const x = (index * 397) % 1600; const y = 120 + ((index * 233) % 520); const r = 18 + ((index * 37) % 64);
    const hue = ['#ffe2b0', '#ffd39a', '#fff0d2', '#f6c58c', '#ffe9c7'][index % 5];
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${hue}" opacity="${0.18 + (index % 4) * 0.09}"/>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b2f2a"/><stop offset=".55" stop-color="#8a6a52"/><stop offset="1" stop-color="#2a2420"/></linearGradient><radialGradient id="glow" cx=".5" cy=".42" r=".5"><stop offset="0" stop-color="#ffe8c4" stop-opacity=".85"/><stop offset="1" stop-color="#ffe8c4" stop-opacity="0"/></radialGradient><filter id="soft"><feGaussianBlur stdDeviation="9"/></filter></defs><rect width="1600" height="900" fill="url(#sky)"/><rect width="1600" height="900" fill="url(#glow)"/><g filter="url(#soft)">${bokeh}</g><path d="M0 760 Q400 700 800 735 T1600 720 V900 H0Z" fill="#1c1916" opacity=".85"/><g fill="#191512" opacity=".92"><ellipse cx="760" cy="690" rx="44" ry="120"/><circle cx="760" cy="548" r="30"/><path d="M820 820 Q850 600 880 560 Q905 540 930 560 Q960 600 990 820Z" fill="#f4ede2" opacity=".9"/><circle cx="905" cy="530" r="28"/></g></svg>`;
  const bytes = await sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toBuffer();
  const backdrop = await sharp(bytes).resize(64).blur(1.6).jpeg({ quality: 72 }).toBuffer();
  return { uri: `data:image/jpeg;base64,${bytes.toString('base64')}`, width: 1600, height: 900, backdrop: `data:image/jpeg;base64,${backdrop.toString('base64')}` };
}

const directory = resolve('public/template-previews');
await mkdir(directory, { recursive: true });
const fonts = await loadFonts(process.cwd());
if (fonts.issues.length) throw new Error(JSON.stringify(fonts.issues));
const image = await sampleStill();
const { browser } = await startRenderer();
try {
  for (const templateId of TEMPLATE_IDS) {
    const display: DisplayDocument = {
      templateId, accent: '#a78964', tagline: '', studio: 'YOUR STUDIO',
      output: { mode: 'both', imageWidth: 1080, segmentHeight: 12000, allowImageSegments: true, allowComparisonPageBreak: true },
      blocks: [
        { id: 'cover', type: 'intro', title: '婚礼影像', names: '林岚 & 周屿', weddingDate: '2026-09-12', deliveryDate: '2026-09-28', cover: { emphasis: 'photo', headline: '这一天，值得一次次重温。', message: '', image } },
        { id: 'signature', type: 'signature', title: '谢谢你的信任', photographer: 'ZH', studio: 'YOUR STUDIO' },
      ],
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
