import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { BUILTIN_PRESETS } from '../src/shared/defaults.js';
import { busyness, type DisplayDocument, type DisplayImage } from '../src/rendering/display.js';
import { finaleImage } from '../src/rendering/components.js';
import { renderHtml } from '../src/rendering/html.js';
import { TEMPLATE_IDS } from '../src/shared/templates.js';

const NO_FONTS = { css: '', hashes: {}, issues: [] };
const image = (tag: string, busy?: number, width = 1600, height = 900): DisplayImage => ({ uri: `data:image/jpeg;base64,${tag}`, width, height, busy });
const markupOf = (html: string) => html.slice(html.indexOf('<body'));
const count = (text: string, pattern: RegExp) => text.match(pattern)?.length ?? 0;

function display(comparisons: { id: string; before: DisplayImage; after: DisplayImage; description?: string }[], stills: DisplayImage[] = []): DisplayDocument {
  return {
    templateId: 'editorial', accent: '#a78964', tagline: '', studio: '行间影像', output: { imageWidth: 1080, segmentHeight: 6000, allowImageSegments: true, allowComparisonPageBreak: false },
    blocks: [
      { type: 'intro', id: 'intro', title: '封面', names: '林与陈', weddingDate: '2026-09-19', cover: { emphasis: 'photo', headline: '', message: '', image: image('COVER', 0.1) } },
      ...(stills.length ? [{ type: 'stills' as const, id: 'stills', title: '高光', frames: stills.map((still, index) => ({ id: `f${index}`, caption: '', image: still })) }] : []),
      { type: 'comparisons', id: 'pairs', title: '画面', layout: 'split', comparisons: comparisons.map((pair, index) => ({ ...pair, title: `PAIR_${pair.id}`, number: String(index + 1).padStart(2, '0') })) },
      { type: 'signature', id: 'sig', title: '谢谢', photographer: 'ZH' },
    ],
  } as DisplayDocument;
}

test('busyness separates a calm gradient from a crowded, high-frequency picture', async () => {
  const calm = await sharp({ create: { width: 320, height: 180, channels: 3, background: '#d8c7b8' } }).png().toBuffer();
  const noise = Buffer.alloc(320 * 180 * 3); for (let y = 0; y < 180; y++) for (let x = 0; x < 320; x++) noise.fill((Math.floor(x / 10) + Math.floor(y / 10)) % 2 ? 235 : 20, (y * 320 + x) * 3, (y * 320 + x) * 3 + 3);
  const crowded = await sharp(noise, { raw: { width: 320, height: 180, channels: 3 } }).png().toBuffer();
  const [low, high] = [await busyness(calm), await busyness(crowded)];
  assert.ok(low < 0.05, `calm ${low}`); assert.ok(high > 0.5, `crowded ${high}`);
});

test('the closing picture is the calmest visible graded picture that is not the cover', () => {
  const doc = display([
    { id: 'a', before: image('B1'), after: image('CROWD', 0.62) },
    { id: 'b', before: image('B2'), after: image('CALM', 0.18) },
    { id: 'c', before: image('B3'), after: image('LATE_BUSY', 0.55) },
  ], [image('STILL_MID', 0.3)]);
  assert.equal(finaleImage(doc)?.uri, 'data:image/jpeg;base64,CALM');
  const html = renderHtml(doc, 'image', NO_FONTS);
  const finale = html.slice(html.indexOf('class="unit finale-unit"'), html.indexOf('class="unit signature"'));
  assert.ok(finale.includes('base64,CALM') && finale.includes('class="finale-copy"'));
  assert.ok(!finale.includes('finale-overlay'), 'closing words sit below the picture, never over it');
  assert.ok(html.includes('class="unit signature" data-block="sig" data-after-finale="true"'));
  assert.ok(/class="unit finale-unit" data-fit="true" data-keep-next="true"/.test(html), 'finale and signature stay on one PDF page');
});

