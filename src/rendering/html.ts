import type { OutputTarget, TemplateId } from '../shared/model.js';
import { escapeHtml as e, type DisplayBlock, type DisplayDocument, type DisplayImage, type FontBundle } from './display.js';
import { sharedCss, templates, type TemplateDefinition } from './templates.js';
import { storyCss } from './editorial.js';

/** Small paragraphs are safe pagination units; no content is discarded. */
export function textChunks(value: string, max = 220): string[] {
  if (!Number.isInteger(max) || max < 2) throw new RangeError('Text chunk size must be an integer of at least two characters.');
  const chunks: string[] = [];
  const characters = Array.from(value);
  for (let start = 0; start < characters.length;) {
    const limit = Math.min(start + max, characters.length);
    let end = start; let hardLines = 1;
    while (end < limit) {
      if (characters[end] === '\r' || characters[end] === '\n') {
        // Short pasted checklists can contain many visual lines despite having few characters.
        if (hardLines === 6) break;
        hardLines += 1;
        if (characters[end] === '\r' && characters[end + 1] === '\n') {
          if (end + 1 >= limit) break;
          end += 2; continue;
        }
      }
      end += 1;
    }
    if (end === limit && limit < characters.length) {
      for (let index = end; index > start + max * 0.65; index--) {
        if (/[。！？；.!?;\n\s]/.test(characters[index - 1]) && !(characters[index - 1] === '\r' && characters[index] === '\n')) { end = index; break; }
      }
    }
    chunks.push(characters.slice(start, end).join('')); start = end;
  }
  return chunks;
}

function unit(content: string, className = '', attributes = ''): string {
  return `<div class="unit ${className}" ${attributes}>${content}</div>`;
}

function chapter(block: DisplayBlock, index: number, templateId: TemplateId): string {
  const captions = { intro: 'Wedding collection', deliveries: 'Your collection', text: 'Production notes', comparisons: 'The art of colour', signature: 'With gratitude' };
  const number = String(index).padStart(2, '0');
  const heading = `<h2 class="chapter-heading">${e(block.title)}</h2><div class="chapter-caption">${captions[block.type]}</div>`;
  const content = templateId === 'archive'
    ? `<span class="chapter-index">RECORD<br>${number}</span><div>${heading}</div>`
    : templateId === 'correspondence'
      ? `<span class="chapter-index">Note ${number}.</span>${heading}`
      : templateId === 'gallery'
        ? `<span class="chapter-index">COLLECTION / ${number}</span>${heading}<span class="gallery-chapter-line" aria-hidden="true"></span>`
        : `<span class="chapter-index">${number} /</span>${heading}`;
  return unit(content, `chapter${block.type === 'text' && block.content.trim().length <= 120 ? ' compact-chapter' : ''}`, `data-keep-next="true" data-block="${e(block.id)}"`);
}

type Intro = Extract<DisplayBlock, { type: 'intro' }>;
function dateLine(block: Intro): string {
  const dates = [[block.weddingDate, 'Wedding day'], [block.deliveryDate, 'Delivered on']].filter(([date]) => date !== undefined);
  return dates.length ? `<div class="date-line">${dates.map(([date, label]) => `<div><span class="date-label">${label}</span><span class="date-value">${e(date?.replaceAll('-', ' · '))}</span></div>`).join('')}</div>` : '';
}

