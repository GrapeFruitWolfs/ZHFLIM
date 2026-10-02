import type { TemplateId } from '../shared/model.js';
import { escapeHtml as e, type DisplayBlock, type DisplayComparison, type DisplayDocument, type DisplayImage } from './display.js';
import { photoFrame } from './covers.js';

/**
 * Rhythm components: each one gives the reader a visual reward between reading passages.
 * None of them selects new pictures: they only reuse images that are already visible.
 */

const REVEAL_MAX_HEIGHT = 420;

/** Only pairs with identical pixel dimensions (same framing after the shared crop) can be cut in half honestly. */
export function revealCandidate(comparisons: DisplayComparison[]): DisplayComparison | undefined {
  return comparisons.find(item => item.before && item.after && item.before.width === item.after.width && item.before.height === item.after.height);
}

export function reveal(comparison: DisplayComparison): string {
  const before = comparison.before!; const after = comparison.after!;
  const natural = Math.round(432 * after.height / after.width);
  const height = Math.min(REVEAL_MAX_HEIGHT, natural);
  const width = height < natural ? Math.round(height * after.width / after.height) : 432;
  return `<figure class="reveal"><div class="reveal-frame fit-box" style="width:${width}px;height:${height}px"><img class="reveal-after" src="${after.uri}" width="${after.width}" height="${after.height}" alt="调色成片" /><img class="reveal-before" src="${before.uri}" width="${before.width}" height="${before.height}" alt="原始画面" /><span class="reveal-line" aria-hidden="true"></span><span class="reveal-knob" aria-hidden="true"><i></i><i></i></span><span class="reveal-tag reveal-tag-before">Before</span><span class="reveal-tag reveal-tag-after">After</span></div><figcaption class="reveal-caption"><span>${e(comparison.title || '调色对比')}</span><span>左半原始画面 · 右半调色成片</span></figcaption></figure>`;
}

/** Splits "4K · H.265 · 高码率" into chips without changing the customer's words. */
export function formatChips(format: string): string {
  const parts = format.split(/\s*[·•|｜/、]\s*/).map(part => part.trim()).filter(Boolean);
  return parts.length ? `<span class="item-format">${parts.map(part => `<span class="chip">${e(part)}</span>`).join('')}</span>` : '';
}

const FINALE: Record<TemplateId, { kicker: string; title: string; latin?: boolean }> = {
  editorial: { kicker: 'The end of the day', title: '这一天，就此珍藏。' },
  cinematic: { kicker: 'The end · 完', title: 'Fin.', latin: true },
  archive: { kicker: 'End of record', title: 'Archived, with care.', latin: true },
  correspondence: { kicker: 'P.S.', title: 'Yours, always.', latin: true },
  gallery: { kicker: 'End of exhibition', title: '愿这些画面，常看常新。' },
};

/**
 * The closing still: among the graded pictures already shown (comparison Afters, highlight frames)
 * pick the calmest one that is not the cover — crowds and confetti make a poor last screen.
 * Ties go to the later picture; with nothing else visible the cover closes the document.
 */
export function finaleImage(display: DisplayDocument): DisplayImage | undefined {
  const intro = display.blocks.find(block => block.type === 'intro');
  const cover = intro?.type === 'intro' ? intro.cover?.image : undefined;
  const candidates = display.blocks.flatMap(block => block.type === 'comparisons' ? block.comparisons.map(item => item.after) : block.type === 'stills' ? block.frames.map(frame => frame.image) : [])
    .filter((image): image is DisplayImage => !!image && image.uri !== cover?.uri);
  let best: DisplayImage | undefined;
  for (const image of candidates) if (!best || (image.busy ?? 0.5) <= (best.busy ?? 0.5)) best = image;
  return best ?? cover;
}

/** The picture closes the story; the words sit below it on the page colour, never over a busy photo. */
export function finale(display: DisplayDocument, templateId: TemplateId, image: DisplayImage): string {
  const intro = display.blocks.find((block): block is Extract<DisplayBlock, { type: 'intro' }> => block.type === 'intro');
  const copy = FINALE[templateId];
  const meta = [intro?.names, intro?.weddingDate?.replaceAll('-', '.')].filter(Boolean).map(value => e(value)).join(' · ');
  const words = `<div class="finale-copy"><span class="finale-kicker">${e(copy.kicker)}</span><span class="finale-title${copy.latin ? ' latin' : ''}">${e(copy.title)}</span>${meta ? `<span class="finale-meta">${meta}</span>` : ''}</div>`;
  return `${photoFrame(image, { cap: 320, className: 'finale fit-box', alt: '结束画面', coverHook: false })}${words}`;
}

