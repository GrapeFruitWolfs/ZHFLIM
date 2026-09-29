import { type DocumentBlock } from './model.js';

export const isFixedChapter = (block: DocumentBlock) => block.type === 'intro' || block.type === 'signature';

/** Keep middle chapters in their saved order; the cover and signature are anchors. */
export function normalizeChapters(blocks: DocumentBlock[]): DocumentBlock[] {
  const ordered = [...blocks].sort((a, b) => a.order - b.order);
  return [
    ...ordered.filter(block => block.type === 'intro'),
    ...ordered.filter(block => !isFixedChapter(block)),
    ...ordered.filter(block => block.type === 'signature'),
  ].map((block, order) => ({ ...block, order }));
}

/** Legacy documents may have deleted their anchors. Restore hidden, stable controls. */
export function ensureChapterAnchors(blocks: DocumentBlock[], documentId: string): DocumentBlock[] {
  const next = [...blocks];
  for (const type of ['intro', 'signature'] as const) {
    if (!next.some(block => block.type === type)) {
      let id = `${documentId}-${type}`;
      while (next.some(block => block.id === id)) id += '-anchor';
      next.push({ id, type, title: type === 'intro' ? '序言与新人信息' : '摄影师署名', visible: false, order: next.length });
    }
  }
  return normalizeChapters(next);
}

export function moveChapter(blocks: DocumentBlock[], id: string, targetIndex: number): DocumentBlock[] {
  const ordered = normalizeChapters(blocks);
  const index = ordered.findIndex(block => block.id === id);
  if (index < 0 || isFixedChapter(ordered[index])) return ordered;
  const first = ordered.findIndex(block => !isFixedChapter(block));
  const last = ordered.findLastIndex(block => !isFixedChapter(block));
  const [moved] = ordered.splice(index, 1);
  ordered.splice(Math.max(first, Math.min(last, targetIndex)), 0, moved);
  return ordered.map((block, order) => ({ ...block, order }));
}
