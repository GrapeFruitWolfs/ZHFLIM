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
