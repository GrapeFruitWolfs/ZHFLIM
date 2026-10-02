import type { OutputTarget, TemplateId } from '../shared/model.js';
import { escapeHtml as e, type DisplayBlock, type DisplayDocument, type DisplayImage, type DisplayLink } from './display.js';
import { photoFrame } from './covers.js';
import { textChunks } from './text.js';
import type { TemplateDefinition } from './templates.js';

type Unit = (content: string, className?: string, attributes?: string) => string;
type Stills = Extract<DisplayBlock, { type: 'stills' }>;
type Timeline = Extract<DisplayBlock, { type: 'timeline' }>;
type Intro = Extract<DisplayBlock, { type: 'intro' }>;

const frameLabel = (templateId: TemplateId, index: number) => {
  const n = String(index + 1).padStart(2, '0');
  return templateId === 'archive' ? `FR. ${n}` : templateId === 'cinematic' ? `${n}A` : templateId === 'correspondence' ? `No. ${index + 1}` : n;
};

/**
 * Highlight strip: one opening frame, then justified pairs. Every frame keeps its own aspect ratio
 * (no letterbox bands, no cropping); paired frames share one height. Rows are separate pagination
 * units so strips can span PDF pages, and `.fit-box` lets the PDF paginator shrink them slightly.
 */
export function stillsUnits(block: Stills, templateId: TemplateId, unit: Unit): string[] {
  const attrs = `data-block="${e(block.id)}" data-fit="true"`;
  const [first, ...rest] = block.frames;
  if (!first) return [];
  const caption = (index: number, text: string) => text ? `<figcaption class="still-caption"><span class="still-no">${e(frameLabel(templateId, index))}</span><span class="still-text">${e(text)}</span></figcaption>` : '';
  const img = (frame: Stills['frames'][number]) => `<img src="${frame.image.uri}" width="${frame.image.width}" height="${frame.image.height}" alt="${e(frame.caption || '高光画面')}" />`;
  const ratio = (frame: Stills['frames'][number]) => frame.image.width / frame.image.height;
  // A lone frame never grows taller than this, so portraits stay a calm size.
  const single = (frame: Stills['frames'][number], cap: number) => `<div class="still-frame fit-box" style="aspect-ratio:${frame.image.width}/${frame.image.height};width:min(100%,${Math.round(cap * ratio(frame))}px)">${img(frame)}</div>`;
  const hero = templateId === 'editorial'
    ? `<figure class="still-hero bleed">${photoFrame(first.image, { cap: 380, className: 'still-photo fit-box', coverHook: false, alt: first.caption || '高光画面' })}${caption(0, first.caption)}</figure>`
    : `<figure class="still-hero framed">${single(first, 400)}${caption(0, first.caption)}</figure>`;
  const units = [unit(hero, `stills-unit stills-hero-unit${templateId === 'editorial' ? ' bleed' : ''}`, attrs)];
  for (let index = 0; index < rest.length; index += 2) {
    const pair = rest.slice(index, index + 2);
    const cells = pair.length === 1
      ? `<figure class="still-cell wide">${single(pair[0], 300)}${caption(index + 1, pair[0].caption)}</figure>`
      : pair.map((frame, offset) => `<figure class="still-cell" style="flex:${ratio(frame).toFixed(4)} 1 0">${`<div class="still-frame" style="aspect-ratio:${frame.image.width}/${frame.image.height}">${img(frame)}</div>`}${caption(index + offset + 1, frame.caption)}</figure>`).join('');
    units.push(unit(`<div class="still-row${pair.length === 1 ? ' single' : ' fit-box'}">${cells}</div>`, `stills-unit stills-row-unit${index + 2 >= rest.length ? ' stills-last' : ''}`, attrs));
  }
  if (!rest.length) units[0] = units[0].replace('stills-hero-unit', 'stills-hero-unit stills-last');
  return units;
}

