import type { TemplateId } from '../shared/model.js';
import { escapeHtml as e, type DisplayBlock, type DisplayDocument, type DisplayImage } from './display.js';
import type { TemplateDefinition } from './templates.js';

type Intro = Extract<DisplayBlock, { type: 'intro' }>;

/**
 * Covers are the first screen a couple sees. Every template has its own composition with and
 * without a photograph; covers never crop the photograph itself. When a frame is taller than the
 * picture, a blurred copy fills the remaining space.
 *
 * Stable hooks used by tests and the workbench: `.story-cover`, `.photo-first|.names-first`,
 * `.story-photo img`, `.archive-ledger`, `.letter-opening`, `.gallery-poster`.
 */
const BLEED = 432;
const CONTENT = 368;
const dot = (date?: string) => date ? e(date.replaceAll('-', '.')) : '';

export function photoFrame(photo: DisplayImage, options: { cap: number; width?: number; className?: string; inner?: string; alt?: string; coverHook?: boolean; fill?: boolean }): string {
  const width = options.width ?? BLEED;
  const natural = Math.round(width * photo.height / photo.width);
  // `fill` keeps a fixed frame height; the uncropped photo sits inside and the blurred copy fills around it.
  const height = options.fill ? options.cap : Math.min(options.cap, natural);
  const backdrop = photo.backdrop && Math.abs(natural - height) > 1 ? `<span class="cv-backdrop" style="background-image:url(${photo.backdrop})" aria-hidden="true"></span>` : '';
  return `<figure class="${options.coverHook === false ? '' : 'story-photo '}cv-photo ${options.className ?? ''}" style="height:${height}px">${backdrop}<img src="${photo.uri}" width="${photo.width}" height="${photo.height}" alt="${e(options.alt ?? '本次婚礼的封面画面')}" />${options.inner ?? ''}</figure>`;
}

function dates(block: Intro, className = 'cv-dates'): string {
  const items = [[block.weddingDate, 'Wedding day', '婚礼日期'], [block.deliveryDate, 'Delivered on', '交付日期']].filter(([date]) => date !== undefined);
  if (!items.length) return '';
  return `<div class="${className}">${items.map(([date, label, zh]) => `<div class="cv-date"><span class="cv-date-label">${label}<i>${zh}</i></span><span class="cv-date-value">${dot(date)}</span></div>`).join('')}</div>`;
}

const salutation = (block: Intro) => block.salutation ? `<p class="cv-salutation">${e(block.salutation)}</p>` : '';
const projectNo = (block: Intro) => block.projectNo ? `<p class="cv-project">交付编号 · ${e(block.projectNo)}</p>` : '';
const headlineOf = (block: Intro) => block.cover ? block.cover.headline.trim() : '';

function signatureOf(display: DisplayDocument): string {
  const signature = display.blocks.find(block => block.type === 'signature');
  const parts = [signature?.type === 'signature' ? signature.photographer : undefined, display.studio].filter((value): value is string => !!value?.trim());
  return [...new Set(parts)].join(' · ');
}

function editorial(block: Intro, template: TemplateDefinition, photo?: DisplayImage): string {
  const year = block.weddingDate?.slice(0, 4);
  const headline = headlineOf(block) || (block.names ? '' : '属于你们的婚礼影像。');
  const kicker = `<div class="cv-kicker"><span>A wedding film</span><span class="cv-kicker-rule" aria-hidden="true"></span><span>${year ? `Vol. ${e(year)}` : '私人影像珍藏'}</span></div>`;
  const title = `<h1 class="cv-names">${e(block.names || '婚礼影像')}</h1>${headline ? `<p class="cv-headline">${e(headline)}</p>` : ''}`;
  const numeral = !photo && block.weddingDate ? `<div class="cv-numeral" aria-hidden="true">${e(block.weddingDate.slice(5).replace('-', '.'))}</div>` : '';
  const text = `<div class="cv-text">${kicker}${numeral}${salutation(block)}${title}<span class="cv-rule" aria-hidden="true"></span></div>`;
  const picture = photo ? photoFrame(photo, { cap: 300, className: 'cv-bleed' }) : '';
  return `${text}${picture}<div class="cv-foot">${dates(block)}${projectNo(block)}</div>`;
}