function cover(block: Intro, template: TemplateDefinition, display: DisplayDocument): string {
  if (block.cover || template.id === 'editorial') {
    const settings = block.cover;
    const headline = settings?.headline ?? '属于你们的婚礼影像。';
    const heading = block.names || headline || '婚礼影像';
    const photo = settings?.image ? `<figure class="story-photo"><img src="${settings.image.uri}" width="${settings.image.width}" height="${settings.image.height}" alt="本次婚礼的封面画面" /></figure>` : '';
    const greeting = block.salutation ? `<p class="salutation">${e(block.salutation)}</p>` : '';
    const introduction = `<div><p class="story-kicker">WEDDING COLLECTION · 私人影像珍藏</p>${greeting}<h1 class="story-name">${e(heading)}</h1>${block.names && headline ? `<p class="story-headline">${e(headline)}</p>` : ''}</div>`;
    const message = settings?.message ? `<p class="story-message">${e(settings.message)}</p>` : '';
    return unit(`${introduction}${photo}${message}<div>${dateLine(block)}${block.projectNo ? `<p class="access-note">交付编号 · ${e(block.projectNo)}</p>` : ''}</div>`, `story-cover ${settings?.emphasis === 'photo' ? 'photo-first' : 'names-first'}`, `data-block="${e(block.id)}" data-cover="true"`);
  }
  const salutation = block.salutation !== undefined ? `<p class="salutation">${e(block.salutation)}</p>` : '';
  const names = block.names !== undefined ? `<div class="couple-names">${e(block.names)}</div>` : '';
  const projectNo = block.projectNo !== undefined ? `<div class="access-note">项目编号 · ${e(block.projectNo)}</div>` : '';
  const identity = `${salutation}${names}${dateLine(block)}${projectNo}`;
  const hero = `<div class="cover-kicker">${e(template.heroLabel)}</div><h1 class="cover-title">${e(template.heroTitle)}</h1>`;
  const attrs = `data-block="${e(block.id)}"`;
  if (template.id === 'archive') {
    const rows = [[block.names, 'THE COUPLE', 'archive-names'], [block.weddingDate, 'WEDDING DAY', ''], [block.deliveryDate, 'DELIVERED ON', ''], [block.projectNo, 'PROJECT NO.', '']];
    const ledger = rows.filter(([value]) => value !== undefined).map(([value, label, className]) => `<div><dt>${label}</dt><dd class="${className}">${e(value)}</dd></div>`).join('');
    return unit(`<div><div class="archive-register"><span>DELIVERY RECORD</span><span>PRIVATE EDITION</span></div><h1 class="cover-title">${e(template.heroTitle)}</h1><div class="cover-kicker">${e(template.heroLabel)}</div></div><div>${salutation}${ledger ? `<dl class="archive-ledger">${ledger}</dl>` : ''}</div>`, 'cover archive-cover', attrs);
  }
  if (template.id === 'correspondence') {
    return unit(`<div class="letter-opening"><div class="cover-kicker">${e(template.heroLabel)}</div>${block.salutation !== undefined ? `<p class="letter-address">${e(block.salutation)}</p>` : ''}<h1 class="cover-title${block.names ? '' : ' letter-fallback'}">${e(block.names || template.heroTitle)}</h1><div class="letter-dedication">A day to keep.<br>A story to return to.</div></div><div class="cover-bottom">${dateLine(block)}${projectNo}</div>`, 'cover letter-cover', attrs);
  }
  if (template.id === 'gallery') {
    // Reuse only an already-visible After image; never select from unreferenced project assets.
    const featured = display.blocks.flatMap(item => item.type === 'comparisons' ? item.comparisons : []).find(item => item.after)?.after;
    const poster = featured ? `<img src="${featured.uri}" width="${featured.width}" height="${featured.height}" alt="本次交付中的调色成片" />` : '<div class="gallery-poster-art" aria-hidden="true"><i></i><i></i><i></i></div>';
    return unit(`<div>${hero}</div><figure class="gallery-poster">${poster}</figure><div class="cover-bottom">${identity}</div>`, 'cover gallery-cover', attrs);
  }
  return unit(`<div class="cover-ornament" aria-hidden="true"></div><div>${hero}</div><div class="cover-bottom">${identity}</div>`, 'cover', attrs);
}