/** A vertical rail of moments. Long notes and pictures become separate units that continue the rail. */
export function timelineUnits(block: Timeline, templateId: TemplateId, unit: Unit): string[] {
  const attrs = `data-block="${e(block.id)}"`;
  const units: string[] = [];
  block.entries.forEach((entry, index) => {
    const parts: string[] = [];
    const chunks = textChunks(entry.note, 150).filter(chunk => chunk.trim());
    const time = entry.time ? `<span class="tl-time">${e(entry.time)}</span>` : '<span class="tl-time tl-time-empty" aria-hidden="true"></span>';
    parts.push(`${time}<span class="tl-rail tl-dot" aria-hidden="true"></span><div class="tl-body">${entry.title ? `<h3 class="tl-title">${e(entry.title)}</h3>` : ''}${chunks[0] ? `<p class="tl-note">${e(chunks[0])}</p>` : ''}</div>`);
    for (const chunk of chunks.slice(1)) parts.push(`<span class="tl-time" aria-hidden="true"></span><span class="tl-rail" aria-hidden="true"></span><div class="tl-body"><p class="tl-note">${e(chunk)}</p></div>`);
    if (entry.image) parts.push(`<span class="tl-time" aria-hidden="true"></span><span class="tl-rail" aria-hidden="true"></span><div class="tl-body"><figure class="tl-figure fit-box"><img src="${entry.image.uri}" width="${entry.image.width}" height="${entry.image.height}" alt="${e(entry.title || '当天时刻')}" /></figure></div>`);
    const last = index === block.entries.length - 1;
    parts.forEach((content, partIndex) => units.push(unit(content, `tl${index === 0 && partIndex === 0 ? ' tl-first' : ''}${last && partIndex === parts.length - 1 ? ' tl-last' : ''}${partIndex === 0 ? ' tl-head' : ''}`, `${attrs} data-fit="true"${partIndex < parts.length - 1 ? ' data-keep-next="true"' : ''}`)));
  });
  return units;
}

/** Teaser right under the cover: a scannable QR on long images, a real link in PDFs. */
export function teaserUnit(intro: Intro, target: OutputTarget, unit: Unit): string {
  const teaser = intro.cover?.teaser;
  if (!teaser) return '';
  const attrs = `data-block="${e(intro.id)}"`;
  if (target === 'pdf') {
    return unit(`<a class="teaser-card teaser-link" href="${e(teaser.url)}" target="_blank" rel="noreferrer noopener"><span class="teaser-play" aria-hidden="true"></span><span class="teaser-text"><span class="teaser-kicker">Teaser · 先看预告</span><span class="teaser-label">${e(teaser.label)}</span><span class="teaser-host">${e(teaser.host)} ↗</span></span></a>`, 'teaser-unit', attrs);
  }
  const qr = teaser.qr ? `<img class="teaser-qr" src="${teaser.qr}" alt="${e(teaser.label)}二维码" />` : '<div class="teaser-qr missing-image">请更换稳定分享链接</div>';
  return unit(`<div class="teaser-card"><span class="teaser-stub">${qr}</span><span class="teaser-text"><span class="teaser-kicker">Teaser · 先看预告</span><span class="teaser-label">${e(teaser.label)}</span><span class="teaser-host">${e(teaser.host)}</span><span class="teaser-hint">长按识别二维码观看</span></span></div>`, 'teaser-unit', attrs);
}

/** Share card subject: cover first, then the opening highlight, then the first graded After. */
export function shareImage(display: DisplayDocument): DisplayImage | undefined {
  const intro = display.blocks.find(block => block.type === 'intro');
  if (intro?.type === 'intro' && intro.cover?.image) return intro.cover.image;
  const still = display.blocks.flatMap(block => block.type === 'stills' ? block.frames : [])[0]?.image;
  return still ?? display.blocks.flatMap(block => block.type === 'comparisons' ? block.comparisons : []).find(item => item.after)?.after;
}

/**
 * Share card collage: a landscape main picture plus two smaller, distinct pictures that are already
 * visible in the document (cover, highlight stills, graded Afters — never a Before), de-duplicated
 * by uri. Returns undefined when the main picture is not landscape or fewer than two extras exist.
 */