function cinematic(block: Intro, template: TemplateDefinition, display: DisplayDocument, photo?: DisplayImage): string {
  const credit = signatureOf(display);
  const headline = headlineOf(block);
  const bands = `<span class="cv-band cv-band-top" aria-hidden="true"><span>SCENE 01</span><span>00:00:00:01</span></span><span class="cv-band cv-band-bottom" aria-hidden="true"><span>${e(dot(block.weddingDate) || 'WEDDING FILM')}</span><span>▸ PLAY</span></span>`;
  const screen = photo
    ? `<div class="cv-screen">${photoFrame(photo, { cap: 300 })}${bands}</div>`
    : `<div class="cv-screen cv-title-card"><h2 class="cv-film-title">${e(template.heroTitle)}</h2>${bands}</div>`;
  const billing = [block.weddingDate ? `Wedding day <b>${dot(block.weddingDate)}</b>` : '', block.deliveryDate ? `Delivered <b>${dot(block.deliveryDate)}</b>` : ''].filter(Boolean).join('<i aria-hidden="true">·</i>');
  return `<div class="cv-credit">${credit ? `A film by ${e(credit)}` : e(template.heroLabel)}</div>${screen}<div class="cv-text">${salutation(block)}<h1 class="cv-names">${e(block.names || '婚礼影像')}</h1>${headline ? `<p class="cv-headline">${e(headline)}</p>` : ''}</div>${billing ? `<div class="cv-billing">${billing}</div>` : ''}${projectNo(block)}`;
}

function archive(block: Intro, template: TemplateDefinition, photo?: DisplayImage): string {
  const headline = headlineOf(block);
  const rows = [[block.names, 'THE COUPLE', 'archive-names'], [block.weddingDate?.replaceAll('-', '.'), 'WEDDING DAY', 'archive-date'], [block.deliveryDate?.replaceAll('-', '.'), 'DELIVERED ON', 'archive-date'], [block.projectNo, 'PROJECT NO.', ''], [headline || undefined, 'NOTE', 'archive-note']];
  const ledger = rows.filter(([value]) => value !== undefined).map(([value, label, className]) => `<div><dt>${label}</dt><dd class="${className}">${e(value)}</dd></div>`).join('');
  const stampDate = block.deliveryDate || block.weddingDate;
  const stamp = `<div class="cv-stamp" aria-hidden="true"><span>Delivered</span><b>${stampDate ? dot(stampDate) : 'ARCHIVE'}</b><span>Archive</span></div>`;
  const print = photo ? `<div class="cv-print">${photoFrame(photo, { cap: 210, width: CONTENT - 18 })}<div class="cv-print-caption"><span>FIG. 00 — Cover still</span><span>${dot(block.weddingDate)}</span></div>${stamp}</div>` : stamp;
  return `<div class="cv-register"><span>Delivery record</span><span>${block.projectNo ? `No. ${e(block.projectNo)}` : 'Private edition'}</span></div><h1 class="cv-archive-title">${e(template.heroTitle)}</h1><div class="cv-archive-label">${e(template.heroLabel)}</div>${print}${salutation(block)}${ledger ? `<dl class="archive-ledger">${ledger}</dl>` : ''}`;
}

