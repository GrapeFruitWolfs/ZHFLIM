import type { OutputTarget } from '../shared/model.js';
import { escapeHtml as e, type DisplayBlock, type DisplayDocument, type DisplayImage, type FontBundle } from './display.js';
import { sharedCss, templates } from './templates.js';

/** Small paragraphs are safe pagination units; no content is discarded. */
export function textChunks(value: string, max = 220): string[] {
  const chunks: string[] = [];
  for (const paragraph of value.split(/\n\s*\n/)) {
    const characters = Array.from(paragraph);
    while (characters.length > max) {
      let boundary = max;
      for (let index = max; index > max * 0.65; index--) {
        if (/[。！？；.!?;\n\s]/.test(characters[index - 1])) { boundary = index; break; }
      }
      chunks.push(characters.splice(0, boundary).join(''));
    }
    if (characters.length) chunks.push(characters.join(''));
  }
  return chunks;
}

function unit(content: string, className = '', attributes = ''): string {
  return `<div class="unit ${className}" ${attributes}>${content}</div>`;
}

function chapter(block: DisplayBlock, index: number): string {
  const captions = { intro: 'Wedding collection', deliveries: 'Your collection', text: 'Production notes', comparisons: 'The art of colour', signature: 'With gratitude' };
  return unit(`<span class="chapter-index">${String(index).padStart(2, '0')} /</span><h2 class="chapter-heading">${e(block.title)}</h2><div class="chapter-caption">${captions[block.type]}</div>`, 'chapter', `data-keep-next="true" data-block="${e(block.id)}"`);
}

function figure(image: DisplayImage | undefined, role: 'before' | 'after'): string {
  return `<figure class="comparison-figure comparison-${role}"><div class="comparison-frame">${image ? `<img class="comparison-image" src="${image.uri}" width="${image.width}" height="${image.height}" alt="${role === 'before' ? '调色前' : '调色后'}" />` : '<div class="missing-image">图片待补充</div>'}</div><figcaption class="comparison-label"><span>${role === 'before' ? 'Before' : 'After'}</span><span>${role === 'before' ? '原始画面' : '调色成片'}</span></figcaption></figure>`;
}

export function renderHtml(display: DisplayDocument, target: OutputTarget, fonts: FontBundle): string {
  const template = templates[display.templateId] ?? templates.editorial;
  const title = display.blocks.find(block => block.type === 'intro');
  const safeTitle = title?.type === 'intro' && title.names ? title.names : 'Wedding Collection';
  const body: string[] = [];
  let chapterIndex = 0;
  for (const block of display.blocks) {
    if (block.type === 'intro') {
      const dates = [[block.weddingDate, 'Wedding day'], [block.deliveryDate, 'Delivered on']].filter(([date]) => date !== undefined);
      body.push(unit(`<div class="cover-ornament" aria-hidden="true"></div><div><div class="cover-kicker">${e(template.heroLabel)}</div><h1 class="cover-title">${e(template.heroTitle)}</h1></div><div class="cover-bottom">${block.salutation !== undefined ? `<p class="salutation">${e(block.salutation)}</p>` : ''}${block.names !== undefined ? `<div class="couple-names">${e(block.names)}</div>` : ''}${dates.length ? `<div class="date-line">${dates.map(([date, label]) => `<div><span class="date-label">${label}</span><span class="date-value">${e(date?.replaceAll('-', ' · '))}</span></div>`).join('')}</div>` : ''}${block.projectNo !== undefined ? `<div class="access-note">项目编号 · ${e(block.projectNo)}</div>` : ''}</div>`, 'cover', `data-block="${e(block.id)}"`));
    } else if (block.type === 'text') {
      body.push(chapter(block, ++chapterIndex));
      for (const chunk of textChunks(block.content)) body.push(unit(`<p class="body-copy">${e(chunk)}</p>`, '', `data-block="${e(block.id)}"`));
    } else if (block.type === 'deliveries') {
      body.push(chapter(block, ++chapterIndex));
      block.items.forEach((item, index) => {
        body.push(unit(`<div class="delivery-heading"><span class="item-number">${String(index + 1).padStart(2, '0')}</span><div><h3 class="item-title">${e(item.title)}</h3>${item.format ? `<span class="item-format">${e(item.format)}</span>` : ''}</div></div>`, '', `data-keep-next="${Boolean(item.description || item.links.length || item.accessNote)}" data-block="${e(block.id)}"`));
        for (const chunk of textChunks(item.description)) body.push(unit(`<p class="body-copy delivery-copy">${e(chunk)}</p>`, '', `data-block="${e(block.id)}"`));
        if (item.links.length) {
          const links = target === 'pdf' ? item.links.map(link => `<a class="delivery-link" href="${e(link.url)}" target="_blank" rel="noreferrer noopener">${e(link.label)}<span class="link-arrow">↗</span></a>`).join('')
            : `<div class="qr-links">${item.links.map(link => `<div class="qr-link">${link.qr ? `<img class="qr-image" src="${link.qr}" alt="${e(link.label)}二维码" />` : '<div class="missing-image">请更换稳定分享链接</div>'}<div class="qr-label">${e(link.label)}</div><div class="qr-host">${e(link.host)}</div></div>`).join('')}</div><p class="qr-hint">长按识别二维码，或保存后从相册识别</p>`;
          body.push(unit(links, 'delivery-access', `data-block="${e(block.id)}"`));
        }
        for (const chunk of textChunks(item.accessNote)) body.push(unit(`<p class="access-note">${e(chunk)}</p>`, '', `data-block="${e(block.id)}"`));
      });
    } else if (block.type === 'comparisons') {
      body.push(chapter(block, ++chapterIndex));
      for (const comparison of block.comparisons) {
        const heading = `<div class="comparison-heading"><span>${e(comparison.title || '调色对比')}</span><span class="comparison-number">No. ${comparison.number}</span></div>`;
        body.push(unit(`${heading}<div class="comparison-pair ${block.layout}">${figure(comparison.before, 'before')}${figure(comparison.after, 'after')}</div>`, 'comparison-unit', `data-comparison="${e(comparison.id)}" data-block="${e(block.id)}"`));
      }
    } else if (block.type === 'signature') {
      body.push(unit(`<div class="signature-caption">${e(block.title || 'With gratitude')}</div><div class="signature-mark">Made to be remembered.</div>${block.photographer !== undefined ? `<div class="signature-name">${e(block.photographer)}</div>` : ''}${block.studio !== undefined ? `<div class="signature-studio">${e(block.studio)}</div>` : ''}`, 'signature', `data-block="${e(block.id)}"`));
    }
  }
  const brand = display.logo ? `<img class="brand-logo" src="${display.logo.uri}" alt="工作室标志" />` : `<span class="brand-name">${e(display.studio ?? '')}</span>`;
  const masthead = `${brand}<span class="edition">Wedding collection</span>`;
  const closing = display.tagline ? unit(e(display.tagline), 'closing') : '';
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=432"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src data: 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${e(safeTitle)}</title><style>${fonts.css}\n:root{--background:${template.background};--foreground:${template.foreground};--muted:${template.muted};--line:${template.line};--panel:${template.panel};--accent:${display.accent || template.accent}}${sharedCss}\n${template.css}</style></head><body data-template="${template.id}" data-target="${target}"><main class="render-root"><div class="flow"><header class="masthead">${masthead}</header><div class="units">${body.join('\n')}${closing}</div></div></main></body></html>`;
}