export function shareCollage(display: DisplayDocument): DisplayImage[] | undefined {
  const main = shareImage(display);
  if (!main || main.width <= main.height) return undefined;
  const intro = display.blocks.find(block => block.type === 'intro');
  const pool = [
    intro?.type === 'intro' ? intro.cover?.image : undefined,
    ...display.blocks.flatMap(block => block.type === 'stills' ? block.frames.map(frame => frame.image) : []),
    ...display.blocks.flatMap(block => block.type === 'comparisons' ? block.comparisons.map(item => item.after) : []),
  ];
  const seen = new Set([main.uri]);
  const extras: DisplayImage[] = [];
  for (const image of pool) if (image && !seen.has(image.uri)) { seen.add(image.uri); extras.push(image); }
  if (extras.length < 2) return undefined;
  // Among the first few candidates, the two calmest ones read best at a small size; keep document order.
  const picked = extras.slice(0, 4).map((image, index) => ({ image, index })).sort((a, b) => (a.image.busy ?? .5) - (b.image.busy ?? .5) || a.index - b.index).slice(0, 2).sort((a, b) => a.index - b.index);
  return [main, ...picked.map(item => item.image)];
}

/** Per-template mount geometry of the share card, in CSS px of the 432×768 card. */
const SHARE_MOUNT: Record<TemplateId, { main: number; row: number; gap: number; chrome: number; stack: number; cap: number }> = {
  // main: picture width of the large frame; row: total width available to the small row (incl. chrome);
  // gap: between the small frames and above the row; chrome: horizontal mat/border per small frame;
  // stack: max picture height of main + row; cap: max height of a lone (portrait) picture.
  editorial: { main: 432, row: 432, gap: 6, chrome: 0, stack: 380, cap: 340 },
  cinematic: { main: 392, row: 392, gap: 6, chrome: 0, stack: 330, cap: 296 },
  archive: { main: 356, row: 356, gap: 8, chrome: 0, stack: 300, cap: 300 },
  correspondence: { main: 318, row: 372, gap: 18, chrome: 16, stack: 290, cap: 296 },
  gallery: { main: 352, row: 384, gap: 18, chrome: 18, stack: 300, cap: 306 },
};

const shareShot = (image: DisplayImage, width: number, height: number, className: string) => `<div class="sc-shot ${className}" style="width:${width}px;height:${height}px"><img src="${image.uri}" width="${image.width}" height="${image.height}" alt="分享卡画面" /></div>`;

/** Every picture keeps its own aspect ratio and is sized exactly to its frame: no crop, no fill. */
function sharePhotos(images: DisplayImage[], templateId: TemplateId): string {
  const mount = SHARE_MOUNT[templateId];
  const ratio = (image: DisplayImage) => image.width / image.height;
  const [main, ...small] = images;
  if (small.length < 2) {
    const width = Math.round(Math.min(mount.main, mount.cap * ratio(main)));
    return shareShot(main, width, Math.round(width / ratio(main)), 'sc-main');
  }
  const rowInner = mount.row - mount.gap - mount.chrome * 2;
  let mainWidth = mount.main;
  let rowHeight = Math.min(rowInner / (ratio(small[0]) + ratio(small[1])), mount.main / ratio(main) * .62);
  const total = mainWidth / ratio(main) + rowHeight;
  const scale = Math.min(1, (mount.stack - mount.gap) / total);
  mainWidth *= scale; rowHeight *= scale;
  const shots = small.map((image, index) => shareShot(image, Math.round(rowHeight * ratio(image)), Math.round(rowHeight), `sc-small sc-small-${index + 1}`)).join('');
  return `${shareShot(main, Math.round(mainWidth), Math.round(mainWidth / ratio(main)), 'sc-main')}<div class="sc-row" style="gap:${mount.gap}px;margin-top:${mount.gap}px">${shots}</div>`;
}

/**
 * A fixed 432×768 (9:16) card rendered at 2.5× into 1080×1920 for Moments / Xiaohongshu.
 * Hidden in normal reading; the renderer switches `html[data-mode=share]` to capture it.
 * `data-layout`: `collage` (landscape main + two small pictures), `single` (one wide picture, larger
 * type fills the remaining space), `tall` (one portrait/squarish picture sized to its frame, compact type)
 * or `empty` (no picture: the template title stands in, larger type).
 */