function correspondence(block: Intro, template: TemplateDefinition, photo?: DisplayImage): string {
  const headline = headlineOf(block);
  const initial = Array.from(block.names?.trim() ?? '')[0] ?? '囍';
  const [year, month, day] = block.weddingDate?.split('-') ?? [];
  const postmark = `<div class="cv-postmark" aria-hidden="true"><span>With love</span><b>${month && day ? `${e(month)}.${e(day)}` : '♡'}</b><span>${year ? e(year) : 'Always'}</span></div>`;
  const seal = `<div class="cv-seal" aria-hidden="true"><span>${e(initial)}</span></div>`;
  const print = photo ? `<div class="cv-letter-print">${photoFrame(photo, { cap: 250, width: 286 })}<span class="cv-tape cv-tape-left" aria-hidden="true"></span><span class="cv-tape cv-tape-right" aria-hidden="true"></span>${seal}</div>` : '';
  const name = block.names ? `<h1 class="cv-names">${e(block.names)}</h1>` : `<h1 class="cv-names cv-letter-fallback">${e(template.heroTitle)}</h1>`;
  return `<div class="letter-opening"><div class="cv-letter-head"><div class="cv-kicker">${e(template.heroLabel)}</div>${postmark}</div>${salutation(block)}${print}${name}${headline ? `<p class="cv-headline">${e(headline)}</p>` : ''}<p class="cv-dedication">A day to keep.<br>A story to return to.</p>${photo ? '' : seal}</div><div class="cv-foot">${dates(block)}${projectNo(block)}</div>`;
}

function gallery(block: Intro, template: TemplateDefinition, display: DisplayDocument, photo?: DisplayImage): string {
  // Reuse only the cover or an already-visible After image; never select from unreferenced project assets.
  const featured = photo ?? display.blocks.flatMap(item => item.type === 'comparisons' ? item.comparisons : []).find(item => item.after)?.after;
  const headline = headlineOf(block);
  const year = block.weddingDate?.slice(0, 4);
  const art = featured
    ? `<div class="cv-frame">${photoFrame(featured, { cap: 236, width: CONTENT - 26, alt: photo ? '本次婚礼的封面画面' : '本次交付中的调色成片' })}</div>`
    : '<div class="gallery-poster-art" aria-hidden="true"><i></i><i></i><i></i></div>';
  const label = `<div class="cv-label"><b>${e(block.names || '婚礼影像')}</b><span>婚礼影像${year ? `，${e(year)}` : ''}</span>${headline ? `<em>${e(headline)}</em>` : ''}<span class="cv-label-meta">Wedding film · Private collection</span></div>`;
  return `<div class="cv-kicker"><span>${e(template.heroLabel)}</span><span>Room 01</span></div><h1 class="cv-gallery-title">${e(template.heroTitle)}</h1><figure class="gallery-poster"><div class="cv-wall">${art}</div>${label}</figure>${salutation(block)}<div class="cv-foot">${dates(block)}${projectNo(block)}</div>`;
}

export function renderCover(block: Intro, template: TemplateDefinition, display: DisplayDocument, unit: (content: string, className?: string, attributes?: string) => string): string[] {
  const photo = block.cover?.image;
  const emphasis = block.cover?.emphasis === 'photo' && photo ? 'photo-first' : 'names-first';
  const content = template.id === 'cinematic' ? cinematic(block, template, display, photo)
    : template.id === 'archive' ? archive(block, template, photo)
      : template.id === 'correspondence' ? correspondence(block, template, photo)
        : template.id === 'gallery' ? gallery(block, template, display, photo)
          : editorial(block, template, photo);
  const units = [unit(content, `story-cover cv-cover cv-${template.id} ${emphasis}${photo ? ' has-photo' : ' no-photo'}`, `data-block="${e(block.id)}" data-cover="true"`)];
  // The free-length message is its own pagination unit so a long note can never overflow the cover page.
  if (block.cover?.message.trim()) units.push(unit(`<p class="cv-message">${e(block.cover.message)}</p>`, `cv-message-unit cv-${template.id}-message`, `data-block="${e(block.id)}"`));
  return units;
}