test('the revealed pair is not listed again; a single pair shows in full without a reveal', () => {
  const pairs = [
    { id: 'one', before: image('B1'), after: image('A1'), description: 'REVEAL_WORDS' },
    { id: 'two', before: image('B2'), after: image('A2') },
    { id: 'three', before: image('B3'), after: image('A3') },
  ];
  for (const templateId of TEMPLATE_IDS) {
    const markup = markupOf(renderHtml({ ...display(pairs), templateId }, 'image', NO_FONTS));
    assert.equal(count(markup, /class="unit reveal-unit"/g), 1, templateId);
    assert.equal(count(markup, /data-comparison="one"/g), 0, `${templateId}: revealed pair listed again`);
    assert.equal(count(markup, /class="unit comparison-unit"/g), 2, templateId);
    assert.ok(markup.indexOf('REVEAL_WORDS') > markup.indexOf('reveal-unit') && markup.indexOf('REVEAL_WORDS') < markup.indexOf('data-comparison="two"'));
    assert.ok(!markup.includes('comparison-label') && !markup.includes('原始画面</span>'), 'Before/After is a corner tag, not a repeated caption row');
  }
  const single = markupOf(renderHtml(display([pairs[0]]), 'image', NO_FONTS));
  assert.ok(!single.includes('reveal-unit') && single.includes('data-comparison="one"'));
});

test('new projects open comparisons side by side', () => {
  for (const preset of BUILTIN_PRESETS) assert.equal(preset.comparisonLayout, 'split', preset.id);
});

test('highlight frames keep their own ratio and hide the lone number when there is no caption', () => {
  const frames = [image('H', 0.2), image('P', 0.2, 900, 1350), image('W', 0.2, 1600, 900)];
  for (const templateId of TEMPLATE_IDS) {
    const markup = markupOf(renderHtml({ ...display([], frames), templateId }, 'image', NO_FONTS));
    assert.ok(markup.includes('aspect-ratio:900/1350') && markup.includes('aspect-ratio:1600/900'), templateId);
    assert.equal(count(markup, /class="still-no"/g), 0, `${templateId}: no caption → no orphan number`);
  }
});

test('text chapter captions follow the chapter content instead of a blanket "Production notes"', async () => {
  const { textCaption } = await import('../src/rendering/html.js');
  const { CONTENT_LIBRARY } = await import('../src/shared/defaults.js');
  const expected: Record<string, string> = { 'log-workflow': 'Production notes', 'skin-refinement': 'Production notes', 'narrative-audio': 'Production notes', viewing: 'How to watch', revisions: 'Revisions' };
  for (const item of CONTENT_LIBRARY) {
    const block = { type: 'text' as const, id: item.id, title: item.title, content: item.content };
    assert.equal(textCaption({ ...block, source: item.id }), expected[item.id], `${item.id} by source`);
    assert.equal(textCaption(block), expected[item.id], `${item.id} by wording`);
  }
  assert.equal(textCaption({ type: 'text', id: 'x', title: '认真观看，好好保存。', content: '先下载原文件，再开始观看。' }), 'How to watch');
  assert.equal(textCaption({ type: 'text', id: 'y', title: '还有想调整的细节？', content: '请在收到后整理修改清单并反馈。' }), 'Revisions');
  assert.equal(textCaption({ type: 'text', id: 'z', title: '写给你们', content: '谢谢你们邀请我们见证这一天。' }), '', 'unknown chapters carry no caption');
  const html = renderHtml({ ...display([]), blocks: [...display([]).blocks, { type: 'text', id: 'letter', title: '写给你们', content: '谢谢你们邀请我们见证这一天。' }] } as DisplayDocument, 'image', NO_FONTS);
  const letter = html.slice(html.indexOf('data-block="letter"') - 400, html.indexOf('data-block="letter"'));
  assert.ok(!html.slice(html.indexOf('写给你们</h2>'), html.indexOf('写给你们</h2>') + 60).includes('chapter-caption'), letter);
});

test('the closing line stays with the signature so it never lands alone on a last page', () => {
  const html = renderHtml({ ...display([{ id: 'a', before: image('B1'), after: image('A1', 0.2) }]), tagline: 'CLOSING_LINE' }, 'pdf', NO_FONTS);
  assert.ok(html.includes('class="unit signature" data-block="sig" data-after-finale="true" data-keep-next="true"'));
  assert.ok(html.indexOf('class="unit signature"') < html.indexOf('CLOSING_LINE'));
});