export function shareCard(display: DisplayDocument, template: TemplateDefinition, brand: string): string {
  const intro = display.blocks.find((block): block is Intro => block.type === 'intro');
  if (!intro) return '';
  const image = shareImage(display);
  const collage = shareCollage(display);
  const layout = collage ? 'collage' : !image ? 'empty' : image.width / image.height >= 1.45 ? 'single' : 'tall';
  const headline = intro.cover?.headline.trim() || (template.id === 'editorial' ? '属于你们的婚礼影像。' : '');
  const teaser = intro.cover?.teaser;
  const initial = Array.from(intro.names?.trim() ?? '')[0] ?? '囍';
  const date = intro.weddingDate?.replaceAll('-', '.');
  const message = intro.cover?.message.trim() ?? '';
  const kicker = ({ editorial: 'A wedding film', cinematic: 'Now showing', archive: 'Delivery record', correspondence: 'A letter for two', gallery: 'Now on view' } as const)[template.id];
  const bands = template.id === 'cinematic' ? '<span class="sc-band sc-band-top" aria-hidden="true"></span><span class="sc-band sc-band-bottom" aria-hidden="true"></span>' : '';
  const ornament = template.id === 'correspondence' ? `<span class="sc-seal" aria-hidden="true">${e(initial)}</span>` : template.id === 'archive' ? `<span class="sc-stamp" aria-hidden="true"><i>Delivered</i><b>${e(date ?? 'ARCHIVE')}</b></span>` : '';
  const caption = template.id === 'archive' && image ? `<div class="sc-caption"><span>${collage ? 'FIG. 01 — 03' : 'FIG. 01'} · Selected stills</span><span>${e(date ?? '')}</span></div>` : '';
  const photo = image
    ? `<div class="sc-photo">${sharePhotos(collage ?? [image], template.id)}${caption}${bands}${ornament}</div>`
    : `<div class="sc-photo sc-photo-empty"><span>${e(template.heroTitle)}</span>${ornament}</div>`;
  const foot = teaser?.qr
    ? `<div class="sc-foot sc-teaser"><img src="${teaser.qr}" alt="预告二维码" /><span><b>扫码观看预告</b><i>${e(teaser.label)}</i></span></div>`
    : `<div class="sc-foot"><span>${e(display.tagline || template.heroLabel)}</span></div>`;
  return `<section class="share-card sc-${template.id}" data-layout="${layout}" aria-label="分享卡"><div class="sc-top"><span class="sc-brand">${brand}</span><span class="sc-label">${e(template.heroLabel)}</span></div>${photo}<div class="sc-body"><p class="sc-kicker">${e(kicker)}</p><h1 class="sc-names">${e(intro.names || '婚礼影像')}</h1>${headline ? `<p class="sc-headline">${e(headline)}</p>` : ''}${message ? `<p class="sc-message">${e(message)}</p>` : ''}${date ? `<p class="sc-date">${e(date)}</p>` : ''}</div>${foot}</section>`;
}