function signature(block: Extract<DisplayBlock, { type: 'signature' }>, templateId: TemplateId): string {
  const photographer = block.photographer !== undefined ? `<div class="signature-name">${e(block.photographer)}</div>` : '';
  const studio = block.studio !== undefined ? `<div class="signature-studio">${e(block.studio)}</div>` : '';
  const caption = `<div class="signature-caption">${e(block.title || 'With gratitude')}</div>`;
  const content = templateId === 'archive'
    ? `${caption}<div class="signature-mark">Carefully produced.<br>Personally delivered.</div><div class="archive-credit"><span class="archive-credit-label">PRODUCTION<br>CREDIT</span><div>${photographer}${studio}</div></div>`
    : templateId === 'correspondence'
      ? `${caption}<div class="signature-mark">With gratitude,</div>${photographer}${studio}<div class="letter-signoff" aria-hidden="true"></div>`
      : templateId === 'gallery'
        ? `${caption}<div class="signature-mark">Thank you<br>for being here.</div><div class="gallery-credit">${photographer}${studio}</div>`
        : `${caption}<div class="signature-mark">${templateId === 'editorial' ? '愿每次重温，<br>都能想起那天的温度。' : 'Made to be remembered.'}</div>${photographer}${studio}`;
  return unit(content, 'signature', `data-block="${e(block.id)}"`);
}

function figure(image: DisplayImage | undefined, role: 'before' | 'after'): string {
  return `<figure class="comparison-figure comparison-${role}"><div class="comparison-frame">${image ? `<img class="comparison-image" src="${image.uri}" width="${image.width}" height="${image.height}" alt="${role === 'before' ? '调色前' : '调色后'}" />` : '<div class="missing-image">图片待补充</div>'}</div><figcaption class="comparison-label"><span>${role === 'before' ? 'Before' : 'After'}</span><span>${role === 'before' ? '原始画面' : '调色成片'}</span></figcaption></figure>`;
}

