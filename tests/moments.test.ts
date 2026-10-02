import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { createCover, createProject, createStillFrame, createTimelineEntry } from '../src/shared/defaults.js';
import type { AssetRef, AssetVersion, IntroBlock, ProjectRecord, StillsBlock, StudioSettings, TimelineBlock } from '../src/shared/model.js';
import type { StudioStore } from '../src/server/contracts.js';
import { digest, prepareDisplay, visibleAssetRefs, type DisplayDocument, type DisplayImage } from '../src/rendering/display.js';
import { renderHtml } from '../src/rendering/html.js';
import { shareCollage, shareImage } from '../src/rendering/moments.js';
import { checkGlyphCoverage } from '../src/rendering/fonts.js';
import { StudioError } from '../src/domain/errors.js';
import { TEMPLATE_IDS } from '../src/shared/templates.js';

const settings: StudioSettings = { tenantId: 'studio-test', studioName: '行间影像', photographerName: 'ZH', tagline: '为真实的情绪留一份底片。', accent: '#9a805f', timezone: 'Asia/Shanghai' };
const NO_FONTS = { css: '', hashes: {}, issues: [] };

function sample(): ProjectRecord {
  const result = createProject({ title: 'PRIVATE_PROJECT_TITLE', presetId: 'blank', settings });
  result.document.fields.coupleNames.value = '林与陈'; result.document.fields.weddingDate.value = '2026-09-19';
  result.internalNotes = 'NEVER_RENDER_PRIVATE_NOTE'; result.draftRevision = 1;
  return result;
}

class MemoryStore implements StudioStore {
  records = new Map<string, unknown>(); paths = new Map<string, { path: string; version: AssetVersion }>();
  constructor(public dataDir: string, public current: ProjectRecord, public studioSettings: StudioSettings = structuredClone(settings)) {}
  getProject(id: string) { if (id !== this.current.id) throw new StudioError('PROJECT_NOT_FOUND', '项目不存在。', 404); return structuredClone(this.current); }
  listProjects() { return []; }
  saveProject(project: ProjectRecord) { this.current = structuredClone(project); return this.getProject(project.id); }
  getSettings() { return structuredClone(this.studioSettings); }
  saveSettings(value: StudioSettings) { this.studioSettings = structuredClone(value); return this.getSettings(); }
  listPresets() { return []; }
  assetPath(_projectId: string, versionId: string) { const value = this.paths.get(versionId); if (!value) throw new Error('missing'); return value; }
  putRecord<T>(kind: string, id: string, value: T) { this.records.set(`${kind}:${id}`, structuredClone(value)); }
  getRecord<T>(kind: string, id: string) { return structuredClone(this.records.get(`${kind}:${id}`)) as T | undefined; }
  listRecords<T>(kind: string) { return [...this.records.entries()].filter(([key]) => key.startsWith(`${kind}:`)).map(([, value]) => structuredClone(value) as T); }
}

const COLOURS = ['#828e88', '#b5bd98', '#8d7b66', '#a08a70', '#6f7954'];
async function addAsset(store: MemoryStore, directory: string, index: number, width = 1200, height = 800): Promise<AssetRef> {
  const bytes = await sharp({ create: { width, height, channels: 3, background: COLOURS[index % COLOURS.length] } }).png().toBuffer();
  const location = path.join(directory, `moment-${index}.png`); await writeFile(location, bytes);
  const id = `asset-${index}`; const versionId = `version-${index}`;
  const version: AssetVersion = { id: versionId, hash: digest(bytes), derivativeHash: digest(bytes), filename: `moment-${index}.png`, width, height, mime: 'image/png', byteSize: bytes.length, storageKey: location, originalStorageKey: location, createdAt: new Date().toISOString() };
  store.current.assets.push({ id, tenantId: settings.tenantId, projectId: store.current.id, rootId: 'root', relativePath: `moment-${index}.png`, versions: [version], latestVersionId: versionId });
  store.paths.set(versionId, { path: location, version });
  return { assetId: id, versionId };
}

function introOf(project: ProjectRecord): IntroBlock {
  const intro = project.document.blocks.find(block => block.type === 'intro');
  if (intro?.type !== 'intro') throw new Error('Missing intro');
  return intro;
}