const grain = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .065 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`;

/** Display type: Latin from Source Serif 4, Chinese from Noto Serif SC, rare characters from Noto Sans SC. */
export const displayFontCss = `:root{--display:'Studio Serif','Studio Serif SC','Studio Sans',serif}`;

export const coverBaseCss = `
.cv-cover{position:relative;display:flex;flex-direction:column;min-height:0;margin:0 -32px;padding:0 32px}
.pdf-page .cv-cover{max-width:none}
.cv-photo{position:relative;margin:0;overflow:hidden;background:var(--panel)}
.cv-photo img{position:relative;display:block;width:100%;height:100%;object-fit:contain}
.cv-backdrop{position:absolute;inset:-12px;background-size:cover;background-position:center;opacity:.9}
.cv-backdrop:after{content:'';position:absolute;inset:0;background:rgba(0,0,0,.18)}
.cv-bleed{margin-left:-32px;margin-right:-32px}
.cv-names{font-family:var(--display);margin:0;white-space:pre-line;font-variant-numeric:lining-nums}
.cv-headline{font-family:var(--display);margin:0;white-space:pre-wrap}
.cv-salutation{margin:0 0 8px;font-size:13px;color:var(--muted)}
.cv-project{margin:12px 0 0;font-size:11px;letter-spacing:.06em;color:var(--muted)}
.cv-dates{display:flex;gap:34px}
.cv-date{display:flex;flex-direction:column;gap:3px}
.cv-date-label{font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}
.cv-date-label i{font-style:normal;letter-spacing:.08em;margin-left:6px}
.cv-date-value{font-family:'Studio Serif',Georgia,serif;font-size:19px;letter-spacing:.04em;font-variant-numeric:lining-nums tabular-nums;color:var(--foreground)}
.cv-message{margin:0;white-space:pre-wrap;font-size:15px;line-height:1.85;color:var(--muted)}
.cv-message-unit{margin-top:6px}
`;

export const coverCss: Record<TemplateId, string> = {
  editorial: `
.cv-editorial{padding-top:4px;padding-bottom:6px}
.cv-editorial .cv-text{position:relative;z-index:1}
.cv-editorial .cv-kicker{display:flex;align-items:center;gap:12px;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--muted);margin:0 0 18px}
.cv-editorial .cv-kicker-rule{flex:1;height:1px;background:var(--line)}
.cv-editorial .cv-names{font-size:46px;line-height:1.18;font-weight:600;letter-spacing:.01em;color:var(--foreground)}
.cv-editorial .cv-headline{font-size:20px;line-height:1.55;font-weight:500;margin-top:12px;color:var(--foreground)}
.cv-editorial .cv-rule{display:block;width:36px;height:2px;background:var(--accent);margin:22px 0 0}
.cv-editorial .cv-foot{margin-top:24px;padding-top:16px;border-top:1px solid var(--line)}
.cv-editorial.photo-first .cv-photo{order:-1;margin-bottom:26px}
.cv-editorial.names-first .cv-photo{margin-top:26px}
.cv-editorial.no-photo{min-height:520px;justify-content:space-between;padding-top:40px}
.cv-editorial.no-photo .cv-names{font-size:54px}
.cv-editorial .cv-numeral{font-family:'Studio Serif',Georgia,serif;font-size:112px;line-height:.9;font-weight:250;letter-spacing:-.05em;color:var(--accent);opacity:.2;margin:8px 0 18px -4px;font-variant-numeric:lining-nums}
.cv-editorial-message{padding-left:14px;border-left:2px solid var(--line)}
/* display typography */
.chapter-heading{font-family:var(--display);font-size:28px;font-weight:600;letter-spacing:.01em;line-height:1.4}
.compact-chapter .chapter-heading{font-size:24px}
.comparison-heading{font-family:var(--display);font-size:16px;font-weight:600}
.signature-mark{font-family:var(--display);font-size:30px;font-weight:600;letter-spacing:.01em;line-height:1.55}
.signature-caption{color:var(--brand)}
`,
  cinematic: `
