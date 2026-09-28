import { create, type Font } from 'fontkit';
import type { Issue } from '../shared/model.js';
import { fontBytes, makeIssue, type DisplayDocument } from './display.js';

const parsedFonts = new Map<string, Font[]>();
export async function checkGlyphCoverage(display: DisplayDocument, rootDir: string): Promise<Issue[]> {
  const fonts: Font[] = [];
  for (const filename of ['NotoSansSC.ttf', 'SourceSerif4.ttf']) {
    let loaded: Awaited<ReturnType<typeof fontBytes>>;
    try { loaded = await fontBytes(rootDir, filename); }
    catch { return []; } // loadFonts blocks formal output and warns during quick preview.
    try {
      if (!parsedFonts.has(loaded.hash)) {
        const parsed = create(loaded.bytes);
        parsedFonts.set(loaded.hash, 'fonts' in parsed ? parsed.fonts : [parsed]);
      }
      fonts.push(...parsedFonts.get(loaded.hash)!);
    } catch { return [makeIssue('FONT_INVALID', `${filename} 不能读取，请恢复随应用提供的字体文件。`)]; }
  }
  const texts: { value: string | undefined; blockId?: string; comparisonId?: string }[] = [];
  if (!display.logo) texts.push({ value: display.studio });
  texts.push({ value: display.tagline });
  for (const block of display.blocks) {
    if (block.type !== 'intro') texts.push({ value: block.title, blockId: block.id });
    if (block.type === 'intro') for (const value of [block.salutation, block.names, block.weddingDate, block.deliveryDate, block.projectNo, block.cover?.headline, block.cover?.message]) texts.push({ value, blockId: block.id });
    if (block.type === 'text') for (const value of [block.content, block.details?.content, block.details?.image ? block.details.caption : undefined]) texts.push({ value, blockId: block.id });
    if (block.type === 'signature') for (const value of [block.photographer, block.studio]) texts.push({ value, blockId: block.id });
    if (block.type === 'deliveries') for (const item of block.items) for (const value of [item.title, item.description, item.format, item.accessNote]) texts.push({ value, blockId: block.id });
    if (block.type === 'comparisons') for (const comparison of block.comparisons) for (const value of [comparison.title, comparison.description]) texts.push({ value, blockId: block.id, comparisonId: comparison.id });
  }
  const missing = new Map<string, { characters: Set<string>; blockId?: string; comparisonId?: string }>();
  const coverage = new Map<number, boolean>();
  for (const text of texts) {
    for (const character of text.value ?? '') {
      const codepoint = character.codePointAt(0)!;
      if (/\s/u.test(character) || codepoint === 0xfe0f || codepoint === 0xfe0e || codepoint === 0x200d) continue;
      if (!coverage.has(codepoint)) coverage.set(codepoint, fonts.some(font => font.hasGlyphForCodePoint(codepoint)));
      if (coverage.get(codepoint)) continue;
      const key = `${text.blockId ?? 'brand'}:${text.comparisonId ?? ''}`;
      if (!missing.has(key)) missing.set(key, { characters: new Set(), blockId: text.blockId, comparisonId: text.comparisonId });
      missing.get(key)!.characters.add(character);
    }
  }
  return [...missing.values()].map(item => makeIssue('FONT_GLYPH_MISSING', `当前打包字体缺少字形：${[...item.characters].slice(0, 8).map(character => `${character} (U+${character.codePointAt(0)!.toString(16).toUpperCase()})`).join('、')}。请使用覆盖这些字符的授权字体，或修改对应文字。`, 'error', 'all', { blockId: item.blockId, comparisonId: item.comparisonId }));
}