export function renderHtml(display: DisplayDocument, target: OutputTarget, fonts: FontBundle): string {
  const template = templates[display.templateId] ?? templates.editorial;
  const title = display.blocks.find(block => block.type === 'intro');
  const safeTitle = title?.type === 'intro' && title.names ? title.names : 'Wedding Collection';
  const body: string[] = [];
  const appendix: Extract<DisplayBlock, { type: 'text' }>[] = [];
  const renderDetails = (block: Extract<DisplayBlock, { type: 'text' }>, inAppendix = false): string[] => {
    const details = block.details;
    if (!details || (!details.content.trim() && !details.image)) return [];
    const attrs = `data-block="${e(block.id)}"`;
    const units = [unit(`<h3 class="detail-heading">${e(inAppendix ? block.title : '制作细节')}</h3>`, 'detail-unit', `${attrs} data-keep-next="true"`)];
    const chunks = textChunks(details.content, 180);
    for (const [index, chunk] of chunks.entries()) units.push(unit(`<p class="detail-copy">${e(chunk)}</p>`, 'detail-unit', `${attrs}${details.image && index === chunks.length - 1 ? ' data-keep-next="true"' : ''}`));
    if (details.image) units.push(unit(`<figure class="production-figure"><img src="${details.image.uri}" width="${details.image.width}" height="${details.image.height}" alt="${e(details.caption || block.title + '制作说明图')}" />${details.caption ? `<figcaption>${e(details.caption)}</figcaption>` : ''}</figure>`, 'detail-unit', attrs));
    return units;
  };
  let chapterIndex = 0;
  for (const block of display.blocks) {
    if (block.type === 'intro') {
      body.push(cover(block, template, display));
    } else if (block.type === 'text') {
      body.push(chapter(block, ++chapterIndex, template.id));
      for (const chunk of textChunks(block.content)) body.push(unit(`<p class="body-copy">${e(chunk)}</p>`, '', `data-block="${e(block.id)}"`));
      if (block.details?.placement === 'inline') body.push(...renderDetails(block));
      else if (block.details?.placement === 'appendix') appendix.push(block);
    } else if (block.type === 'deliveries') {
      body.push(chapter(block, ++chapterIndex, template.id));
      block.items.forEach((item, index) => {
        const number = `${template.id === 'archive' ? 'ASSET ' : template.id === 'correspondence' ? 'Enclosure ' : ''}${String(index + 1).padStart(2, '0')}`;
        body.push(unit(`<div class="delivery-heading"><span class="item-number">${number}</span><div><h3 class="item-title">${e(item.title)}</h3>${item.format ? `<span class="item-format">${e(item.format)}</span>` : ''}</div></div>`, '', `data-keep-next="${Boolean(item.description || item.links.length || item.accessNote)}" data-block="${e(block.id)}"`));
        for (const chunk of textChunks(item.description)) body.push(unit(`<p class="body-copy delivery-copy">${e(chunk)}</p>`, '', `data-block="${e(block.id)}"`));
        if (item.links.length) {
          if (target === 'pdf') {
            const links = item.links.map(link => `<a class="delivery-link" href="${e(link.url)}" target="_blank" rel="noreferrer noopener">${e(link.label)}<span class="link-arrow">↗</span></a>`).join('');
            body.push(unit(links, 'delivery-access', `data-block="${e(block.id)}"`));
          } else for (const link of item.links) {
            // Each access method is one complete pagination unit: QR, label and host stay together.
            const qr = `<div class="qr-links"><div class="qr-link">${link.qr ? `<img class="qr-image" src="${link.qr}" alt="${e(link.label)}二维码" />` : '<div class="missing-image">请更换稳定分享链接</div>'}<div class="qr-label">${e(link.label)}</div><div class="qr-host">${e(link.host)}</div></div></div><p class="qr-hint">长按识别二维码，或保存后从相册识别</p>`;
            body.push(unit(qr, 'delivery-access', `data-block="${e(block.id)}"`));
          }
        }
        for (const chunk of textChunks(item.accessNote)) body.push(unit(`<p class="access-note">${e(chunk)}</p>`, '', `data-block="${e(block.id)}"`));
      });
    } else if (block.type === 'comparisons') {
      body.push(chapter(block, ++chapterIndex, template.id));
      for (const comparison of block.comparisons) {
        const label = template.id === 'archive' ? 'FIG.' : template.id === 'gallery' ? 'STUDY' : template.id === 'correspondence' ? 'Plate' : 'No.';
        const heading = `<div class="comparison-heading"><span>${e(comparison.title || '调色对比')}</span><span class="comparison-number">${label} ${comparison.number}</span></div>`;
        body.push(unit(`${heading}<div class="comparison-pair ${block.layout}">${figure(comparison.before, 'before')}${figure(comparison.after, 'after')}</div>`, 'comparison-unit', `data-comparison="${e(comparison.id)}" data-block="${e(block.id)}"`));
        for (const chunk of textChunks(comparison.description ?? '', 180)) body.push(unit(`<p class="comparison-description">${e(chunk)}</p>`, '', `data-block="${e(block.id)}"`));
      }
    } else if (block.type === 'signature') {
      body.push(signature(block, template.id));
    }
  }
  const brand = display.logo ? `<img class="brand-logo" src="${display.logo.uri}" alt="工作室标志" />` : `<span class="brand-name">${e(display.studio ?? '')}</span>`;
  const edition = template.id === 'archive' ? 'Production archive' : template.id === 'correspondence' ? 'With you, always.' : template.id === 'gallery' ? 'Private exhibition' : 'Wedding collection';
  const masthead = `${brand}<span class="edition">${edition}</span>`;
  const closing = display.tagline ? unit(e(display.tagline), 'closing') : '';
  const appendixUnits = appendix.flatMap(block => renderDetails(block, true));
  const appendixHtml = appendixUnits.length ? unit('<h2 class="appendix-title">制作附录</h2><p class="appendix-caption">这份影像背后的技术细节与制作记录。</p>', 'appendix-start', `data-keep-next="true" ${target === 'pdf' ? 'data-page-before="true"' : ''}`) + appendixUnits.join('\n') : '';
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=432"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src data: 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${e(safeTitle)}</title><style>${fonts.css}\n:root{--background:${template.background};--foreground:${template.foreground};--muted:${template.muted};--line:${template.line};--panel:${template.panel};--accent:${display.accent || template.accent}}${sharedCss}\n${template.css}\n${storyCss}</style></head><body data-template="${template.id}" data-target="${target}"><main class="render-root"><div class="flow"><header class="masthead">${masthead}</header><div class="units">${body.join('\n')}${closing}${appendixHtml}</div></div></main></body></html>`;
}