function stillsBlock(id: string, frames: { image: AssetRef | null; caption?: string; visible?: boolean }[]): StillsBlock {
  return { id, type: 'stills', title: '那天的高光', visible: true, order: 1, frames: frames.map((frame, order) => ({ ...createStillFrame(), id: `${id}-f${order}`, order, image: frame.image, caption: frame.caption ?? '', visible: frame.visible ?? true })) };
}

function timelineBlock(id: string, entries: { time: string; title: string; note?: string; image?: AssetRef | null; visible?: boolean }[]): TimelineBlock {
  return { id, type: 'timeline', title: '这一天', visible: true, order: 2, entries: entries.map((entry, order) => ({ ...createTimelineEntry(entry.time, entry.title), id: `${id}-e${order}`, order, note: entry.note ?? '', image: entry.image ?? null, visible: entry.visible ?? true })) };
}

const still = (tag: string, width = 1600, height = 900): DisplayImage => ({ uri: `data:image/jpeg;base64,${tag}`, width, height });
const LONG_NOTE = '傍晚的光线落在礼堂的长椅上，宾客陆续入座，新人在门外最后一次整理礼服。'.repeat(6) + 'LONG_NOTE_END';
const count = (value: string, pattern: RegExp) => value.match(pattern)?.length ?? 0;
const markupOf = (html: string) => html.slice(html.indexOf('<body'));

function momentsDisplay(templateId: DisplayDocument['templateId'] = 'editorial'): DisplayDocument {
  return {
    templateId, accent: '#a78964', tagline: '', studio: '行间影像', output: sample().document.output,
    blocks: [
      { type: 'intro', id: 'intro', title: '封面', names: '林与陈', weddingDate: '2026-09-19', cover: { emphasis: 'photo', headline: 'COVER_HEADLINE', message: '', image: still('COVER'), teaser: { label: 'TEASER_LABEL', url: 'https://example.com/films/teaser', host: 'example.com', qr: 'data:image/png;base64,QR' } } },
      { type: 'stills', id: 'stills', title: '那天的高光', frames: [
        { id: 'f1', caption: 'FRAME_ONE', image: still('F1') },
        { id: 'f2', caption: 'FRAME_TWO', image: still('F2') },
        { id: 'f3', caption: 'FRAME_THREE', image: still('F3', 900, 1350) },
        { id: 'f4', caption: 'FRAME_FOUR', image: still('F4') },
      ] },
      { type: 'timeline', id: 'day', title: '这一天', entries: [
        { id: 'e1', time: '09:30', title: '清晨准备', note: '' },
        { id: 'e2', time: '18:00', title: '婚礼仪式', note: LONG_NOTE, image: still('TL') },
      ] },
      { type: 'signature', id: 'sig', title: '谢谢', photographer: 'ZH' },
    ],
  };
}