export const componentCss = `
.unit.reveal-unit{margin:4px -32px 26px;max-width:none}
.reveal{margin:0}
.reveal-frame{position:relative;margin:0 auto;overflow:hidden;background:#000}
.reveal-frame img{position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:cover}
.reveal-before{clip-path:inset(0 50% 0 0)}
.reveal-line{position:absolute;top:0;bottom:0;left:50%;width:2px;margin-left:-1px;background:#fff;box-shadow:0 0 10px rgba(0,0,0,.35)}
.reveal-knob{position:absolute;left:50%;top:50%;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;background:#fff;box-shadow:0 3px 12px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;gap:6px}
.reveal-knob i{width:0;height:0;border-top:5px solid transparent;border-bottom:5px solid transparent}
.reveal-knob i:first-child{border-right:6px solid #2a2a2a}.reveal-knob i:last-child{border-left:6px solid #2a2a2a}
.reveal-tag{position:absolute;top:12px;padding:4px 9px 3px;font-size:8.5px;line-height:1.4;letter-spacing:.22em;text-transform:uppercase;color:#fff;background:rgba(0,0,0,.42)}
.reveal-tag-before{left:12px}.reveal-tag-after{right:12px;background:color-mix(in srgb,var(--accent) 82%,#000)}
.reveal-caption{display:flex;justify-content:space-between;gap:14px;padding:10px 32px 0;font-size:11px;letter-spacing:.04em;color:var(--muted)}
.reveal-caption span:first-child{color:var(--foreground);font-family:var(--display);font-weight:600}

.comparison-pair{gap:10px}
.comparison-pair.split{gap:8px}
.comparison-frame{position:relative}
.comparison-tag{position:absolute;left:8px;top:8px;padding:3px 7px 2px;font-size:8px;line-height:1.4;letter-spacing:.2em;text-transform:uppercase;color:#fff;background:rgba(0,0,0,.45);font-family:'Studio Sans',sans-serif;font-style:normal}
.comparison-tag-after{background:color-mix(in srgb,var(--accent) 82%,#000)}
.comparison-pair.split .comparison-tag{left:6px;top:6px;padding:2px 5px 1px;font-size:7px;letter-spacing:.16em}
.comparison-unit{margin-top:22px}
.comparison-description{margin-top:10px}
.unit.reveal-description{margin:-12px 0 6px}

.unit.appendix-unit{margin:0}
.appendix-item{display:grid;grid-template-columns:minmax(0,1fr);gap:16px;padding:16px 0 14px;border-top:1px solid var(--line)}
.appendix-item.with-thumb{grid-template-columns:minmax(0,1fr) 128px;align-items:start}
.appendix-item .detail-heading{font-size:15px;line-height:1.5;margin:0 0 6px}
.appendix-item .detail-copy{font-size:13.5px;line-height:1.75}
.appendix-thumb{margin:0}
.appendix-thumb img{display:block;width:100%;height:auto;max-height:150px;object-fit:contain;background:var(--panel);outline:1px solid var(--line);outline-offset:-1px}
.appendix-thumb figcaption{font-size:10.5px;line-height:1.55;color:var(--muted);padding-top:6px}
.unit.appendix-more{margin:-6px 0 14px}
.appendix-more .detail-copy{font-size:13.5px;line-height:1.75}

.unit.ticket{margin:0;padding:0 20px;background:var(--ticket-bg);border-left:1px solid var(--ticket-line);border-right:1px solid var(--ticket-line)}
.unit.ticket-start{position:relative;margin-top:14px;padding-top:18px;border-top:1px solid var(--ticket-line);border-radius:var(--ticket-radius) var(--ticket-radius) 0 0}
.unit.ticket-end{margin-bottom:18px;padding-bottom:18px;border-bottom:1px solid var(--ticket-line);border-radius:0 0 var(--ticket-radius) var(--ticket-radius)}
.unit.ticket-start.ticket-end{border-radius:var(--ticket-radius)}
.ticket-start:not(.ticket-end):before,.ticket-start:not(.ticket-end):after{content:'';position:absolute;bottom:-9px;width:10px;height:18px;background:var(--background);border:1px solid var(--ticket-line);z-index:2}
.ticket-start:not(.ticket-end):before{left:-1px;border-left:0;border-radius:0 9px 9px 0}
.ticket-start:not(.ticket-end):after{right:-1px;border-right:0;border-radius:9px 0 0 9px}
.ticket .delivery-heading{margin:0;padding:0 0 15px;border-top:0;border-bottom:1px dashed var(--ticket-line)}
.ticket-start.ticket-end .delivery-heading{border-bottom:0;padding-bottom:0}
.ticket .delivery-copy{padding-top:12px}
.ticket .item-format{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;letter-spacing:.04em}
.ticket .chip{display:inline-block;padding:1px 8px;font-size:11px;line-height:1.7;border:1px solid var(--ticket-line);border-radius:999px;color:var(--muted);font-variant-numeric:tabular-nums}
.ticket .delivery-access{background:transparent;border:0;padding:12px 0 0;margin:0}
.ticket .access-note{margin:0;padding-top:12px}
.access-label{display:inline-block;margin-right:10px;font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:var(--accent);vertical-align:1px}

.unit.finale-unit{margin:40px -32px 0;max-width:none}
.finale{position:relative;margin:0}
.finale-copy{display:flex;flex-direction:column;gap:6px;padding:22px 32px 0}
.finale-kicker{font-size:8.5px;letter-spacing:.26em;text-transform:uppercase;color:var(--accent)}
.finale-title{font-family:var(--display);font-size:26px;line-height:1.35;font-weight:600;letter-spacing:.02em;color:var(--foreground)}
.finale-title.latin{font-family:'Studio Serif',Georgia,serif;font-style:italic;font-weight:400;font-size:36px;line-height:1.15;letter-spacing:-.02em}
.finale-meta{font-size:10px;letter-spacing:.14em;color:var(--muted);font-variant-numeric:tabular-nums}
.unit.signature[data-after-finale]{border-top:0;margin-top:0;padding-top:18px}
.signature[data-after-finale] .signature-mark{display:none}
.signature[data-after-finale] .signature-caption{margin-bottom:10px}
`;

