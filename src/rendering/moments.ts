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
 * Highlight strip: one large opening frame, then pairs. Every frame keeps its full composition
 * (contain, never cover). Each row is its own pagination unit so strips can span PDF pages.
 */
export function stillsUnits(block: Stills, templateId: TemplateId, unit: Unit): string[] {
  const attrs = `data-block="${e(block.id)}"`;
  const [first, ...rest] = block.frames;
  if (!first) return [];
  const caption = (index: number, text: string) => `<figcaption class="still-caption"><span class="still-no">${e(frameLabel(templateId, index))}</span>${text ? `<span class="still-text">${e(text)}</span>` : ''}</figcaption>`;
  const units = [unit(`<figure class="still-hero">${photoFrame(first.image, { cap: 380, className: 'still-photo', coverHook: false, alt: first.caption || '高光画面' })}${caption(0, first.caption)}</figure>`, 'stills-unit stills-hero-unit', attrs)];
  for (let index = 0; index < rest.length; index += 2) {
    const pair = rest.slice(index, index + 2);
    const wide = pair.length === 1;
    const cells = pair.map((frame, offset) => `<figure class="still-cell${wide ? ' wide' : ''}"><div class="still-frame"><img src="${frame.image.uri}" width="${frame.image.width}" height="${frame.image.height}" alt="${e(frame.caption || '高光画面')}" /></div>${caption(index + offset + 1, frame.caption)}</figure>`).join('');
    units.push(unit(`<div class="still-row">${cells}</div>`, `stills-unit stills-row-unit${index + 2 >= rest.length ? ' stills-last' : ''}`, attrs));
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
    if (entry.image) parts.push(`<span class="tl-time" aria-hidden="true"></span><span class="tl-rail" aria-hidden="true"></span><div class="tl-body"><figure class="tl-figure"><img src="${entry.image.uri}" width="${entry.image.width}" height="${entry.image.height}" alt="${e(entry.title || '当天时刻')}" /></figure></div>`);
    const last = index === block.entries.length - 1;
    parts.forEach((content, partIndex) => units.push(unit(content, `tl${index === 0 && partIndex === 0 ? ' tl-first' : ''}${last && partIndex === parts.length - 1 ? ' tl-last' : ''}${partIndex === 0 ? ' tl-head' : ''}`, `${attrs}${partIndex < parts.length - 1 ? ' data-keep-next="true"' : ''}`)));
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
  return unit(`<div class="teaser-card">${qr}<span class="teaser-text"><span class="teaser-kicker">Teaser · 先看预告</span><span class="teaser-label">${e(teaser.label)}</span><span class="teaser-host">${e(teaser.host)}</span><span class="teaser-hint">长按识别二维码观看</span></span></div>`, 'teaser-unit', attrs);
}

/** Share card subject: cover first, then the opening highlight, then the first graded After. */
export function shareImage(display: DisplayDocument): DisplayImage | undefined {
  const intro = display.blocks.find(block => block.type === 'intro');
  if (intro?.type === 'intro' && intro.cover?.image) return intro.cover.image;
  const still = display.blocks.flatMap(block => block.type === 'stills' ? block.frames : [])[0]?.image;
  return still ?? display.blocks.flatMap(block => block.type === 'comparisons' ? block.comparisons : []).find(item => item.after)?.after;
}

/**
 * A fixed 432×768 (9:16) card rendered at 2.5× into 1080×1920 for Moments / Xiaohongshu.
 * Hidden in normal reading; the renderer switches `html[data-mode=share]` to capture it.
 */
export function shareCard(display: DisplayDocument, template: TemplateDefinition, brand: string): string {
  const intro = display.blocks.find((block): block is Intro => block.type === 'intro');
  if (!intro) return '';
  const image = shareImage(display);
  const headline = intro.cover?.headline.trim() || (template.id === 'editorial' ? '属于你们的婚礼影像。' : '');
  const teaser = intro.cover?.teaser;
  const initial = Array.from(intro.names?.trim() ?? '')[0] ?? '囍';
  const date = intro.weddingDate?.replaceAll('-', '.');
  const message = intro.cover?.message.trim() ?? '';
  const kicker = ({ editorial: 'A wedding film', cinematic: 'Now showing', archive: 'Delivery record', correspondence: 'A letter for two', gallery: 'Now on view' } as const)[template.id];
  // Frame widths follow each template's mount (margins, mats, paper borders) so nothing is cropped.
  const { width, cap, fill } = ({ editorial: { width: 432, cap: 372, fill: true }, cinematic: { width: 432, cap: 300, fill: true }, archive: { width: 358, cap: 330, fill: false }, correspondence: { width: 332, cap: 320, fill: false }, gallery: { width: 356, cap: 330, fill: false } } as const)[template.id];
  const bands = template.id === 'cinematic' ? '<span class="sc-band sc-band-top" aria-hidden="true"></span><span class="sc-band sc-band-bottom" aria-hidden="true"></span>' : '';
  const photo = image ? `<div class="sc-photo">${photoFrame(image, { cap, width, fill, coverHook: false, alt: '分享卡画面' })}${bands}ORNAMENT</div>` : `<div class="sc-photo sc-photo-empty"><span>${e(template.heroTitle)}</span>ORNAMENT</div>`;
  const foot = teaser?.qr
    ? `<div class="sc-foot sc-teaser"><img src="${teaser.qr}" alt="预告二维码" /><span><b>扫码观看预告</b><i>${e(teaser.label)}</i></span></div>`
    : `<div class="sc-foot"><span>${e(display.tagline || template.heroLabel)}</span></div>`;
  const ornament = template.id === 'correspondence' ? `<span class="sc-seal" aria-hidden="true">${e(initial)}</span>` : template.id === 'archive' ? `<span class="sc-stamp" aria-hidden="true"><i>Delivered</i><b>${e(date ?? 'ARCHIVE')}</b></span>` : '';
  return `<section class="share-card sc-${template.id}" aria-label="分享卡"><div class="sc-top"><span>${brand}</span><span>${e(template.heroLabel)}</span></div>${photo.replace('ORNAMENT', ornament)}<div class="sc-body"><p class="sc-kicker">${e(kicker)}</p><h1 class="sc-names">${e(intro.names || '婚礼影像')}</h1>${headline ? `<p class="sc-headline">${e(headline)}</p>` : ''}${message ? `<p class="sc-message">${e(message)}</p>` : ''}${date ? `<p class="sc-date">${e(date)}</p>` : ''}</div>${foot}</section>`;
}

export const momentsCss = `
.unit.stills-hero-unit{margin:4px -32px 14px;max-width:none}
.still-hero{margin:0}
.still-hero .still-caption{padding:0 32px}
.still-caption{display:flex;gap:10px;align-items:flex-start;padding-top:8px;font-size:12px;line-height:20px;color:var(--muted)}
.still-caption>span{line-height:20px}
.still-no{flex:none;font-family:'Studio Serif',Georgia,serif;font-size:12px;letter-spacing:.06em;color:var(--accent);font-variant-numeric:tabular-nums}
.still-text{min-width:0}
.unit.stills-row-unit{margin:0 0 14px}
.still-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px;align-items:start}
.still-cell{margin:0;min-width:0}
.still-cell.wide{grid-column:span 2}
.still-frame{position:relative;aspect-ratio:3/2;background:var(--panel);overflow:hidden}
.still-cell.wide .still-frame{aspect-ratio:16/9}
.still-frame img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:block}
.unit.stills-last{margin-bottom:22px}

.unit.tl{display:grid;grid-template-columns:70px 22px minmax(0,1fr);margin:0;min-height:0}
.tl-time{font-family:'Studio Serif',Georgia,serif;font-size:19px;line-height:1.3;letter-spacing:.02em;color:var(--foreground);font-variant-numeric:lining-nums tabular-nums;padding-top:1px;overflow-wrap:anywhere}
.tl-rail{position:relative}
.tl-rail:before{content:'';position:absolute;left:10px;top:0;bottom:0;width:1px;background:var(--line)}
.tl-first .tl-rail:before{top:9px}
.tl-last .tl-rail:before{bottom:auto;height:9px}
.tl-first.tl-last .tl-rail:before{display:none}
.tl-dot:after{content:'';position:absolute;left:6px;top:5px;width:9px;height:9px;border-radius:50%;background:var(--background);border:2px solid var(--accent)}
.tl-body{padding:0 0 18px;min-width:0}
.tl-title{margin:0;font-family:var(--display);font-size:18px;line-height:1.45;font-weight:600;color:var(--foreground)}
.tl-note{margin:4px 0 0;font-size:14px;line-height:1.8;color:var(--muted);white-space:pre-wrap}
.tl-figure{margin:2px 0 0;background:var(--panel)}
.tl-figure img{display:block;width:100%;height:auto;max-height:250px;object-fit:contain}
.unit.tl-last .tl-body{padding-bottom:6px}
.unit.tl-last{margin-bottom:22px}

.unit.teaser-unit{margin:4px 0 22px}
.teaser-card{display:flex;align-items:center;gap:16px;padding:14px 16px;background:var(--ticket-bg,var(--panel));border:1px solid var(--ticket-line,var(--line));border-radius:var(--ticket-radius,10px);color:var(--foreground);text-decoration:none}
.teaser-qr{flex:none;width:108px;height:108px;display:block;background:#fff}
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
.sc-top{display:flex;justify-content:space-between;gap:16px;padding:24px 28px 18px;font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:var(--muted)}
.sc-top .brand-logo{max-height:26px}
.sc-photo{position:relative;flex:none}
.sc-photo-empty{height:300px;display:flex;align-items:center;justify-content:center;background:var(--panel);font-family:'Studio Serif',Georgia,serif;font-style:italic;font-size:44px;line-height:1.1;white-space:pre-line;text-align:center;padding:0 30px}
.sc-body{flex:1;min-height:0;display:flex;flex-direction:column;justify-content:center;padding:18px 28px 10px;overflow:hidden}
.sc-body>*{flex:none}
.sc-kicker{margin:0 0 10px;font-size:9px;letter-spacing:.24em;text-transform:uppercase;color:var(--accent)}
.sc-message{margin:12px 0 0;font-size:13px;line-height:1.8;color:var(--muted);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.sc-names{margin:0;font-family:var(--display);font-size:46px;line-height:1.2;font-weight:600;letter-spacing:.02em;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.sc-headline{margin:10px 0 0;font-family:var(--display);font-size:18px;line-height:1.55;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.sc-date{margin:12px 0 0;font-family:'Studio Serif',Georgia,serif;font-size:17px;letter-spacing:.08em;color:var(--muted);font-variant-numeric:lining-nums tabular-nums}
.sc-foot{flex:none;display:flex;align-items:center;gap:14px;margin:0 28px 26px;padding-top:14px;border-top:1px solid var(--line);font-size:11px;letter-spacing:.06em;color:var(--muted);min-height:40px}
.sc-teaser img{width:74px;height:74px;background:#fff;display:block}
.sc-teaser span{display:flex;flex-direction:column;gap:2px}
.sc-teaser b{font-size:14px;letter-spacing:.04em;color:var(--foreground)}
.sc-teaser i{font-style:normal;font-family:var(--display);font-size:13px}
`;

export const momentsTemplateCss: Record<TemplateId, string> = {
  editorial: `
.sc-editorial .sc-body{justify-content:flex-start;padding-top:24px}
.sc-editorial .sc-top{position:absolute;left:0;right:0;top:0;z-index:2;color:rgba(255,255,255,.86)}
.sc-editorial .sc-photo .cv-backdrop:after{background:rgba(0,0,0,.28)}
.sc-editorial .sc-names:after{content:'';display:block;width:34px;height:2px;background:var(--accent);margin-top:18px}
`,
  cinematic: `
.unit.stills-row-unit{margin:0 -32px;padding:22px 32px;background:#0a0b0a;position:relative;max-width:none}
.stills-row-unit:before,.stills-row-unit:after{content:'';position:absolute;left:0;right:0;height:9px;background:repeating-linear-gradient(90deg,transparent 0 7px,#2b2d28 7px 17px,transparent 17px 24px)}
.stills-row-unit:before{top:6px}.stills-row-unit:after{bottom:6px}
.unit.stills-row-unit.stills-last{margin-bottom:24px}
.stills-row-unit .still-frame{background:#000}
.stills-row-unit .still-caption{color:#9a9c90}
.still-no{font-family:'Studio Sans',sans-serif;font-size:9px;letter-spacing:.2em}
.tl-time{font-family:'Studio Sans',sans-serif;font-size:13px;letter-spacing:.16em;color:var(--accent)}
.tl-title{font-weight:400;letter-spacing:.06em}
.sc-cinematic{text-align:center}
.sc-cinematic .sc-top{justify-content:center}
.sc-cinematic .sc-top span:first-child{display:none}
.sc-cinematic .sc-photo{background:#000;padding:30px 0}
.sc-cinematic .sc-photo .cv-photo{background:#000}
.sc-cinematic .sc-photo .cv-backdrop{opacity:.45}
.sc-band{position:absolute;left:16px;right:16px;height:8px;background:repeating-linear-gradient(90deg,transparent 0 7px,#262822 7px 16px)}
.sc-band-top{top:11px}.sc-band-bottom{bottom:11px}
.sc-cinematic .sc-names{font-weight:300;letter-spacing:.16em}
.sc-cinematic .sc-headline{color:var(--accent);letter-spacing:.12em;font-size:16px}
.sc-cinematic .sc-foot{justify-content:center}
`,
  archive: `
.still-frame{background:#1d211e;border:6px solid #f6f4ec;outline:1px solid var(--line)}
.still-no{font-family:'Studio Sans',sans-serif;font-size:9px;letter-spacing:.16em}
.tl-time{font-family:'Studio Sans',sans-serif;font-size:13px;letter-spacing:.08em}
.tl-time:not(:empty):after{content:' HRS';font-size:8px;letter-spacing:.16em;color:var(--muted)}
.tl-dot:after{border-radius:0}
.tl-title{font-family:'Studio Sans',sans-serif;font-size:16px}
.sc-archive .sc-photo{margin:0 28px;padding:9px;background:var(--panel);border:1px solid var(--line)}
.sc-archive .sc-names{font-size:36px}
.sc-stamp{position:absolute;right:-12px;bottom:-34px;width:96px;height:96px;border-radius:50%;border:2px solid var(--accent);box-shadow:inset 0 0 0 4px var(--background),inset 0 0 0 5px var(--accent);color:var(--accent);background:var(--background);display:flex;flex-direction:column;align-items:center;justify-content:center;transform:rotate(-13deg);z-index:2}
.sc-stamp i{font-style:normal;font-size:7px;letter-spacing:.2em;text-transform:uppercase}
.sc-stamp b{font-family:'Studio Serif',Georgia,serif;font-size:13px}
`,
  correspondence: `
.still-cell .still-frame,.still-hero .cv-photo{box-shadow:0 10px 22px -12px rgba(73,53,47,.45)}
.still-cell{background:#fffdf8;padding:8px 8px 4px;box-shadow:0 10px 24px -14px rgba(73,53,47,.5)}
.still-cell:nth-child(odd){transform:rotate(-1.4deg)}.still-cell:nth-child(even){transform:rotate(1.2deg)}
.still-cell .still-caption{font-family:var(--display);color:var(--foreground);font-size:12px}
.still-row{gap:16px;padding:6px 4px}
.tl-time{font-style:italic}
.sc-correspondence .sc-photo{margin:6px auto 0;width:356px;box-sizing:border-box;padding:12px 12px 40px;background:#fffdf8;box-shadow:0 18px 34px -16px rgba(73,53,47,.5);transform:rotate(-2deg)}
.sc-seal{position:absolute;right:-20px;bottom:-22px;width:64px;height:64px;border-radius:50%;background:radial-gradient(circle at 35% 30%,color-mix(in srgb,var(--accent) 70%,#fff) 0,var(--accent) 45%,color-mix(in srgb,var(--accent) 70%,#000) 100%);color:#fff7ef;font-family:var(--display);font-size:26px;font-weight:600;display:flex;align-items:center;justify-content:center;box-shadow:0 5px 12px rgba(73,53,47,.35);z-index:2}
.sc-correspondence .sc-names{font-weight:500}
`,
  gallery: `
.still-frame{background:#0d131a;border:1px solid #3a4855;padding:7px;box-shadow:0 14px 26px -16px rgba(0,0,0,.8)}
.still-frame img{inset:7px;width:calc(100% - 14px);height:calc(100% - 14px)}
.still-no{font-family:'Studio Sans',sans-serif;font-size:9px;letter-spacing:.2em}
.tl-time{color:var(--accent)}
.sc-gallery .sc-photo{margin:0 24px;padding:14px;background:#0d131a;border:1px solid #3a4855;box-shadow:0 26px 44px -18px rgba(0,0,0,.8)}
.sc-gallery{background:radial-gradient(ellipse 70% 40% at 50% 8%,rgba(255,236,206,.16),transparent 100%),var(--background)}
.sc-gallery .sc-names{font-weight:500}
`,
};