export const momentsCss = `
.unit.stills-hero-unit{margin:4px 0 16px}
.unit.stills-hero-unit.bleed{margin:4px -32px 16px;max-width:none}
.still-hero{margin:0}
.still-hero.bleed .still-caption{padding:0 32px}
.still-hero.framed .still-frame{margin:0 auto}
.still-caption{display:flex;gap:10px;align-items:flex-start;padding-top:8px;font-size:12px;line-height:20px;color:var(--muted)}
.still-caption>span{line-height:20px}
.still-no{flex:none;font-family:'Studio Serif',Georgia,serif;font-size:12px;letter-spacing:.06em;color:var(--accent);font-variant-numeric:tabular-nums}
.still-text{min-width:0}
.unit.stills-row-unit{margin:0 0 16px}
.still-row{display:flex;gap:12px;align-items:flex-start;margin:0 auto}
.still-cell{margin:0;min-width:0}
.still-cell.wide{flex:1;display:flex;flex-direction:column;align-items:center}
.still-cell.wide .still-caption{align-self:stretch}
.still-frame{position:relative;box-sizing:border-box;width:100%;background:var(--panel);overflow:hidden}
.still-frame img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:block}
.unit.stills-last{margin-bottom:22px}

.unit.tl{display:grid;grid-template-columns:64px 34px minmax(0,1fr);margin:0;min-height:0}
.tl-time{font-family:'Studio Serif',Georgia,serif;font-size:19px;line-height:1.3;letter-spacing:.02em;color:var(--foreground);font-variant-numeric:lining-nums tabular-nums;padding-top:1px;overflow-wrap:anywhere}
.tl-rail{position:relative}
.tl-rail:before{content:'';position:absolute;left:12px;top:0;bottom:0;width:1px;background:var(--line)}
.tl-first .tl-rail:before{top:9px}
.tl-last .tl-rail:before{bottom:auto;height:9px}
.tl-first.tl-last .tl-rail:before{display:none}
.tl-dot:after{content:'';position:absolute;left:6px;top:6px;width:9px;height:9px;border-radius:50%;background:var(--background);border:2px solid var(--accent)}
.tl-body{padding:0 0 18px;min-width:0}
.tl-title{margin:0;font-family:var(--display);font-size:18px;line-height:1.45;font-weight:600;color:var(--foreground)}
.tl-note{margin:4px 0 0;font-size:14px;line-height:1.8;color:var(--muted);white-space:pre-wrap}
.tl-figure{margin:2px 0 0;background:var(--panel)}
.tl-figure img{display:block;width:100%;height:auto;max-height:250px;object-fit:contain}
.unit.tl-last .tl-body{padding-bottom:6px}
.unit.tl-last{margin-bottom:22px}

.unit.teaser-unit{margin:4px 0 22px}
.teaser-card{display:flex;align-items:center;gap:16px;padding:14px 16px;background:var(--ticket-bg,var(--panel));border:1px solid var(--ticket-line,var(--line));border-radius:var(--ticket-radius,10px);color:var(--foreground);text-decoration:none}
.teaser-stub{flex:none;display:block;line-height:0}
.teaser-qr{flex:none;width:84px;height:84px;display:block;background:#fff}
.teaser-qr.missing-image{line-height:1.4;padding:10px 6px;box-sizing:border-box}
.teaser-play{flex:none;width:46px;height:46px;border-radius:50%;background:var(--accent);position:relative}
.teaser-play:after{content:'';position:absolute;left:18px;top:14px;border-left:14px solid #fff;border-top:9px solid transparent;border-bottom:9px solid transparent}
.teaser-text{display:flex;flex-direction:column;gap:3px;min-width:0}
.teaser-kicker{font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:var(--accent)}
.teaser-label{font-family:var(--display);font-size:18px;line-height:1.4;font-weight:600}
.teaser-host{font-size:11px;color:var(--muted);overflow-wrap:anywhere}
.teaser-hint{font-size:11px;color:var(--muted)}

.share-card{display:none}
html[data-mode=share] .render-root{display:none}
html[data-mode=share],html[data-mode=share] body{background:var(--background)}
html[data-mode=share] .share-card{display:flex}
.share-card{position:relative;width:432px;height:768px;overflow:hidden;flex-direction:column;background:var(--background);color:var(--foreground)}
.sc-top{flex:none;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:22px 28px 16px;font-size:11px;line-height:1.4;letter-spacing:.16em;text-transform:uppercase;color:var(--foreground)}
.sc-top>span{min-width:0;overflow-wrap:anywhere}
.sc-brand{font-weight:600}
.sc-brand .brand-name{max-width:none}
.sc-label{font-size:10px;letter-spacing:.2em;color:var(--muted);text-align:right}
.sc-top .brand-logo{max-height:28px;max-width:150px}
.sc-photo{position:relative;flex:none;display:flex;flex-direction:column;align-items:center;max-width:100%}
.sc-shot{position:relative;flex:none;box-sizing:content-box;background:var(--panel)}
.sc-shot img{display:block;width:100%;height:100%;object-fit:contain}
.sc-row{display:flex;justify-content:center;align-items:flex-start;max-width:100%}
.sc-photo-empty{height:260px;justify-content:center;background:var(--panel);font-family:'Studio Serif',Georgia,serif;font-style:italic;font-size:40px;line-height:1.1;white-space:pre-line;text-align:center;padding:0 30px}
.sc-body{flex:1;min-height:0;display:flex;flex-direction:column;justify-content:safe center;padding:14px 28px;overflow:hidden}
.sc-body>*{flex:none}
.sc-kicker{margin:0 0 10px;font-size:10px;line-height:1.4;letter-spacing:.24em;text-transform:uppercase;color:var(--accent)}
.sc-names{margin:0;font-family:var(--display);font-size:42px;line-height:1.18;font-weight:600;letter-spacing:.02em;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.sc-headline{margin:10px 0 0;font-family:var(--display);font-size:17px;line-height:1.55;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.sc-message{margin:8px 0 0;font-size:13px;line-height:1.75;color:var(--muted);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.sc-date{margin:12px 0 0;font-family:'Studio Serif',Georgia,serif;font-size:17px;line-height:1.4;letter-spacing:.08em;color:var(--muted);font-variant-numeric:lining-nums tabular-nums}
.share-card:is([data-layout=single],[data-layout=empty]) .sc-kicker{font-size:11px;margin-bottom:14px}
.share-card:is([data-layout=single],[data-layout=empty]) .sc-names{font-size:56px;line-height:1.15}
.share-card:is([data-layout=single],[data-layout=empty]) .sc-headline{font-size:21px;margin-top:16px}
.share-card:is([data-layout=single],[data-layout=empty]) .sc-message{font-size:14.5px;line-height:1.8;margin-top:12px;-webkit-line-clamp:3}
.share-card:is([data-layout=single],[data-layout=empty]) .sc-date{font-size:22px;margin-top:20px}
.sc-foot{flex:none;display:flex;align-items:center;gap:14px;margin:0 28px 24px;padding-top:14px;border-top:1px solid var(--line);font-size:11px;letter-spacing:.06em;color:var(--muted);min-height:40px}
.sc-teaser img{width:72px;height:72px;background:#fff;display:block}
.sc-teaser span{display:flex;flex-direction:column;gap:2px}
.sc-teaser b{font-size:14px;letter-spacing:.04em;color:var(--foreground)}
.sc-teaser i{font-style:normal;font-family:var(--display);font-size:13px}
`;