export const componentTemplateCss: Record<TemplateId, string> = {
  editorial: `:root{--ticket-bg:#ffffff;--ticket-line:var(--line);--ticket-radius:14px}`,
  cinematic: `:root{--ticket-bg:#1b1e1a;--ticket-line:var(--line);--ticket-radius:3px}
.chapter-index{font-family:'Studio Sans',sans-serif;font-style:normal;font-size:9px;letter-spacing:.26em;color:var(--accent)}
.chapter-index i{font-style:normal;margin-left:12px;color:var(--muted);letter-spacing:.14em;font-variant-numeric:tabular-nums}
.finale-copy{align-items:center;text-align:center}
.finale-title.latin{font-size:46px;font-weight:300}
.signature[data-after-finale]{text-align:center}`,
  archive: `:root{--ticket-bg:#f4f2ea;--ticket-line:#9fa89b;--ticket-radius:0}
.ticket .chip{border-radius:0}
.finale-title.latin{font-style:normal;font-size:30px;letter-spacing:-.03em}`,
  correspondence: `:root{--ticket-bg:#fffaf3;--ticket-line:var(--line);--ticket-radius:6px}
.signature-mark{font-size:24px;line-height:1.3;letter-spacing:-.01em;margin:18px 0 8px;color:var(--muted)}
.signature-name{font-family:'Studio Serif',var(--display),serif;font-style:italic;font-size:26px;line-height:1.3;letter-spacing:-.01em;color:var(--foreground)}
.signature-studio{margin-top:6px}
.ticket .delivery-heading{display:block}`,
  gallery: `:root{--ticket-bg:var(--panel);--ticket-line:var(--line);--ticket-radius:2px}
.reveal-caption span:first-child{font-weight:500}`,
};
