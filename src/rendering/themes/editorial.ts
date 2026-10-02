/**
 * Editorial theme layer — loaded after every other stylesheet, so it has the final word on this
 * template's look. Structure (class names, units, pagination hooks) is shared; only style lives here.
 *
 * Direction: a luxury art book / slow-living magazine. Warm ivory paper, soft near-black ink and a
 * single muted bronze used sparingly; hairline rules; regular-weight serif display (Studio Serif SC
 * for Chinese, Studio Serif for Latin); tracked small-caps labels in Studio Sans; old-style figures.
 * Pictures sit as plates on the text measure (368px); only the finale banner bleeds and dissolves.
 * Spacing scale: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64.
 */
export const editorialTheme = `
:root{--background:#f5f0e6;--foreground:#2b2723;--muted:#6b6157;--line:#ddd3c3;--panel:#ebe4d7;--accent:#86683f;--ticket-bg:#faf6ee;--ticket-line:#e2d8c8;--ticket-radius:0;--ink:#3a342e;--champagne:#c2a77c;--display:'Studio Serif','Studio Serif SC','Studio Sans',serif}

/* ---------- paper, ink, running heads ---------- */
html,body,.render-root,.image-segment,.pdf-page{background:var(--background)}
body{font-size:15px;line-height:1.95;font-weight:350;color:var(--foreground)}
.masthead,.page-masthead{align-items:center;font-family:'Studio Sans',sans-serif;font-size:8.5px;font-weight:400;line-height:1.6;letter-spacing:.3em;text-transform:uppercase;color:var(--muted)}
.masthead{padding-bottom:14px;margin-bottom:40px;border-bottom:1px solid var(--line)}
.image-segment .masthead.unit{margin-bottom:40px}
.page-masthead{height:24px;margin-bottom:12px;border-bottom:1px solid var(--line);align-items:flex-start}
.edition{font-family:'Studio Sans',sans-serif;font-style:normal;font-size:8.5px;letter-spacing:.3em}
.brand-name{font-weight:400}
.page-footer,.image-segment-footer{font-family:'Studio Sans',sans-serif;font-size:8px;letter-spacing:.3em;color:var(--muted);text-transform:uppercase}
.image-segment-footer{margin-top:40px;padding-top:12px;border-top:1px solid var(--line)}
.page-footer{align-items:flex-end}
.page-number,.image-segment-footer span:last-child{font-family:'Studio Serif',Georgia,serif;font-size:10px;letter-spacing:.14em;font-variant-numeric:oldstyle-nums proportional-nums}

/* ---------- body text ---------- */
.body-copy{font-size:15px;line-height:1.95;font-weight:350;letter-spacing:.02em;color:var(--ink)}
.delivery-copy{color:var(--ink)}
.body-copy,.comparison-description,.detail-copy,.tl-note,.access-note{text-wrap:pretty}
.chapter-heading,.cv-headline,.cv-message,.finale-title,.sc-headline,.sc-message,.reveal-title{text-wrap:balance}

/* ---------- cover: a composed magazine opening ---------- */
.cv-editorial{padding-top:8px;padding-bottom:0;text-align:center;align-items:stretch}
.cv-editorial .cv-kicker{gap:16px;margin:0 0 48px;font-family:'Studio Sans',sans-serif;font-size:8.5px;font-weight:400;letter-spacing:.36em;color:var(--muted)}
.cv-editorial .cv-kicker-rule{background:var(--line)}
.cv-editorial .cv-salutation{font-family:var(--display);font-size:14px;letter-spacing:.12em;color:var(--muted);margin:0 0 16px}
.cv-editorial .cv-names{font-size:36px;line-height:1.35;font-weight:300;letter-spacing:.34em;padding-left:.34em;color:var(--foreground)}
.cv-editorial.no-photo .cv-names{font-size:40px}
.cv-editorial .cv-headline{margin-top:16px;font-size:15px;line-height:1.8;font-weight:400;letter-spacing:.16em;padding-left:.16em;color:var(--muted)}
.cv-editorial .cv-rule{width:28px;height:1px;margin:24px auto 0;background:var(--champagne)}
.cv-editorial .cv-bleed{margin-left:0;margin-right:0}
.cv-editorial .cv-photo{height:auto!important;background:transparent;overflow:visible}
.cv-editorial .cv-photo .cv-backdrop{display:none}
.cv-editorial .cv-photo img{width:auto;height:auto;max-width:100%;max-height:300px;margin:0 auto;box-shadow:0 1px 2px rgba(60,44,28,.06),0 18px 32px -24px rgba(60,44,28,.45)}
.cv-editorial.names-first .cv-photo{margin-top:40px}
.cv-editorial.photo-first .cv-photo{margin-bottom:40px}
.cv-editorial .cv-foot{margin-top:32px;padding-top:0;border-top:0;display:flex;flex-direction:column;align-items:center}
.cv-editorial .cv-dates{justify-content:center;gap:40px}
.cv-editorial .cv-date{align-items:center;gap:6px}
.cv-editorial .cv-date-label{font-family:'Studio Sans',sans-serif;font-size:8px;letter-spacing:.32em;color:var(--muted)}
.cv-editorial .cv-date-label i{margin-left:8px;letter-spacing:.2em}
.cv-editorial .cv-date-value{font-family:'Studio Serif',Georgia,serif;font-size:15px;font-weight:300;letter-spacing:.22em;padding-left:.22em;color:var(--foreground);font-variant-numeric:oldstyle-nums proportional-nums}
.cv-editorial .cv-project{margin-top:12px;font-size:11px;letter-spacing:.2em;color:var(--muted)}
.cv-editorial.no-photo{min-height:500px;padding-top:24px;justify-content:space-between}
.cv-editorial .cv-numeral{font-size:96px;font-weight:200;line-height:1;letter-spacing:.02em;margin:0 0 32px;color:var(--champagne);opacity:.55;font-variant-numeric:oldstyle-nums proportional-nums}
.unit.cv-message-unit{margin:32px 0 0}
.cv-editorial-message{padding:0 16px;border-left:0;text-align:center}
.cv-editorial-message .cv-message{font-family:var(--display);font-size:14px;line-height:2;letter-spacing:.08em;color:var(--muted)}
.cv-editorial-message:before{content:'';display:block;width:1px;height:24px;margin:0 auto 16px;background:var(--champagne)}

/* teaser: a quiet colophon line under the opening */
.unit.teaser-unit{margin:40px 0 0}
.teaser-card{gap:20px;padding:16px 0;background:transparent;border:0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);border-radius:0}
.teaser-qr{width:76px;height:76px;padding:5px;background:#fff;box-shadow:0 0 0 1px var(--line)}
.teaser-kicker{font-family:'Studio Sans',sans-serif;font-size:8.5px;letter-spacing:.32em;color:var(--accent)}
.teaser-label{font-family:var(--display);font-size:16px;line-height:1.5;font-weight:400;letter-spacing:.06em;margin-top:4px}
.teaser-host{font-family:'Studio Serif',Georgia,serif;font-size:11.5px;letter-spacing:.06em;color:var(--muted)}
.teaser-hint{font-size:11px;letter-spacing:.08em;color:var(--muted)}
.teaser-play{width:42px;height:42px;background:transparent;border:1px solid var(--champagne)}
.teaser-play:after{left:16px;top:12px;border-left:12px solid var(--accent);border-top:8px solid transparent;border-bottom:8px solid transparent}

/* ---------- chapters: running header (numeral — rule — caption), then a regular serif title ---------- */
.unit.chapter{display:flex;flex-wrap:wrap;align-items:center;column-gap:16px;margin:64px 0 24px;padding-top:0;border-top:0}
.unit.chapter.compact-chapter{margin-top:56px;padding-top:0}
.chapter-index,.compact-chapter .chapter-index{order:0;flex:1 1 auto;min-width:0;display:flex;align-items:center;gap:16px;font-family:'Studio Serif',Georgia,serif;font-style:normal;font-size:13px;font-weight:400;line-height:1.4;letter-spacing:.1em;color:var(--accent);font-variant-numeric:oldstyle-nums proportional-nums}
.chapter-index:after{content:'';flex:1;height:1px;background:var(--line)}
.chapter-caption{order:1;display:block;flex:none;font-family:'Studio Sans',sans-serif;font-size:8.5px;line-height:1.4;letter-spacing:.32em;color:var(--muted)}
.chapter-heading,.compact-chapter .chapter-heading{order:2;flex:0 0 100%;margin:16px 0 0;font-family:var(--display);font-size:21px;line-height:1.6;font-weight:400;letter-spacing:.08em;color:var(--foreground)}
.compact-chapter .chapter-heading{font-size:19px}
.pdf-page .unit.chapter:not(:first-child){margin-top:48px}
.appendix-caption{order:3;flex:0 0 100%;margin:8px 0 0;font-size:13px;line-height:1.8;letter-spacing:.04em;color:var(--muted)}

/* ---------- tickets: lighter, paper-like slips ---------- */
.unit.ticket{display:flow-root;padding:0 24px;background:var(--ticket-bg);border-left:0;border-right:0}
.unit.ticket-start{margin-top:24px;padding-top:24px;border-top:1px solid var(--ticket-line);border-radius:0}
.unit.ticket-end{margin-bottom:16px;padding-bottom:20px;border-bottom:1px solid var(--ticket-line);border-radius:0}
.unit.ticket-start.ticket-end{border-radius:0}
.ticket-start:not(.ticket-end):before,.ticket-start:not(.ticket-end):after{display:none}
.unit.chapter+.unit.ticket-start{margin-top:0}
.ticket .delivery-heading,.ticket-start.ticket-end .delivery-heading{gap:16px;align-items:baseline;margin:0;padding:0;border:0}
.ticket .item-number{flex:none;min-width:22px;font-family:'Studio Serif',Georgia,serif;font-size:17px;font-weight:300;line-height:1.5;padding-top:0;letter-spacing:.04em;color:var(--accent);font-variant-numeric:oldstyle-nums proportional-nums}
.ticket .item-title{font-family:var(--display);font-size:18px;line-height:1.5;font-weight:400;letter-spacing:.08em;color:var(--foreground)}
.ticket .item-format{display:flex;flex-wrap:wrap;gap:0;margin-top:6px;letter-spacing:0}
.ticket .chip{padding:0;border:0;border-radius:0;font-family:'Studio Sans',sans-serif;font-size:9.5px;line-height:1.8;letter-spacing:.24em;text-transform:uppercase;color:var(--muted)}
.ticket .chip+.chip:before{content:'·';margin:0 10px 0 6px;letter-spacing:0;color:var(--champagne)}
.ticket .delivery-copy{padding-top:12px;padding-left:38px;font-size:14.5px;line-height:1.95}
.ticket .access-note{margin:16px 0 0 38px;padding-top:12px;border-top:1px solid var(--ticket-line);font-size:13px;line-height:1.85;letter-spacing:.04em;color:var(--muted)}
.access-label{margin-right:12px;font-family:'Studio Sans',sans-serif;font-size:8.5px;letter-spacing:.3em;color:var(--accent);vertical-align:1px}
.ticket .delivery-access{padding:16px 0 0 38px}
.ticket .qr-links{justify-content:flex-start}
.ticket .qr-link{align-items:flex-start;text-align:left}
.ticket .qr-image{width:132px;height:132px;padding:8px;background:#fff;box-shadow:0 0 0 1px var(--ticket-line)}
.ticket .qr-label{margin-top:12px;font-family:var(--display);font-size:14px;letter-spacing:.06em}
.ticket .qr-host{font-family:'Studio Serif',Georgia,serif;font-size:11.5px;letter-spacing:.04em}
.ticket .qr-hint{margin:8px 0 0 38px;text-align:left;font-size:11px;letter-spacing:.06em}
.delivery-link{font-size:14px;letter-spacing:.04em;border-bottom:1px solid var(--champagne)}
.link-arrow{color:var(--accent)}

/* ---------- highlight stills: plates on the measure, calm captions ---------- */
.unit.stills-hero-unit,.unit.stills-hero-unit.bleed{margin:0 0 16px;max-width:100%}
.still-hero.bleed .still-caption{padding:0}
.still-hero .still-photo{height:auto!important;background:transparent}
.still-hero .still-photo .cv-backdrop{display:none}
.still-hero .still-photo img{width:auto;height:auto;max-width:100%;max-height:380px;margin:0 auto}
.still-row{gap:12px}
.unit.stills-row-unit{margin:0 0 16px}
.unit.stills-last{margin-bottom:24px}
.still-frame{background:var(--panel)}
.still-caption{gap:12px;padding-top:8px;font-size:11.5px;line-height:20px;letter-spacing:.06em;color:var(--muted)}
.still-no{font-family:'Studio Serif',Georgia,serif;font-size:12px;letter-spacing:.08em;color:var(--accent);font-variant-numeric:oldstyle-nums tabular-nums}

/* ---------- timeline: hairline rail, old-style hours ---------- */
.unit.tl{grid-template-columns:56px 28px minmax(0,1fr)}
.tl-time{padding-top:0;font-family:'Studio Serif',Georgia,serif;font-size:15px;line-height:24px;font-weight:300;letter-spacing:.08em;color:var(--accent);font-variant-numeric:oldstyle-nums tabular-nums}
.tl-rail:before{left:13px;background:var(--line)}
.tl-first .tl-rail:before{top:12px}
.tl-last .tl-rail:before{bottom:auto;height:12px}
.tl-dot:after{left:10px;top:9px;width:7px;height:7px;border:1px solid var(--accent);background:var(--background)}
.tl-body{padding:0 0 24px}
.tl-title{font-family:var(--display);font-size:16px;line-height:24px;font-weight:400;letter-spacing:.08em;color:var(--foreground)}
.tl-note{margin-top:4px;font-size:14px;line-height:1.85;letter-spacing:.02em;color:var(--muted)}
.tl-figure{margin:8px 0 0;background:transparent}
.unit.tl-last{margin-bottom:24px}
.unit.tl-last .tl-body{padding-bottom:0}

/* ---------- reveals: gallery plates with small museum tags ---------- */
.unit.reveal-unit{margin:8px -32px 24px}
.reveal-frame{zoom:.85185;background:var(--panel)}
.reveal-line{width:1px;margin-left:0;background:rgba(255,252,246,.86);box-shadow:none}
.reveal-knob{width:30px;height:30px;margin:-15px 0 0 -15px;gap:5px;background:rgba(250,246,238,.92);box-shadow:0 2px 10px rgba(40,28,16,.22)}
.reveal-knob i{border-top-width:4px;border-bottom-width:4px}
.reveal-knob i:first-child{border-right:5px solid var(--accent)}.reveal-knob i:last-child{border-left:5px solid var(--accent)}
.reveal-tag{top:auto;bottom:14px;padding:4px 9px 3px 11px;font-family:'Studio Sans',sans-serif;font-size:10px;line-height:1.4;letter-spacing:.3em;color:var(--muted);background:rgba(248,244,236,.9)}
.reveal-tag-before{left:14px}.reveal-tag-after{right:14px;color:var(--accent);background:rgba(248,244,236,.9)}
.reveal-caption{align-items:baseline;gap:16px;padding:12px 32px 0;font-size:11px;letter-spacing:.08em;color:var(--muted)}
.reveal-title{gap:12px;font-family:var(--display);font-size:15px;line-height:1.6;font-weight:400;letter-spacing:.08em;color:var(--foreground)}
.reveal-no{font-family:'Studio Serif',Georgia,serif;font-size:12px;letter-spacing:.1em;color:var(--accent);font-variant-numeric:oldstyle-nums proportional-nums}
.reveal-hint{font-size:11px;letter-spacing:.08em}
.unit.reveal-description{margin:-12px 0 8px}
.comparison-description{font-size:14px;line-height:1.9;letter-spacing:.02em;color:var(--muted)}
.unit.reveal-unit+.unit.reveal-unit,.unit.reveal-description+.unit.reveal-unit{margin-top:48px}
.comparison-heading{font-family:var(--display);font-size:15px;font-weight:400;letter-spacing:.06em}
.comparison-number{font-family:'Studio Serif',Georgia,serif;font-size:12px;letter-spacing:.1em;color:var(--accent);font-variant-numeric:oldstyle-nums}
.comparison-frame{background:var(--panel)}
.comparison-tag,.comparison-pair.split .comparison-tag{left:8px;top:auto;bottom:8px;padding:3px 7px 2px 8px;font-size:8px;letter-spacing:.26em;color:var(--muted);background:rgba(248,244,236,.9)}
.comparison-tag-after{color:var(--accent)}

/* ---------- production details & appendix ---------- */
.detail-heading{font-family:var(--display);font-size:16px;font-weight:400;letter-spacing:.06em}
.detail-copy{font-size:14px;line-height:1.9;letter-spacing:.02em;color:var(--muted)}
.production-figure{padding:0;border:0;background:transparent}
.production-figure figcaption{font-size:11.5px;line-height:1.8;letter-spacing:.04em;padding-top:8px}
.appendix-item{gap:20px;padding:20px 0 16px;border-top:1px solid var(--line)}
.appendix-item.with-thumb{grid-template-columns:minmax(0,1fr) 116px}
.appendix-item .detail-heading{margin:0 0 8px;font-size:15px;line-height:1.6;font-weight:400;letter-spacing:.08em}
.appendix-item .detail-copy,.appendix-more .detail-copy{font-size:14px;line-height:1.85}
.appendix-thumb img{background:var(--panel);outline:1px solid var(--line)}
.appendix-thumb figcaption{padding-top:8px;font-size:11px;line-height:1.6;letter-spacing:.02em}
.unit.chapter.appendix-start{margin-bottom:16px}

/* ---------- finale: a dissolving, sunlit banner and an airy block of words ---------- */
.unit.finale-unit{margin:72px -32px 0;max-width:none}
/* Two nested single-layer masks (frame: horizontal, picture + veil: vertical) multiply into a soft
   feather on every edge; mask-composite is not honoured when Chromium prints the PDF. */
.finale-frame{aspect-ratio:2.4/1;background:transparent;-webkit-mask-image:linear-gradient(90deg,transparent 0,rgba(0,0,0,.5) 12%,#000 30%,#000 70%,rgba(0,0,0,.5) 88%,transparent 100%);mask-image:linear-gradient(90deg,transparent 0,rgba(0,0,0,.5) 12%,#000 30%,#000 70%,rgba(0,0,0,.5) 88%,transparent 100%);-webkit-mask-composite:source-over;mask-composite:add}
.finale-frame img,.finale-veil{-webkit-mask-image:linear-gradient(180deg,transparent 0,rgba(0,0,0,.6) 14%,#000 32%,#000 52%,rgba(0,0,0,.35) 76%,transparent 96%);mask-image:linear-gradient(180deg,transparent 0,rgba(0,0,0,.6) 14%,#000 32%,#000 52%,rgba(0,0,0,.35) 76%,transparent 96%)}
.finale-frame img{object-position:50% 42%;filter:sepia(.34) saturate(.78) contrast(.94) brightness(1.03)}
.finale-veil{background:radial-gradient(ellipse 40% 95% at 24% 0,rgba(255,238,206,.78),rgba(255,238,206,0) 100%),linear-gradient(105deg,rgba(255,228,184,.26),rgba(255,228,184,0) 60%),radial-gradient(ellipse 60% 60% at 50% 100%,rgba(245,240,230,.55),rgba(245,240,230,0) 100%);mix-blend-mode:normal}
.finale-copy{position:relative;align-items:center;text-align:center;gap:0;margin-top:-4px;padding:0 48px}
.finale-kicker{font-family:'Studio Sans',sans-serif;font-size:8.5px;line-height:1.6;letter-spacing:.42em;padding-left:.42em;color:var(--accent)}
.finale-title{margin-top:16px;font-family:var(--display);font-size:20px;line-height:1.7;font-weight:300;letter-spacing:.32em;padding-left:.32em;color:var(--foreground)}
.finale-meta{display:block;font-family:'Studio Sans',sans-serif;font-size:9.5px;line-height:1.6;letter-spacing:.3em;padding-left:.3em;color:var(--muted);font-variant-numeric:oldstyle-nums proportional-nums}
.finale-meta:before{content:'';display:block;width:28px;height:1px;margin:20px auto 16px;background:var(--champagne)}

/* ---------- signature & closing ---------- */
.unit.signature{margin-top:64px;padding:40px 0 8px;border-top:1px solid var(--line);text-align:center}
.signature-caption{font-family:'Studio Sans',sans-serif;font-size:11px;letter-spacing:.3em}
.signature-mark{margin:16px 0 24px;font-family:var(--display);font-size:20px;line-height:1.85;font-weight:300;letter-spacing:.12em;color:var(--foreground)}
.signature-name{font-family:var(--display);font-size:16px;line-height:1.6;font-weight:400;letter-spacing:.2em}
.signature-studio{margin-top:4px;font-family:'Studio Sans',sans-serif;font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:var(--muted)}
.unit.signature[data-after-finale]{margin-top:0;padding:40px 0 0;border-top:0;text-align:center}
.signature[data-after-finale] .signature-caption{margin-bottom:12px;padding-left:.3em}
.signature[data-after-finale] .signature-name,.signature[data-after-finale] .signature-studio{padding-left:.2em}
.unit.closing{margin-top:40px;padding-top:0;border-top:0;text-align:center;font-family:'Studio Sans',sans-serif;font-size:11px;line-height:1.8;letter-spacing:.24em;padding-left:.24em;color:var(--muted)}
.unit.closing:before{content:'';display:block;width:1px;height:24px;margin:0 auto 16px;background:var(--champagne)}

/* ---------- share card: a printed magazine keepsake ---------- */
.sc-editorial{background:var(--background)}
.sc-editorial:before{content:'';position:absolute;inset:14px;border:1px solid var(--line);pointer-events:none}
.sc-editorial .sc-top{margin:0 32px;padding:34px 0 12px;border-bottom:1px solid var(--line);font-family:'Studio Sans',sans-serif;font-size:8.5px;letter-spacing:.32em;color:var(--muted)}
.sc-editorial .sc-brand{font-weight:400;color:var(--foreground)}
.sc-editorial .sc-label{font-size:8.5px;letter-spacing:.32em}
.sc-editorial .sc-photo{zoom:.85185;margin-top:32px}
.sc-editorial .sc-shot{background:var(--panel)}
.sc-editorial .sc-main{box-shadow:0 20px 36px -26px rgba(60,44,28,.5)}
.sc-editorial .sc-photo-empty{zoom:1;height:240px;margin:24px 32px 0;background:transparent;border-top:1px solid var(--line);border-bottom:1px solid var(--line);font-family:var(--display);font-style:normal;font-size:28px;font-weight:300;line-height:1.6;letter-spacing:.2em;color:var(--foreground)}
.sc-editorial .sc-body{align-items:center;text-align:center;padding:16px 44px}
.sc-editorial .sc-kicker{margin:0 0 16px;font-family:'Studio Sans',sans-serif;font-size:8.5px;letter-spacing:.42em;padding-left:.42em;color:var(--accent)}
.sc-editorial .sc-names{font-size:34px;line-height:1.35;font-weight:300;letter-spacing:.32em;padding-left:.32em}
.sc-editorial .sc-names:after{width:28px;height:1px;margin:16px auto 0;background:var(--champagne)}
.sc-editorial .sc-headline{margin-top:16px;font-size:14px;line-height:1.8;letter-spacing:.16em;padding-left:.16em;color:var(--foreground)}
.sc-editorial .sc-message{margin-top:8px;font-size:12px;line-height:1.85;letter-spacing:.06em;color:var(--muted)}
.sc-editorial .sc-date{margin-top:16px;font-size:12px;font-weight:300;letter-spacing:.32em;padding-left:.32em;color:var(--muted);font-variant-numeric:oldstyle-nums proportional-nums}
.share-card.sc-editorial:is([data-layout=single],[data-layout=empty]) .sc-kicker{font-size:9px;margin-bottom:20px}
.share-card.sc-editorial:is([data-layout=single],[data-layout=empty]) .sc-names{font-size:40px}
.sc-editorial:is([data-layout=single],[data-layout=empty]) .sc-names:after{width:32px;margin-top:20px}
.share-card.sc-editorial:is([data-layout=single],[data-layout=empty]) .sc-headline{font-size:16px;margin-top:20px}
.share-card.sc-editorial:is([data-layout=single],[data-layout=empty]) .sc-message{font-size:13px;margin-top:12px}
.share-card.sc-editorial:is([data-layout=single],[data-layout=empty]) .sc-date{font-size:14px;margin-top:24px}
.sc-editorial .sc-foot{margin:0 32px 34px;padding-top:16px;border-top:1px solid var(--line);justify-content:center;gap:16px;font-size:10px;letter-spacing:.24em;color:var(--muted)}
.sc-editorial .sc-teaser img{width:60px;height:60px;padding:4px;box-shadow:0 0 0 1px var(--line)}
.sc-editorial .sc-teaser b{font-family:'Studio Sans',sans-serif;font-size:8.5px;font-weight:400;letter-spacing:.32em;color:var(--accent)}
.sc-editorial .sc-teaser i{font-size:13px;letter-spacing:.08em;color:var(--foreground)}
`;