export const momentsTemplateCss: Record<TemplateId, string> = {
  editorial: `
.sc-editorial .sc-top{border-bottom:1px solid var(--foreground);margin:0 28px 18px;padding:22px 0 12px}
.sc-editorial .sc-shot{background:var(--panel)}
.sc-editorial .sc-photo-empty{font-family:var(--display);font-style:normal;font-size:34px;line-height:1.3}
.sc-editorial .sc-names:after{content:'';display:block;width:34px;height:2px;background:var(--accent);margin-top:14px}
.sc-editorial:is([data-layout=single],[data-layout=empty]) .sc-names:after{width:44px;margin-top:20px}

.teaser-card{background:transparent;border:0;border-top:1px solid var(--foreground);border-bottom:1px solid var(--line);border-radius:0;padding:14px 0;gap:18px}
.teaser-kicker{letter-spacing:.24em}`,
  cinematic: `
.unit.stills-unit,.unit.stills-hero-unit{margin:0 -32px;padding:24px 32px 22px;background:#0a0b0a;position:relative;max-width:none}
.unit.stills-hero-unit{margin-top:6px}
.stills-unit:before,.stills-unit:after{content:'';position:absolute;left:0;right:0;height:9px;background:repeating-linear-gradient(90deg,transparent 0 7px,#2b2d28 7px 17px,transparent 17px 24px)}
.stills-unit:before{top:7px}.stills-unit:after{bottom:7px}
.unit.stills-unit.stills-last{margin-bottom:26px}
.stills-unit .still-frame{background:#000}
.stills-unit .still-caption{color:#9a9c90}
.still-no{font-family:'Studio Sans',sans-serif;font-size:9px;letter-spacing:.2em}
.tl-time{font-family:'Studio Sans',sans-serif;font-size:13px;letter-spacing:.16em;color:var(--accent)}
.tl-title{font-weight:400;letter-spacing:.06em}
.sc-cinematic{text-align:center}
.sc-cinematic .sc-top{justify-content:center}
.sc-cinematic .sc-top{flex-direction:column;gap:4px;padding:18px 28px 12px}
.sc-cinematic .sc-brand{font-size:12px;letter-spacing:.3em;font-weight:500}
.sc-cinematic .sc-label{text-align:center;font-size:9px;letter-spacing:.34em}
.sc-cinematic .sc-photo{align-self:stretch;background:#000;padding:26px 0}
.sc-cinematic .sc-shot{background:#000}
.sc-band{position:absolute;left:16px;right:16px;height:8px;background:repeating-linear-gradient(90deg,transparent 0 7px,#34372f 7px 16px)}
.sc-band-top{top:9px}.sc-band-bottom{bottom:9px}
.sc-cinematic .sc-kicker{letter-spacing:.34em}
.sc-cinematic .sc-names{font-weight:300;letter-spacing:.16em}
.sc-cinematic .sc-headline{color:var(--accent);letter-spacing:.12em;font-size:16px}
.sc-cinematic:is([data-layout=single],[data-layout=empty]) .sc-headline{font-size:18px}
.sc-cinematic .sc-foot{justify-content:center}

.teaser-card{padding:0;gap:0;align-items:stretch;border-radius:3px;overflow:hidden}
.teaser-card .teaser-text{flex:1;padding:16px 18px;justify-content:center}
.teaser-card .teaser-stub{order:2;position:relative;display:flex;align-items:center;padding:12px 14px;border-left:1px dashed var(--line);background:color-mix(in srgb,var(--accent) 10%,transparent)}
.teaser-card .teaser-qr{width:78px;height:78px}
.teaser-kicker{font-family:'Studio Sans',sans-serif;letter-spacing:.3em}
.teaser-label{font-weight:400;letter-spacing:.06em}
.teaser-card.teaser-link{padding:14px 16px;gap:16px}`,
  archive: `
.still-frame{background:#f6f4ec;border:6px solid #f6f4ec;outline:1px solid var(--line);outline-offset:0}
.still-row{gap:16px}
.still-no{font-family:'Studio Sans',sans-serif;font-size:9px;letter-spacing:.16em}
.tl-time{font-family:'Studio Sans',sans-serif;font-size:13px;letter-spacing:.08em}
.tl-time:not(:empty):after{content:' HRS';font-size:8px;letter-spacing:.16em;color:var(--muted)}
.tl-dot:after{border-radius:0}
.tl-title{font-family:'Studio Sans',sans-serif;font-size:16px}
.sc-archive .sc-top{border-top:1px solid var(--foreground);margin:18px 28px 14px;padding:10px 0 0}
.sc-archive .sc-photo{margin:0 28px;padding:9px 9px 0;background:var(--panel);border:1px solid var(--line)}
.sc-archive .sc-shot{background:#1d211e}
.sc-caption{align-self:stretch;display:flex;justify-content:space-between;gap:12px;padding:8px 0 9px;font-size:8px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);font-variant-numeric:tabular-nums}
.sc-archive .sc-body{padding-top:44px}
.sc-archive .sc-names{font-size:38px}
.sc-archive:is([data-layout=single],[data-layout=empty]) .sc-names{font-size:50px}
.sc-archive .sc-date:before{content:'Wedding day';font-family:'Studio Sans',sans-serif;font-size:9px;letter-spacing:.2em;text-transform:uppercase;margin-right:14px;vertical-align:.25em}
.sc-stamp{position:absolute;right:-12px;bottom:-40px;width:96px;height:96px;border-radius:50%;border:2px solid var(--accent);box-shadow:inset 0 0 0 4px var(--background),inset 0 0 0 5px var(--accent);color:var(--accent);background:var(--background);display:flex;flex-direction:column;align-items:center;justify-content:center;transform:rotate(-13deg);z-index:2}
.sc-stamp i{font-style:normal;font-size:7px;letter-spacing:.2em;text-transform:uppercase}
.sc-stamp b{font-family:'Studio Serif',Georgia,serif;font-size:13px}

.teaser-card{position:relative;border-radius:0;padding:14px 16px 14px 38px;gap:16px}
.teaser-card:before{content:'';position:absolute;left:13px;top:50%;width:10px;height:10px;margin-top:-6px;border-radius:50%;border:1px solid var(--ticket-line);background:var(--background)}
.teaser-card .teaser-qr{width:80px;height:80px;outline:1px solid var(--ticket-line)}
.teaser-kicker{font-family:'Studio Sans',sans-serif;letter-spacing:.22em;color:var(--foreground)}
.teaser-label{font-family:'Studio Sans',var(--display),sans-serif;font-size:16px}`,
  correspondence: `
.still-cell{background:#fffdf8;padding:8px 8px 4px;box-shadow:0 10px 24px -14px rgba(73,53,47,.5)}
.still-cell.wide{background:transparent;padding:0;box-shadow:none;transform:none!important}
.still-cell.wide .still-frame,.still-hero.framed .still-frame{background:#fffdf8;border:10px solid #fffdf8;border-bottom-width:30px;box-shadow:0 14px 26px -14px rgba(73,53,47,.5)}
.still-hero.framed .still-frame{transform:rotate(-.5deg)}
.still-hero.framed .still-caption,.still-cell.wide .still-caption{font-family:var(--display);color:var(--foreground)}
.still-cell:nth-child(odd){transform:rotate(-1.4deg)}.still-cell:nth-child(even){transform:rotate(1.2deg)}
.still-cell .still-caption{font-family:var(--display);color:var(--foreground);font-size:12px}
.still-row{gap:16px;padding:6px 4px}
.tl-time{font-style:italic}
.sc-correspondence .sc-photo{align-self:center;margin-top:4px}
.sc-correspondence .sc-shot{padding:12px 12px 34px;background:#fffdf8;box-shadow:0 1px 1px rgba(73,53,47,.08),0 16px 30px -14px rgba(73,53,47,.45)}
.sc-correspondence .sc-shot img{background:#efe6dc}
.sc-correspondence .sc-main{transform:rotate(-1.6deg)}
.sc-correspondence .sc-small{padding:8px 8px 20px}
.sc-correspondence .sc-small-1{transform:rotate(-2.6deg)}
.sc-correspondence .sc-small-2{transform:rotate(2.2deg) translateY(6px)}
.sc-correspondence .sc-body{padding-left:34px;padding-right:34px}
.sc-seal{position:absolute;right:-6px;top:-14px;width:64px;height:64px;border-radius:50%;background:radial-gradient(circle at 35% 30%,color-mix(in srgb,var(--accent) 70%,#fff) 0,var(--accent) 45%,color-mix(in srgb,var(--accent) 70%,#000) 100%);color:#fff7ef;font-family:var(--display);font-size:26px;font-weight:600;display:flex;align-items:center;justify-content:center;box-shadow:0 5px 12px rgba(73,53,47,.35);z-index:2}
.sc-correspondence .sc-names{font-weight:500}

.teaser-card{background:transparent;border:0;border-radius:0;padding:4px 0 4px 4px;gap:20px}
.teaser-card .teaser-stub{padding:7px;background:#fffdf8;border:2px dashed color-mix(in srgb,var(--accent) 45%,transparent);box-shadow:0 8px 18px -12px rgba(73,53,47,.55);transform:rotate(-2deg)}
.teaser-card .teaser-qr{width:76px;height:76px}
.teaser-kicker{font-family:'Studio Serif',Georgia,serif;font-style:italic;text-transform:none;letter-spacing:.02em;font-size:13px}`,
  gallery: `
.still-frame{background:#0d131a;border:1px solid #3a4855;padding:7px;box-shadow:0 14px 26px -16px rgba(0,0,0,.8)}
.still-hero.framed .still-frame{padding:10px}
.still-hero.framed .still-frame img{inset:10px;width:calc(100% - 20px);height:calc(100% - 20px)}
.still-frame img{inset:7px;width:calc(100% - 14px);height:calc(100% - 14px)}
.still-no{font-family:'Studio Sans',sans-serif;font-size:9px;letter-spacing:.2em}
.tl-time{color:var(--accent)}
.sc-gallery .sc-top{padding-bottom:18px}
.sc-gallery .sc-label{color:var(--accent)}
.sc-gallery .sc-shot{padding:14px;background:#0d131a;border:1px solid #3a4855;box-shadow:0 26px 44px -18px rgba(0,0,0,.8),0 0 0 4px #121a22}
.sc-gallery .sc-small{padding:8px;box-shadow:0 18px 30px -16px rgba(0,0,0,.8)}
.sc-gallery{background:radial-gradient(ellipse 70% 40% at 50% 14%,rgba(255,236,206,.16),transparent 100%),var(--background)}
.sc-gallery .sc-kicker{color:var(--accent)}
.sc-gallery .sc-names:after{content:'';display:block;width:34px;height:2px;background:var(--accent);margin-top:14px}
.sc-gallery .sc-names{font-weight:500}

.teaser-card{background:transparent;border:0;border-left:2px solid var(--accent);border-radius:0;padding:4px 0 4px 16px;gap:16px}
.teaser-card .teaser-stub{order:2;margin-left:auto;padding:5px;background:#fff}
.teaser-card .teaser-qr{width:72px;height:72px}
.teaser-label{font-weight:500}`,
};
