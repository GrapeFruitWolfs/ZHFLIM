import type { OutputTarget, TemplateId } from '../shared/model.js';
import { escapeHtml as e, type DisplayBlock, type DisplayDocument, type DisplayImage, type FontBundle } from './display.js';
import { brandColor, sharedCss, templates } from './templates.js';
import { coverBaseCss, coverCss, displayFontCss, renderCover } from './covers.js';
import { componentCss, componentTemplateCss, finale, finaleImage, formatChips, reveal, revealCandidate } from './components.js';
import { momentsCss, momentsTemplateCss, shareCard, stillsUnits, teaserUnit, timelineUnits } from './moments.js';
import { storyCss } from './editorial.js';
import { textChunks } from './text.js';

export { textChunks };

function unit(content: string, className = '', attributes = ''): string {
  return `<div class="unit ${className}" ${attributes}>${content}</div>`;
}

function chapter(block: DisplayBlock, index: number, templateId: TemplateId): string {
  const captions = { intro: 'Wedding collection', deliveries: 'Your collection', text: 'Production notes', comparisons: 'The art of colour', signature: 'With gratitude', stills: 'Highlights', timeline: 'The day' };
  const number = String(index).padStart(2, '0');
  const heading = `<h2 class="chapter-heading">${e(block.title)}</h2><div class="chapter-caption">${captions[block.type]}</div>`;
  const content = templateId === 'archive'
    ? `<span class="chapter-index">RECORD<br>${number}</span><div>${heading}</div>`
    : templateId === 'correspondence'
      ? `<span class="chapter-index">Note ${number}.</span>${heading}`
      : templateId === 'gallery'
        ? `<span class="chapter-index">COLLECTION / ${number}</span>${heading}<span class="gallery-chapter-line" aria-hidden="true"></span>`
        : templateId === 'cinematic'
          ? `<span class="chapter-index">SCENE ${number}<i aria-hidden="true">00:${number}:00:00</i></span>${heading}`
          : `<span class="chapter-index">${number} /</span>${heading}`;
  return unit(content, `chapter${block.type === 'text' && block.content.trim().length <= 120 ? ' compact-chapter' : ''}`, `data-keep-next="true" data-block="${e(block.id)}"`);
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
  const signatures: string[] = [];
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
      body.push(...renderCover(block, template, display, unit));
      const teaser = teaserUnit(block, target, unit);
      if (teaser) body.push(teaser);
    } else if (block.type === 'stills') {
      if (!block.frames.length) continue;
      body.push(chapter(block, ++chapterIndex, template.id));
      body.push(...stillsUnits(block, template.id, unit));
    } else if (block.type === 'timeline') {
      if (!block.entries.length) continue;
      body.push(chapter(block, ++chapterIndex, template.id));
      body.push(...timelineUnits(block, template.id, unit));
    } else if (block.type === 'text') {
      body.push(chapter(block, ++chapterIndex, template.id));
      for (const chunk of textChunks(block.content)) body.push(unit(`<p class="body-copy">${e(chunk)}</p>`, '', `data-block="${e(block.id)}"`));
      if (block.details?.placement === 'inline') body.push(...renderDetails(block));
      else if (block.details?.placement === 'appendix') appendix.push(block);
    } else if (block.type === 'deliveries') {
      body.push(chapter(block, ++chapterIndex, template.id));
      block.items.forEach((item, index) => {
        const number = `${template.id === 'archive' ? 'ASSET ' : template.id === 'correspondence' ? 'Enclosure ' : ''}${String(index + 1).padStart(2, '0')}`;
        const attrs = `data-block="${e(block.id)}"`;
        // A ticket spans several pagination units; only the first and last carry the card edges.
        const parts: { content: string; className: string; attributes: string }[] = [];
        parts.push({ content: `<div class="delivery-heading"><span class="item-number">${number}</span><div><h3 class="item-title">${e(item.title)}</h3>${formatChips(item.format)}</div></div>`, className: '', attributes: `data-keep-next="${Boolean(item.description || item.links.length || item.accessNote)}" ${attrs}` });
        for (const chunk of textChunks(item.description)) parts.push({ content: `<p class="body-copy delivery-copy">${e(chunk)}</p>`, className: '', attributes: attrs });
        if (item.links.length) {
          if (target === 'pdf') {
            const links = item.links.map(link => `<a class="delivery-link" href="${e(link.url)}" target="_blank" rel="noreferrer noopener">${e(link.label)}<span class="link-arrow">↗</span></a>`).join('');
            parts.push({ content: links, className: 'delivery-access', attributes: attrs });
          } else for (const link of item.links) {
            // Each access method is one complete pagination unit: QR, label and host stay together.
            const qr = `<div class="qr-links"><div class="qr-link">${link.qr ? `<img class="qr-image" src="${link.qr}" alt="${e(link.label)}二维码" />` : '<div class="missing-image">请更换稳定分享链接</div>'}<div class="qr-label">${e(link.label)}</div><div class="qr-host">${e(link.host)}</div></div></div><p class="qr-hint">长按识别二维码，或保存后从相册识别</p>`;
            parts.push({ content: qr, className: 'delivery-access', attributes: attrs });
          }
        }
        for (const [chunkIndex, chunk] of textChunks(item.accessNote).entries()) parts.push({ content: `<p class="access-note">${chunkIndex === 0 ? '<span class="access-label">获取方式</span>' : ''}${e(chunk)}</p>`, className: '', attributes: attrs });
        parts.forEach((part, partIndex) => body.push(unit(part.content, `ticket${partIndex === 0 ? ' ticket-start' : ''}${partIndex === parts.length - 1 ? ' ticket-end' : ''}${part.className ? ` ${part.className}` : ''}`, part.attributes)));
      });
    } else if (block.type === 'comparisons') {
      body.push(chapter(block, ++chapterIndex, template.id));
      const highlight = revealCandidate(block.comparisons);
      if (highlight) body.push(unit(reveal(highlight), 'reveal-unit', `data-block="${e(block.id)}"`));
      for (const comparison of block.comparisons) {
        const label = template.id === 'archive' ? 'FIG.' : template.id === 'gallery' ? 'STUDY' : template.id === 'correspondence' ? 'Plate' : 'No.';
        const heading = `<div class="comparison-heading"><span>${e(comparison.title || '调色对比')}</span><span class="comparison-number">${label} ${comparison.number}</span></div>`;
        body.push(unit(`${heading}<div class="comparison-pair ${block.layout}">${figure(comparison.before, 'before')}${figure(comparison.after, 'after')}</div>`, 'comparison-unit', `data-comparison="${e(comparison.id)}" data-block="${e(block.id)}"`));
        for (const chunk of textChunks(comparison.description ?? '', 180)) body.push(unit(`<p class="comparison-description">${e(chunk)}</p>`, '', `data-block="${e(block.id)}"`));
      }
    } else if (block.type === 'signature') {
      signatures.push(signature(block, template.id));
    }
  }
  const brand = display.logo ? `<img class="brand-logo" src="${display.logo.uri}" alt="工作室标志" />` : `<span class="brand-name">${e(display.studio ?? '')}</span>`;
  const edition = template.id === 'archive' ? 'Production archive' : template.id === 'correspondence' ? 'With you, always.' : template.id === 'gallery' ? 'Private exhibition' : 'Wedding collection';
  const masthead = `${brand}<span class="edition">${edition}</span>`;
  const closing = display.tagline ? unit(e(display.tagline), 'closing') : '';
  const closingImage = finaleImage(display);
  const finaleHtml = closingImage ? unit(finale(display, template.id, closingImage), 'finale-unit') : '';
  const appendixUnits = appendix.flatMap(block => renderDetails(block, true));
  const appendixHtml = appendixUnits.length ? unit('<h2 class="appendix-title">制作附录</h2><p class="appendix-caption">这份影像背后的技术细节与制作记录。</p>', 'appendix-start', `data-keep-next="true" ${target === 'pdf' ? 'data-page-before="true"' : ''}`) + appendixUnits.join('\n') : '';
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=432"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src data: 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${e(safeTitle)}</title><style>${fonts.css}\n:root{--background:${template.background};--foreground:${template.foreground};--muted:${template.muted};--line:${template.line};--panel:${template.panel};--accent:${template.accent};--brand:${brandColor(template, display.accent)}}${displayFontCss}${sharedCss}\n${template.css}\n${storyCss}\n${coverBaseCss}\n${coverCss[template.id]}\n${componentCss}\n${componentTemplateCss[template.id]}\n${momentsCss}\n${momentsTemplateCss[template.id]}</style></head><body data-template="${template.id}" data-target="${target}"><main class="render-root"><div class="flow"><header class="masthead">${masthead}</header><div class="units">${body.join('\n')}${appendixHtml}${finaleHtml}${signatures.join('\n')}${closing}</div></div></main>${target === 'image' ? shareCard(display, template, brand) : ''}</body></html>`;
}