.cv-cinematic{align-items:stretch;text-align:center;padding-top:6px;padding-bottom:8px;background:radial-gradient(ellipse 72% 46% at 50% 50%,#2a3024 0,transparent 100%)}
.flow,.image-segment,.pdf-page{background-image:${grain}}
.cv-credit{font-size:9px;letter-spacing:.34em;text-transform:uppercase;color:var(--muted);margin:0 0 18px}
.cv-screen{position:relative;margin:0 -32px;padding:24px 0;background:#000}
.cv-screen .cv-photo{background:#000}
.cv-band{position:absolute;left:14px;right:14px;display:flex;justify-content:space-between;font-size:8px;letter-spacing:.24em;color:#8b8d80;font-variant-numeric:tabular-nums}
.cv-band-top{top:7px}.cv-band-bottom{bottom:7px}
.cv-title-card{display:flex;align-items:center;justify-content:center;min-height:250px}
.cv-film-title{font-family:'Studio Serif',Georgia,serif;font-style:italic;font-weight:300;font-size:50px;line-height:1.08;letter-spacing:-.04em;white-space:pre-line;margin:0;color:var(--foreground)}
.cv-cinematic .cv-text{margin-top:32px}
.cv-cinematic .cv-names{font-size:38px;line-height:1.3;font-weight:300;letter-spacing:.16em;color:var(--foreground)}
.cv-cinematic .cv-headline{font-size:15px;line-height:1.7;font-weight:400;letter-spacing:.14em;color:var(--accent);margin-top:14px}
.cv-cinematic .cv-salutation{letter-spacing:.1em}
.cv-billing{margin:26px auto 0;padding:13px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:var(--muted);display:flex;justify-content:center;flex-wrap:wrap;gap:4px 12px}
.cv-billing b{font-family:'Studio Serif',Georgia,serif;font-weight:400;font-size:13px;letter-spacing:.08em;color:var(--foreground);margin-left:6px}
.cv-billing i{font-style:normal;color:var(--accent)}
.cv-cinematic.photo-first .cv-text,.cv-cinematic.names-first .cv-text{order:0}
.cv-cinematic.names-first .cv-screen{order:2;margin-top:28px}
.cv-cinematic.names-first .cv-billing{order:1}
.cv-cinematic.names-first .cv-project{order:3}
.cv-cinematic-message{text-align:center;padding:0 12px}
.cv-cinematic-message .cv-message{font-size:14px}
/* display typography */
.chapter-heading{font-family:var(--display);font-weight:400;letter-spacing:.06em}
.comparison-heading{font-family:var(--display);font-size:14px;letter-spacing:.06em}
.signature-caption{color:var(--brand)}
`,
  archive: `
.cv-archive{padding-top:2px;padding-bottom:4px}
.cv-archive:before{content:'';position:absolute;left:32px;right:32px;top:0;height:1px;background:var(--foreground)}
.cv-register{display:flex;justify-content:space-between;gap:16px;padding-top:10px;font-size:8px;letter-spacing:.2em;text-transform:uppercase}
.cv-register span:last-child{color:var(--muted);font-variant-numeric:tabular-nums}
.cv-archive-title{font-family:'Studio Serif',Georgia,serif;font-size:40px;font-weight:440;line-height:1.04;letter-spacing:-.04em;white-space:pre-line;margin:22px 0 8px}
.cv-archive.no-photo .cv-archive-title{font-size:57px;margin:34px 0 14px}
.cv-archive-label{font-size:8px;letter-spacing:.16em;color:var(--accent);margin-bottom:20px}
.cv-print{position:relative;padding:9px 9px 0;background:var(--panel);border:1px solid var(--line);margin-bottom:22px}
.cv-print .cv-photo{background:#1d211e}
.cv-print-caption{display:flex;justify-content:space-between;font-size:8px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);padding:8px 0 9px;font-variant-numeric:tabular-nums}
.cv-stamp{position:absolute;right:-6px;bottom:-26px;width:94px;height:94px;border-radius:50%;border:2px solid var(--accent);box-shadow:inset 0 0 0 4px var(--background),inset 0 0 0 5px var(--accent);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;transform:rotate(-13deg);color:var(--accent);background:color-mix(in srgb,var(--background) 78%,transparent);z-index:2}
.cv-stamp span{font-size:7px;letter-spacing:.2em;text-transform:uppercase}
.cv-stamp b{font-family:'Studio Serif',Georgia,serif;font-size:13px;font-weight:600;letter-spacing:.04em;font-variant-numeric:tabular-nums}
.cv-archive.no-photo .cv-stamp{position:relative;right:auto;bottom:auto;align-self:flex-end;margin:-6px 4px 18px 0}
.cv-archive .archive-ledger{margin:0;border-top:2px solid var(--foreground)}
.cv-archive .archive-ledger>div{display:grid;grid-template-columns:92px minmax(0,1fr);gap:14px;border-bottom:1px solid var(--line);padding:10px 0}
.cv-archive .archive-ledger dt{font-size:8px;letter-spacing:.14em;color:var(--muted);padding-top:4px}
.cv-archive .archive-ledger dd{margin:0;font-size:14px;line-height:1.55;font-variant-numeric:tabular-nums}
.cv-archive .archive-ledger .archive-names{font-family:var(--display);font-size:22px;font-weight:600}
.cv-archive .archive-ledger .archive-date{font-family:'Studio Serif',Georgia,serif;font-size:16px;letter-spacing:.04em}
.cv-archive .archive-ledger .archive-note{font-family:var(--display);font-size:15px}
.cv-archive .cv-salutation{margin-top:4px}
.cv-archive-message{font-size:13px}
.cv-archive-message .cv-message{font-size:14px}
/* display typography */
.signature-caption{color:var(--brand)}
`,
  correspondence: `
.cv-correspondence{padding-top:4px;padding-bottom:6px}
.cv-correspondence .letter-opening{position:relative;border-top:1px solid var(--line);padding-top:18px}
.cv-letter-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:6px}
.cv-correspondence .cv-kicker{font-size:8px;letter-spacing:.22em;color:var(--muted);padding-top:6px}
.cv-postmark{position:relative;width:70px;height:70px;border-radius:50%;border:1.5px solid var(--accent);color:var(--accent);display:flex;flex-direction:column;align-items:center;justify-content:center;transform:rotate(-9deg);opacity:.85;flex:none}
.cv-postmark:before{content:'';position:absolute;right:62px;top:22px;width:88px;height:24px;background:repeating-linear-gradient(180deg,var(--accent) 0 1.2px,transparent 1.2px 7px);opacity:.55}
.cv-postmark span{font-size:6.5px;letter-spacing:.2em;text-transform:uppercase}
.cv-postmark b{font-family:'Studio Serif',Georgia,serif;font-size:16px;font-weight:600;line-height:1.2;letter-spacing:.02em}
.cv-letter-print{position:relative;width:308px;margin:16px 0 34px 8px;padding:11px 11px 34px;background:#fffdf8;box-shadow:0 1px 1px rgba(73,53,47,.08),0 14px 30px -10px rgba(73,53,47,.38);transform:rotate(-2.2deg)}
.cv-letter-print .cv-photo{background:#efe6dc}
.cv-tape{position:absolute;top:-11px;width:74px;height:22px;background:rgba(232,218,196,.78);box-shadow:0 1px 2px rgba(73,53,47,.12)}
.cv-tape-left{left:-16px;transform:rotate(-34deg)}.cv-tape-right{right:-16px;transform:rotate(31deg)}
.cv-seal{position:absolute;right:-22px;bottom:-24px;width:62px;height:62px;border-radius:50%;background:radial-gradient(circle at 35% 30%,color-mix(in srgb,var(--accent) 70%,#fff) 0,var(--accent) 45%,color-mix(in srgb,var(--accent) 70%,#000) 100%);box-shadow:0 4px 10px rgba(73,53,47,.35),inset 0 0 0 5px rgba(0,0,0,.08);display:flex;align-items:center;justify-content:center;transform:rotate(8deg)}
.cv-seal span{font-family:var(--display);font-size:26px;font-weight:600;color:#fff7ef;width:44px;height:44px;border-radius:50%;border:1px solid rgba(255,247,239,.45);display:flex;align-items:center;justify-content:center}
.cv-correspondence.no-photo .cv-seal{position:relative;right:auto;bottom:auto;margin-top:26px}
.cv-correspondence .cv-names{font-size:40px;line-height:1.35;font-weight:500;letter-spacing:.06em;color:var(--foreground);margin-top:6px}
.cv-correspondence.no-photo .cv-names{font-size:48px;margin-top:36px}
.cv-correspondence .cv-letter-fallback{font-family:'Studio Serif',Georgia,serif;font-style:italic;font-size:54px;line-height:1.12;letter-spacing:-.04em}
.cv-correspondence .cv-headline{font-size:18px;line-height:1.7;font-weight:400;color:var(--foreground);margin-top:10px}
.cv-dedication{font-family:'Studio Serif',Georgia,serif;font-style:italic;font-size:19px;line-height:1.5;color:var(--muted);margin:14px 0 0}
.cv-correspondence .cv-foot{margin-top:26px;padding-top:14px;border-top:1px dashed var(--line)}
.cv-correspondence .cv-salutation{font-family:var(--display);font-size:15px;color:var(--foreground);margin:18px 0 0}
.cv-correspondence-message .cv-message{font-family:var(--display);font-size:16px;color:var(--foreground)}
/* display typography */
.chapter-heading{font-family:var(--display);font-weight:500;letter-spacing:.04em}
.comparison-heading{font-family:var(--display)}
.item-title{font-family:var(--display);font-weight:600}
.signature-caption{color:var(--brand)}
`,
  gallery: `
.cv-gallery{padding-top:2px;padding-bottom:6px}
.cv-gallery .cv-kicker{display:flex;justify-content:space-between;font-size:8px;letter-spacing:.24em;text-transform:uppercase;color:var(--accent)}
.cv-gallery .cv-kicker span:last-child{color:var(--muted)}
.cv-gallery-title{font-family:'Studio Serif',Georgia,serif;font-size:38px;line-height:1.04;font-weight:400;letter-spacing:-.045em;white-space:pre-line;margin:16px 0 0}
.cv-gallery .gallery-poster{height:auto;margin:20px -32px 0;padding:0;border:0;background:transparent}
.cv-wall{position:relative;padding:30px 32px 26px;background:radial-gradient(ellipse 58% 62% at 50% 0,rgba(255,236,206,.16),rgba(255,236,206,0) 100%)}
.cv-frame{position:relative;padding:13px;background:#0d131a;border:1px solid #3a4855;box-shadow:0 22px 40px -14px rgba(0,0,0,.7),0 0 0 4px #121a22}
.cv-frame .cv-photo{background:#0d131a}
.cv-gallery .gallery-poster-art{height:190px;border:1px solid var(--line);background:#0e151c}
.cv-label{margin:-4px 32px 0 auto;width:212px;padding:11px 14px 12px;background:#efe9de;color:#1b232b;display:flex;flex-direction:column;gap:2px;box-shadow:0 8px 18px -10px rgba(0,0,0,.6);position:relative}
.cv-label b{font-family:var(--display);font-size:16px;font-weight:600;letter-spacing:.02em}
.cv-label span{font-size:10.5px;color:#4c5660}
.cv-label em{font-family:var(--display);font-style:normal;font-size:11.5px;line-height:1.6;color:#1b232b;margin-top:3px}
.cv-label .cv-label-meta{font-size:7.5px;letter-spacing:.18em;text-transform:uppercase;color:#7b858e;margin-top:4px}
.cv-gallery .cv-foot{margin-top:22px;padding-top:14px;border-top:1px solid var(--line)}
.cv-gallery .cv-date-value{font-size:17px}
.cv-gallery-message .cv-message{font-size:14px}
/* display typography */
.chapter-heading{font-family:var(--display);font-weight:400;letter-spacing:.02em}
.comparison-heading{font-family:var(--display);font-size:14px}
.item-title{font-family:var(--display);font-weight:500}
.signature-caption{color:var(--brand)}
`,
};