test('long image renders the teaser QR, stills strip, timeline rail and exactly one share card', () => {
  assert.ok(Array.from(LONG_NOTE).length > 150);
  const html = renderHtml(momentsDisplay(), 'image', NO_FONTS);
  const markup = markupOf(html);

  assert.ok(markup.includes('<img class="teaser-qr" src="data:image/png;base64,QR"'));
  assert.ok(markup.includes('TEASER_LABEL') && markup.includes('example.com'));
  assert.ok(!markup.includes('teaser-link'), 'long images carry a QR, not a clickable link');
  const teaserAt = markup.indexOf('class="unit teaser-unit"');
  assert.ok(teaserAt > markup.indexOf('cv-cover'), 'teaser follows the cover');
  assert.ok(teaserAt < markup.indexOf('class="unit chapter'), 'teaser precedes the first chapter');

  assert.equal(count(markup, /<section class="share-card /g), 1);
  assert.ok(markup.indexOf('<section class="share-card') > markup.indexOf('</main>'), 'share card lives outside the reading flow');

  // 4 frames → hero + one pair + one wide single.
  assert.equal(count(markup, /class="unit stills-unit stills-hero-unit[ "]/g), 1);
  assert.equal(count(markup, /<figure class="still-hero /g), 1);
  assert.equal(count(markup, /<div class="still-row[ "]/g), 2);
  assert.equal(count(markup, /<figure class="still-cell" style="flex:/g), 2, 'paired frames share one height through their own aspect ratios');
  assert.equal(count(markup, /<figure class="still-cell wide">/g), 1);
  assert.ok(!/aspect-ratio:3\/2/.test(markup), 'no fixed 3:2 frame: pictures keep their own ratio');
  const rows = markup.split('<div class="still-row').slice(1).map(row => row.slice(0, row.indexOf('</div></div>') + 1));
  assert.equal(count(rows[0], /class="still-cell"/g), 2);
  assert.ok(rows[0].includes('base64,F2') && rows[0].includes('base64,F3'));
  assert.ok(rows[1].includes('still-cell wide') && rows[1].includes('base64,F4'));
  assert.ok(markup.indexOf('FRAME_ONE') < markup.indexOf('FRAME_TWO') && markup.indexOf('FRAME_THREE') < markup.indexOf('FRAME_FOUR'));
  assert.equal(count(markup, /stills-last/g), 1);
  assert.ok(markup.includes('class="unit stills-unit stills-row-unit stills-last"'), 'the final row closes the strip');

  assert.ok(markup.includes('<span class="tl-time">09:30</span>'));
  assert.ok(markup.includes('<h3 class="tl-title">清晨准备</h3>'));
  assert.equal(count(markup, /tl-first/g), 1);
  assert.equal(count(markup, /tl-last/g), 1);
  assert.equal(count(markup, /tl-head/g), 2);
  assert.ok(markup.includes('LONG_NOTE_END'), 'long notes are never truncated');
  assert.ok(count(markup, /<p class="tl-note">/g) >= 2, 'a long note is split into continuation units');
  assert.equal(count(markup, /class="tl-figure[ "]/g), 1);
  const lastUnit = markup.slice(markup.indexOf('tl-last'));
  assert.ok(lastUnit.slice(0, lastUnit.indexOf('</div></div>')).includes('base64,TL'), 'the entry image is the final timeline unit');

  assert.equal(count(markup, /class="story-photo /g), 1, 'only the cover carries the cover hook');
});

test('PDF renders the teaser as a real link and never contains the share card', () => {
  const html = renderHtml(momentsDisplay(), 'pdf', NO_FONTS);
  const markup = markupOf(html);
  assert.ok(markup.includes('<a class="teaser-card teaser-link" href="https://example.com/films/teaser"'));
  assert.ok(!markup.includes('teaser-qr'));
  assert.ok(!markup.includes('share-card'));
  assert.ok(!markup.includes('分享卡'));
  assert.equal(count(markup, /stills-last/g), 1);
  assert.equal(count(markup, /tl-last/g), 1);
  assert.equal(count(markup, /class="story-photo /g), 1);
});

test('every template renders its own share card on long images only', () => {
  for (const templateId of TEMPLATE_IDS) {
    const image = markupOf(renderHtml(momentsDisplay(templateId), 'image', NO_FONTS));
    assert.equal(count(image, /<section class="share-card /g), 1, templateId);
    assert.ok(image.includes(`<section class="share-card sc-${templateId}"`), templateId);
    assert.ok(image.includes('扫码观看预告'), `${templateId}: teaser QR is placed on the card`);
    assert.equal(count(image, /class="story-photo /g), 1, `${templateId}: only the cover carries the cover hook`);
    const pdf = markupOf(renderHtml(momentsDisplay(templateId), 'pdf', NO_FONTS));
    assert.ok(!pdf.includes('share-card'), templateId);
  }
});

test('shareImage prefers the cover, then the first still, then the first graded After', () => {
  const base = momentsDisplay();
  assert.equal(shareImage(base)?.uri, 'data:image/jpeg;base64,COVER');

  const noCover = structuredClone(base);
  const intro = noCover.blocks[0];
  if (intro.type !== 'intro' || !intro.cover) throw new Error('fixture');
  delete intro.cover.image;
  noCover.blocks.push({ type: 'comparisons', id: 'pairs', title: '画面', layout: 'stacked', comparisons: [{ id: 'p1', title: 'P', number: '01', before: still('B1'), after: still('A1') }] });
  assert.equal(shareImage(noCover)?.uri, 'data:image/jpeg;base64,F1');

  const noStills = structuredClone(noCover);
  noStills.blocks = noStills.blocks.filter(block => block.type !== 'stills');
  noStills.blocks.push({ type: 'comparisons', id: 'more', title: '更多', layout: 'stacked', comparisons: [
    { id: 'missing', title: 'M', number: '01', before: still('B0') },
    { id: 'p2', title: 'Q', number: '02', before: still('B2'), after: still('A2') },
  ] });
  assert.equal(shareImage(noStills)?.uri, 'data:image/jpeg;base64,A1');

  const missingFirstAfter = structuredClone(noStills);
  missingFirstAfter.blocks = missingFirstAfter.blocks.filter(block => block.id !== 'pairs');
  assert.equal(shareImage(missingFirstAfter)?.uri, 'data:image/jpeg;base64,A2', 'comparisons without an After are skipped');

  const empty = structuredClone(missingFirstAfter);
  empty.blocks = empty.blocks.filter(block => block.type === 'intro');
  assert.equal(shareImage(empty), undefined);
  const html = markupOf(renderHtml(empty, 'image', NO_FONTS));
  assert.ok(html.includes('sc-photo sc-photo-empty'), 'a card without any picture falls back to the template title');
});

test('share card composes a collage from visible, distinct, non-Before images only when the main picture is landscape', () => {
  const base = momentsDisplay();
  base.blocks.push({ type: 'comparisons', id: 'pairs', title: '画面', layout: 'stacked', comparisons: [{ id: 'p1', title: 'P', number: '01', before: still('BEFORE1'), after: still('AFTER1') }] });
  const collage = shareCollage(base)!;
  assert.equal(collage.length, 3);
  assert.equal(collage[0].uri, shareImage(base)!.uri, 'the main picture is the share image');
  assert.equal(new Set(collage.map(image => image.uri)).size, 3, 'no duplicates');
  assert.ok(collage.every(image => !image.uri.includes('BEFORE')), 'never a Before image');
  const visible = ['COVER', 'F1', 'F2', 'F3', 'F4', 'AFTER1'].map(tag => `data:image/jpeg;base64,${tag}`);
  assert.ok(collage.every(image => visible.includes(image.uri)), 'only images already visible in the document');
  const markup = markupOf(renderHtml(base, 'image', NO_FONTS));
  const card = markup.slice(markup.indexOf('<section class="share-card'));
  assert.ok(card.includes('data-layout="collage"'));
  assert.equal(count(card, /class="sc-shot /g), 3);
  assert.ok(!card.includes('cv-backdrop'), 'no blurred fill around the collage');
  assert.ok([...card.matchAll(/style="width:(\d+)px/g)].every(match => Number(match[1]) <= 432), 'nothing wider than the card');

  // The cover reused as a still is not counted twice; only one distinct extra → no collage.
  const fewer = structuredClone(base);
  fewer.blocks = fewer.blocks.filter(block => block.type !== 'comparisons');
  const stills = fewer.blocks.find(block => block.type === 'stills');
  if (stills?.type !== 'stills') throw new Error('fixture');
  stills.frames = [{ id: 'c', caption: '', image: still('COVER') }, { id: 'x', caption: '', image: still('F1') }, { id: 'y', caption: '', image: still('F1') }];
  assert.equal(shareCollage(fewer), undefined);

  const none = structuredClone(fewer);
  none.blocks = none.blocks.filter(block => block.type === 'intro');
  assert.equal(shareCollage(none), undefined);
  const single = markupOf(renderHtml(none, 'image', NO_FONTS));
  assert.ok(single.includes('data-layout="single"') && count(single, /class="sc-shot /g) === 1);

  const portrait = structuredClone(base);
  const intro = portrait.blocks[0];
  if (intro.type !== 'intro' || !intro.cover) throw new Error('fixture');
  intro.cover.image = still('PORTRAIT', 900, 1350);
  assert.equal(shareCollage(portrait), undefined, 'a portrait main picture keeps a single frame');
});

test('prepareDisplay reports missing, few and too many stills; visible frame images become dependencies', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'wds-moments-stills-')); t.after(() => rm(directory, { recursive: true, force: true }));
  const store = new MemoryStore(directory, sample());
  const refs = [await addAsset(store, directory, 0), await addAsset(store, directory, 1), await addAsset(store, directory, 2)];

  const few = stillsBlock('few', [{ image: refs[0], caption: 'ONE' }, { image: null, caption: 'TWO' }, { image: refs[2], visible: false }]);
  store.current.document.blocks.push(few);
  let prepared = await prepareDisplay(store.current, store, '2026-09-26');
  const missing = prepared.issues.filter(issue => issue.code === 'STILL_IMAGE_MISSING');
  assert.equal(missing.length, 1);
  assert.equal(missing[0].severity, 'error'); assert.equal(missing[0].blockId, 'few');
  assert.ok(missing[0].message.includes('第 2 张'));
  const fewIssue = prepared.issues.find(issue => issue.code === 'STILLS_FEW');
  assert.equal(fewIssue?.severity, 'warning'); assert.equal(fewIssue?.blockId, 'few');
  assert.ok(!prepared.issues.some(issue => issue.code === 'STILLS_TOO_MANY' || issue.code === 'STILLS_EMPTY'));
  const stills = prepared.display.blocks.find(block => block.type === 'stills');
  assert.ok(stills?.type === 'stills');
  assert.deepEqual(stills.frames.map(frame => frame.caption), ['ONE']);
  assert.ok(stills.frames[0].image.uri.startsWith('data:image/jpeg;base64,'));
  assert.ok(stills.frames[0].image.backdrop?.startsWith('data:image/jpeg;base64,'), 'the opening frame gets a blurred fill');
  assert.deepEqual(visibleAssetRefs(store.current), [refs[0]], 'hidden frames are not dependencies');
  assert.deepEqual(prepared.assets.map(asset => asset.versionId), ['version-0']);

  few.frames.forEach(frame => { frame.visible = false; });
  prepared = await prepareDisplay(store.current, store, '2026-09-26');
  assert.equal(prepared.issues.find(issue => issue.code === 'STILLS_EMPTY')?.severity, 'error');
  assert.ok(!prepared.issues.some(issue => issue.code === 'STILLS_FEW'));
  assert.ok(!renderHtml(prepared.display, 'image', NO_FONTS).includes('stills-hero-unit"'), 'an empty strip renders no chapter');

  few.visible = false;
  const many = stillsBlock('many', Array.from({ length: 10 }, (_, index) => ({ image: refs[index % refs.length], caption: `FRAME_${index}` })));
  store.current.document.blocks.push(many);
  prepared = await prepareDisplay(store.current, store, '2026-09-26');
  const tooMany = prepared.issues.find(issue => issue.code === 'STILLS_TOO_MANY');
  assert.equal(tooMany?.severity, 'error'); assert.equal(tooMany?.blockId, 'many');
  assert.ok(!prepared.issues.some(issue => issue.code === 'STILLS_FEW' || issue.code === 'STILL_IMAGE_MISSING' || issue.code === 'STILLS_EMPTY'));
  assert.equal(prepared.assets.length, 3);

  many.frames[9].visible = false;
  prepared = await prepareDisplay(store.current, store, '2026-09-26');
  assert.ok(!prepared.issues.some(issue => issue.code.startsWith('STILL')), JSON.stringify(prepared.issues));
});

test('prepareDisplay validates timeline entries and includes entry images', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'wds-moments-timeline-')); t.after(() => rm(directory, { recursive: true, force: true }));
  const store = new MemoryStore(directory, sample());
  const ref = await addAsset(store, directory, 0);
  const hiddenRef = await addAsset(store, directory, 1);
  const timeline = timelineBlock('day', [
    { time: ' 09:30 ', title: '清晨准备', note: 'NOTE', image: ref },
    { time: '  ', title: '', note: 'only a note' },
    { time: '', title: '傍晚' },
    { time: '21:00', title: 'HIDDEN', image: hiddenRef, visible: false },
  ]);
  store.current.document.blocks.push(timeline);
  let prepared = await prepareDisplay(store.current, store, '2026-09-26');
  const empty = prepared.issues.filter(issue => issue.code === 'TIMELINE_ENTRY_EMPTY');
  assert.equal(empty.length, 1);
  assert.equal(empty[0].severity, 'error'); assert.equal(empty[0].blockId, 'day');
  assert.ok(empty[0].message.includes('第 2 个'));
  const display = prepared.display.blocks.find(block => block.type === 'timeline');
  assert.ok(display?.type === 'timeline');
  assert.deepEqual(display.entries.map(entry => [entry.time, entry.title]), [['09:30', '清晨准备'], ['', ''], ['', '傍晚']]);
  assert.ok(display.entries[0].image?.uri.startsWith('data:image/jpeg;base64,'));
  assert.deepEqual(prepared.assets.map(asset => asset.versionId), ['version-0']);
  assert.deepEqual(visibleAssetRefs(store.current), [ref]);

  timeline.entries.forEach(entry => { entry.visible = false; });
  prepared = await prepareDisplay(store.current, store, '2026-09-26');
  assert.equal(prepared.issues.find(issue => issue.code === 'TIMELINE_EMPTY')?.severity, 'error');
  assert.ok(!prepared.issues.some(issue => issue.code === 'TIMELINE_ENTRY_EMPTY'));
  assert.equal(prepared.assets.length, 0);
});

test('cover teaser links are validated, receive a QR code and require link confirmation', async () => {
  const project = sample();
  const intro = introOf(project);
  const store = new MemoryStore('/tmp/unused', project);

  // prepareDisplay does not run the document schema, so an unsafe URL can reach it directly.
  intro.cover = { ...createCover(), teaser: { url: 'javascript:alert(1)', label: '预告' } };
  let prepared = await prepareDisplay(project, store, '2026-09-26');
  const invalid = prepared.issues.find(issue => issue.code === 'LINK_INVALID');
  assert.equal(invalid?.severity, 'error'); assert.equal(invalid?.blockId, intro.id);
  let cover = prepared.display.blocks.find(block => block.type === 'intro');
  assert.ok(cover?.type === 'intro' && cover.cover && cover.cover.teaser === undefined);
  assert.ok(!prepared.issues.some(issue => issue.code === 'LINKS_UNVERIFIED'));
  assert.ok(!renderHtml(prepared.display, 'pdf', NO_FONTS).includes('javascript:'));

  intro.cover.teaser = { url: 'https://example.com/films/teaser', label: '  ' };
  prepared = await prepareDisplay(project, store, '2026-09-26');
  assert.ok(!prepared.issues.some(issue => issue.code === 'LINK_INVALID' || issue.code === 'QR_UNREADABLE'));
  cover = prepared.display.blocks.find(block => block.type === 'intro');
  assert.ok(cover?.type === 'intro');
  const teaser = cover.cover?.teaser;
  assert.ok(teaser && teaser.qr?.startsWith('data:image/png'));
  assert.equal(teaser.url, 'https://example.com/films/teaser');
  assert.equal(teaser.host, 'example.com');
  assert.equal(teaser.label, '先看预告片', 'a blank label falls back to the default');
  assert.equal(prepared.issues.find(issue => issue.code === 'LINKS_UNVERIFIED')?.severity, 'warning');
  assert.ok(markupOf(renderHtml(prepared.display, 'image', NO_FONTS)).includes(`<img class="teaser-qr" src="${teaser.qr}"`));

  intro.cover.teaser = { url: '   ', label: '预告' };
  prepared = await prepareDisplay(project, store, '2026-09-26');
  cover = prepared.display.blocks.find(block => block.type === 'intro');
  assert.ok(cover?.type === 'intro' && cover.cover?.teaser === undefined, 'a blank teaser URL means no teaser');
  assert.ok(!prepared.issues.some(issue => issue.code === 'LINKS_UNVERIFIED' || issue.code === 'LINK_INVALID'));
});

test('glyph coverage checks stills captions, timeline text and the teaser label', async () => {
  const unsupported = String.fromCodePoint(0x10ffff);
  const clean = momentsDisplay();
  assert.deepEqual(await checkGlyphCoverage(clean, process.cwd()), []);

  const caption = structuredClone(clean);
  const stills = caption.blocks.find(block => block.type === 'stills');
  if (stills?.type !== 'stills') throw new Error('fixture');
  stills.frames[2].caption = `画面${unsupported}`;
  let issues = await checkGlyphCoverage(caption, process.cwd());
  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, 'FONT_GLYPH_MISSING'); assert.equal(issues[0].blockId, 'stills');
  assert.ok(issues[0].message.includes('U+10FFFF'));

  for (const field of ['time', 'title', 'note'] as const) {
    const timeline = structuredClone(clean);
    const block = timeline.blocks.find(item => item.type === 'timeline');
    if (block?.type !== 'timeline') throw new Error('fixture');
    block.entries[1][field] = `X${unsupported}`;
    issues = await checkGlyphCoverage(timeline, process.cwd());
    assert.ok(issues.some(issue => issue.code === 'FONT_GLYPH_MISSING' && issue.blockId === 'day'), field);
  }

  const teaser = structuredClone(clean);
  const intro = teaser.blocks[0];
  if (intro.type !== 'intro' || !intro.cover?.teaser) throw new Error('fixture');
  intro.cover.teaser.label = `预告${unsupported}`;
  issues = await checkGlyphCoverage(teaser, process.cwd());
  assert.ok(issues.some(issue => issue.code === 'FONT_GLYPH_MISSING' && issue.blockId === 'intro'));
});
