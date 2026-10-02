# Bundled fonts

Noto Sans SC, Noto Serif SC and Source Serif 4 are distributed under the SIL Open Font License 1.1.
The font files and their copyright/license texts are included here for offline rendering.

- Noto Sans SC: https://github.com/google/fonts/tree/main/ofl/notosanssc (unmodified)
- Source Serif 4: https://github.com/google/fonts/tree/main/ofl/sourceserif4 (unmodified)
- Noto Serif SC: https://github.com/google/fonts/tree/main/ofl/notoserifsc — `NotoSerifSC-GB2312.ttf` is a subset
  of `NotoSerifSC[wght].ttf` (sha256 `050080d9255a86808f2945bffac582b31ef32bc36411ce29563b4961670c66f9`) keeping the
  variable `wght` axis (200–900), all layout features, GB2312 characters, ASCII/Latin-1, general punctuation,
  CJK symbols and full-width forms. It is used only for display headings; other characters fall back to Noto Sans SC.
  Produced with fontTools 4.66.1:
  `pyftsubset 'NotoSerifSC[wght].ttf' --text-file=serif-chars.txt --layout-features='*' --no-hinting --desubroutinize --output-file=NotoSerifSC-GB2312.ttf`

Noto Sans SC and Source Serif 4 were downloaded on 2026-09-26; Noto Serif SC on 2026-10-01.
The application renders locally and does not fetch Google Fonts at runtime.
