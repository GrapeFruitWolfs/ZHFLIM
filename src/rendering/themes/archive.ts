/**
 * Archive theme layer — loaded after every other stylesheet, so it has the final word on this
 * template's look. Structure (class names, units, pagination hooks) is shared; only style lives here.
 *
 * Language: a museum conservation archive / Japanese photo-book catalogue. Cool stone-linen paper,
 * deep green-black ink, one oxidised-copper (verdigris) accent. Studio Sans throughout at light and
 * regular weights with tracked tabular numerals (FIG. 01, RECORD 01, 08:30 HRS); Studio Serif only
 * for the two Latin titles. A strict two-column grid: an 88px index column for labels and numbers,
 * the text column hanging from x = 88 (chapters, body copy, ledger, tickets, timeline, captions).
 * Pictures are specimens on thin white mounts with a hairline. Spacing scale: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64.
 */
export const archiveTheme = `
:root{--background:#ecebe5;--foreground:#1d2924;--muted:#5a625c;--line:#c8cac1;--panel:#e2e2db;--accent:#4f6b5c;--ticket-bg:#f4f3ee;--ticket-line:#c3c6bc;--ticket-radius:0;--mount:#f8f7f3;--hair:#b9bcb2;--grid:88px;--display:'Studio Sans','Studio Serif SC',sans-serif}

/* ---------- paper, ink, running heads ---------- */
html,body,.render-root,.image-segment,.pdf-page{background:var(--background)}
body{font-size:15px;line-height:1.95;font-weight:350;color:var(--foreground);font-variant-numeric:tabular-nums lining-nums}
.masthead,.page-masthead{align-items:baseline;font-family:'Studio Sans',sans-serif;font-size:8.5px;font-weight:400;line-height:1.6;letter-spacing:.26em;text-transform:uppercase;color:var(--foreground)}
.masthead{padding-bottom:12px;margin-bottom:32px;border-bottom:1px solid var(--foreground)}
.image-segment .masthead.unit{margin-bottom:32px}
.page-masthead{height:24px;margin-bottom:12px;border-bottom:1px solid var(--foreground)}
.brand-name{font-weight:500}
.edition,.masthead .edition,.page-masthead .edition{font-family:'Studio Sans',sans-serif;font-style:normal;font-size:8.5px;letter-spacing:.26em;color:var(--muted)}
.page-footer,.image-segment-footer{font-family:'Studio Sans',sans-serif;font-size:8px;letter-spacing:.26em;text-transform:uppercase;color:var(--muted);font-variant-numeric:tabular-nums}
.image-segment-footer{margin-top:32px;padding-top:12px;border-top:1px solid var(--hair)}
.page-footer{align-items:flex-end;border-top:1px solid var(--line);padding-top:6px;box-sizing:border-box}
.page-number,.image-segment-footer span:last-child{letter-spacing:.18em;color:var(--foreground)}

/* ---------- body text hangs from the grid line ---------- */
.body-copy{font-size:15px;line-height:1.95;font-weight:350;letter-spacing:.02em;color:var(--foreground)}
.body-copy:not(.delivery-copy),.comparison-description,.unit.detail-unit:not(.appendix-unit):not(.appendix-more)>.detail-copy,.unit.detail-unit>.detail-heading{margin-left:var(--grid)}
.body-copy,.comparison-description,.detail-copy,.tl-note,.access-note,.cv-message{text-wrap:pretty}
.chapter-heading,.finale-title,.sc-headline,.sc-message{text-wrap:balance}

/* ---------- cover: a catalogue title page ---------- */
.cv-archive{padding-top:0;padding-bottom:0}
.cv-archive:before{display:none}
.cv-register{padding-top:0;font-family:'Studio Sans',sans-serif;font-size:8px;line-height:1.6;letter-spacing:.28em;color:var(--muted)}
.cv-register span:last-child{color:var(--foreground)}
.cv-archive-title,.cv-archive.no-photo .cv-archive-title{font-family:'Studio Serif',Georgia,serif;font-size:34px;font-weight:300;line-height:1.12;letter-spacing:-.012em;margin:48px 0 12px;color:var(--foreground)}
.cv-archive.no-photo .cv-archive-title{font-size:42px;margin:64px 0 16px}
.cv-archive-label{font-family:'Studio Sans',sans-serif;font-size:8px;line-height:1.6;letter-spacing:.32em;color:var(--accent);margin:0 0 32px}
.cv-print{padding:8px 8px 0;background:var(--mount);border:0;box-shadow:0 0 0 1px var(--hair);margin:0 0 40px}
.cv-print .cv-photo{background:var(--panel)}
.cv-print-caption{flex-direction:column;align-items:flex-start;gap:0;padding:8px 120px 9px 0;font-family:'Studio Sans',sans-serif;font-size:8px;line-height:1.6;letter-spacing:.24em;color:var(--muted)}
.cv-print-caption span:first-child{color:var(--foreground)}
.cv-stamp,.cv-archive.no-photo .cv-stamp{width:auto;height:auto;border-radius:0;border:1px solid var(--accent);box-shadow:inset 0 0 0 2px var(--background),inset 0 0 0 3px color-mix(in srgb,var(--accent) 55%,transparent);background:var(--background);transform:none;gap:1px;padding:7px 12px 6px;color:var(--accent)}
.cv-stamp{right:12px;bottom:-16px}
.cv-stamp span{font-family:'Studio Sans',sans-serif;font-size:7px;line-height:1.5;letter-spacing:.3em;padding-left:.3em}
.cv-stamp b{font-family:'Studio Sans',sans-serif;font-size:11px;line-height:1.5;font-weight:500;letter-spacing:.14em;padding-left:.14em}
.cv-archive.no-photo .cv-stamp{margin:0 0 32px;align-self:flex-start}
.cv-archive .cv-salutation{margin:0 0 16px var(--grid);font-size:13px;letter-spacing:.06em;color:var(--muted)}
.cv-archive .archive-ledger{margin:0;border-top:1px solid var(--foreground);border-bottom:0}
.cv-archive .archive-ledger>div{grid-template-columns:var(--grid) minmax(0,1fr);gap:0;padding:12px 0 11px;border-bottom:1px solid var(--line);align-items:baseline}
.cv-archive .archive-ledger>div:last-child{border-bottom:1px solid var(--hair)}
.cv-archive .archive-ledger dt{padding-top:0;font-family:'Studio Sans',sans-serif;font-size:8px;line-height:1.6;letter-spacing:.24em;color:var(--muted)}
.cv-archive .archive-ledger dd{font-size:14px;line-height:1.6;letter-spacing:.04em;color:var(--foreground)}
.cv-archive .archive-ledger .archive-names{font-family:'Studio Sans',sans-serif;font-size:24px;line-height:1.3;font-weight:300;letter-spacing:.16em}
.cv-archive .archive-ledger .archive-date{font-family:'Studio Sans',sans-serif;font-size:14px;font-weight:350;letter-spacing:.14em}
.cv-archive .archive-ledger .archive-note{font-family:'Studio Sans',sans-serif;font-size:14px;font-weight:350;letter-spacing:.06em}
.unit.cv-message-unit{margin:24px 0 0}
.cv-archive-message{padding-left:var(--grid)}
.cv-archive-message .cv-message{font-size:14px;line-height:1.95;letter-spacing:.03em;color:var(--muted)}

/* teaser: an index card with a punched stub */
.unit.teaser-unit{margin:40px 0 0}
.teaser-card{position:relative;display:grid;grid-template-columns:56px minmax(0,1fr) auto;column-gap:16px;align-items:center;padding:16px;background:var(--ticket-bg);border:1px solid var(--ticket-line);border-radius:0}
.teaser-card:before{content:'';position:absolute;left:28px;top:50%;width:8px;height:8px;margin:-4px 0 0 -4px;border-radius:50%;border:0;background:var(--background);box-shadow:inset 0 0 0 1px var(--ticket-line)}
.teaser-card:after{content:'';position:absolute;left:56px;top:0;bottom:0;border-left:1px solid var(--line)}
.teaser-card .teaser-text{grid-column:2;gap:2px}
.teaser-card .teaser-stub{grid-column:3;grid-row:1;padding:4px;background:#fff;box-shadow:0 0 0 1px var(--line)}
.teaser-card .teaser-qr{width:72px;height:72px;outline:0}
.teaser-card .teaser-play{grid-column:1;grid-row:1;justify-self:center;width:30px;height:30px;background:transparent;box-shadow:inset 0 0 0 1px var(--accent);z-index:1}
.teaser-card.teaser-link:before{display:none}
.teaser-play:after{left:12px;top:9px;border-left:8px solid var(--accent);border-top:6px solid transparent;border-bottom:6px solid transparent}
.teaser-kicker{font-family:'Studio Sans',sans-serif;font-size:9px;line-height:1.6;letter-spacing:.24em;color:var(--accent)}
.teaser-label{font-family:'Studio Sans',sans-serif;font-size:15px;line-height:1.6;font-weight:400;letter-spacing:.06em;margin-top:4px}
.teaser-host{font-size:11px;letter-spacing:.08em;color:var(--muted)}
.teaser-hint{font-size:11px;letter-spacing:.06em;color:var(--muted)}

/* ---------- chapters: catalogue section dividers ---------- */
.unit.chapter,.unit.chapter.compact-chapter{display:grid;grid-template-columns:var(--grid) minmax(0,1fr);gap:0;align-items:start;margin:64px 0 24px;padding-top:10px;border-top:1px solid var(--foreground)}
.unit.chapter.compact-chapter{margin-top:48px;margin-bottom:16px}
.pdf-page .unit.chapter:not(:first-child){margin-top:48px}
.pdf-page .page-body>.unit.chapter:first-child{margin-top:20px}
.chapter-index,.compact-chapter .chapter-index{display:block;font-family:'Studio Sans',sans-serif;font-style:normal;margin-top:-8px;font-size:24px;font-weight:200;line-height:30px;letter-spacing:.02em;color:var(--foreground);font-variant-numeric:tabular-nums lining-nums}
.chapter-index::first-line{font-size:8px;font-weight:400;letter-spacing:.28em;color:var(--muted)}
.chapter>div{display:flex;flex-direction:column;min-width:0}
.chapter-caption{order:-1;font-family:'Studio Sans',sans-serif;font-size:8px;line-height:13px;letter-spacing:.28em;color:var(--accent)}
.chapter-heading,.compact-chapter .chapter-heading{margin:8px 0 0;font-family:'Studio Sans',sans-serif;font-size:20px;line-height:1.55;font-weight:300;letter-spacing:.08em;color:var(--foreground)}
.compact-chapter .chapter-heading{font-size:18px}
.chapter>div>.chapter-heading:not(:has(+ .chapter-caption)){margin-top:21px}
.appendix-caption{margin:8px 0 0;font-size:13px;line-height:1.8;letter-spacing:.03em;color:var(--muted)}
.unit.chapter.appendix-start{margin-bottom:16px}
.compact-context{font-size:12px;letter-spacing:.06em;font-weight:500}

/* ---------- tickets: archive index cards ---------- */
.unit.ticket{display:flow-root;padding:0 16px;background:var(--ticket-bg);border-left:1px solid var(--ticket-line);border-right:1px solid var(--ticket-line)}
.unit.ticket-start{margin-top:16px;padding-top:0;border-top:1px solid var(--ticket-line);border-radius:0}
.unit.ticket-end{margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid var(--ticket-line);border-radius:0}
.unit.ticket-start.ticket-end{border-radius:0}
.unit.chapter+.unit.ticket-start{margin-top:0}
.ticket-start:not(.ticket-end):before,.ticket-start:not(.ticket-end):after{display:none}
.ticket .delivery-heading,.ticket-start.ticket-end .delivery-heading{display:grid;grid-template-columns:72px minmax(0,1fr);gap:0;align-items:baseline;margin:0 -16px;padding:14px 16px 13px;border:0;border-bottom:1px solid var(--line)}
.ticket .item-number{min-width:0;padding-top:0;font-family:'Studio Sans',sans-serif;font-size:8px;font-weight:400;line-height:1.6;letter-spacing:.24em;color:var(--accent)}
.ticket .item-title{font-family:'Studio Sans',sans-serif;font-size:16px;line-height:1.6;font-weight:400;letter-spacing:.06em;color:var(--foreground)}
.ticket .item-format{display:flex;flex-wrap:wrap;gap:0;margin-top:4px;letter-spacing:0}
.ticket .chip{padding:0;border:0;border-radius:0;font-family:'Studio Sans',sans-serif;font-size:10px;line-height:1.8;letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}
.ticket .chip+.chip:before{content:'/';margin:0 8px 0 6px;letter-spacing:0;color:var(--hair)}
.ticket .delivery-copy{padding-top:12px;padding-left:72px;font-size:14px;line-height:1.9}
.ticket .access-note{margin:0;padding:12px 0 0 72px;font-size:13px;line-height:1.85;letter-spacing:.03em;color:var(--muted);position:relative}
.ticket .access-label{position:absolute;left:0;top:12px;margin:0;font-family:'Studio Sans',sans-serif;font-size:10px;line-height:24px;letter-spacing:.14em;color:var(--accent)}
.ticket .delivery-access{padding:16px 0 0 72px}
.ticket .qr-links{justify-content:flex-start}
.ticket .qr-link{align-items:flex-start;text-align:left}
.ticket .qr-image{width:128px;height:128px;padding:6px;background:#fff;box-shadow:0 0 0 1px var(--line)}
.ticket .qr-label{margin-top:8px;font-size:14px;letter-spacing:.06em}
.ticket .qr-host{font-size:11px;letter-spacing:.06em}
.ticket .qr-hint{margin:8px 0 0 72px;text-align:left;font-size:11px;letter-spacing:.04em}
.delivery-link{font-size:14px;letter-spacing:.04em;border-bottom:1px solid var(--accent)}
.link-arrow{color:var(--accent)}

/* ---------- stills: specimens on mounts (the mount carries the catalogue caption) ---------- */
.unit.stills-hero-unit{margin:0 0 16px}
.still-hero,.still-cell{padding:6px;background:var(--mount);box-shadow:0 0 0 1px var(--hair)}
.still-hero{padding:8px}
.still-row{gap:16px;align-items:stretch}
.still-frame{background:var(--panel);border:0;outline:0;box-shadow:none}
.unit.stills-row-unit{margin:0 0 16px}
.unit.stills-last{margin-bottom:24px}
.still-caption{gap:8px;padding:7px 2px 1px;font-size:11.5px;line-height:20px;letter-spacing:.04em;color:var(--muted)}
.still-hero .still-caption,.still-cell.wide .still-caption{display:grid;grid-template-columns:calc(var(--grid) - 10px) minmax(0,1fr);gap:0}
.still-hero .still-caption{padding-top:8px}
.still-no{font-family:'Studio Sans',sans-serif;font-size:8px;letter-spacing:.24em;color:var(--accent);font-variant-numeric:tabular-nums}
.still-text{color:var(--foreground)}

/* ---------- timeline: a register of hours ---------- */
.unit.tl{grid-template-columns:64px 24px minmax(0,1fr)}
.tl-time{padding-top:0;font-family:'Studio Sans',sans-serif;font-size:13px;line-height:24px;font-weight:350;letter-spacing:.08em;color:var(--foreground);font-variant-numeric:tabular-nums}
.tl-time:not(:empty):after{content:'HRS';display:block;margin-top:-4px;font-size:7.5px;line-height:12px;letter-spacing:.28em;color:var(--muted)}
.tl-rail:before{left:4px;background:var(--hair)}
.tl-first .tl-rail:before{top:12px}
.tl-last .tl-rail:before{bottom:auto;height:12px}
.tl-dot:after{left:1px;top:9px;width:7px;height:7px;border-radius:0;border:1px solid var(--accent);background:var(--background)}
.tl-body{padding:0 0 24px}
.tl-title{font-family:'Studio Sans',sans-serif;font-size:15px;line-height:24px;font-weight:400;letter-spacing:.06em;color:var(--foreground)}
.tl-note{margin-top:4px;font-size:13.5px;line-height:1.85;letter-spacing:.02em;color:var(--muted)}
.tl-figure{margin:8px 0 0;padding:5px;background:var(--mount);box-shadow:0 0 0 1px var(--hair)}
.unit.tl-last{margin-bottom:24px}
.unit.tl-last .tl-body{padding-bottom:0}

/* ---------- reveals: conservation before / after plates ---------- */
.unit.reveal-unit{margin:8px -32px 24px}
.reveal-frame{box-sizing:content-box;zoom:.81416;border:10px solid var(--mount);background:var(--panel);box-shadow:0 0 0 1.25px var(--hair)}
.reveal-line{width:1px;margin-left:0;background:rgba(248,247,243,.9);box-shadow:none}
.reveal-knob{width:28px;height:28px;margin:-14px 0 0 -14px;gap:5px;background:rgba(248,247,243,.94);box-shadow:0 0 0 1px rgba(29,41,36,.12)}
.reveal-knob i{border-top-width:4px;border-bottom-width:4px}
.reveal-knob i:first-child{border-right:5px solid var(--foreground)}.reveal-knob i:last-child{border-left:5px solid var(--foreground)}
.reveal-tag{top:auto;bottom:12px;padding:4px 9px 3px 11px;font-family:'Studio Sans',sans-serif;font-size:10px;line-height:1.4;letter-spacing:.3em;color:var(--foreground);background:rgba(248,247,243,.92)}
.reveal-tag-before{left:12px}.reveal-tag-after{right:12px;color:var(--accent);background:rgba(248,247,243,.92)}
.reveal-caption{display:grid;grid-template-columns:var(--grid) minmax(0,1fr);align-items:baseline;gap:4px 0;padding:12px 32px 0;font-size:11px;letter-spacing:.04em;color:var(--muted)}
.reveal-title{display:contents;font-family:'Studio Sans',sans-serif;font-size:14px;line-height:1.6;font-weight:400;letter-spacing:.06em;color:var(--foreground)}
.reveal-no{font-family:'Studio Sans',sans-serif;font-size:8px;letter-spacing:.24em;color:var(--accent)}
.reveal-hint{grid-column:2;font-size:11px;letter-spacing:.06em;white-space:normal}
.unit.reveal-description{margin:-8px 0 8px}
.comparison-description{font-size:13.5px;line-height:1.9;letter-spacing:.02em;color:var(--muted)}
.unit.reveal-unit+.unit.reveal-unit,.unit.reveal-description+.unit.reveal-unit{margin-top:40px}
.comparison-heading{padding:8px 0;border-top:1px solid var(--foreground);border-bottom:1px solid var(--line);font-family:'Studio Sans',sans-serif;font-size:14px;font-weight:400;letter-spacing:.06em}
.comparison-number{font-family:'Studio Sans',sans-serif;font-size:8px;font-style:normal;letter-spacing:.24em;color:var(--accent)}
.comparison-frame{background:var(--mount);border:5px solid var(--mount);box-shadow:0 0 0 1px var(--hair)}
.comparison-tag,.comparison-pair.split .comparison-tag{left:6px;top:auto;bottom:6px;padding:2px 6px 1px 7px;font-size:8px;letter-spacing:.24em;color:var(--foreground);background:rgba(248,247,243,.92)}
.comparison-tag-after{color:var(--accent)}

/* ---------- production details & appendix: index entries ---------- */
.detail-heading{font-family:'Studio Sans',sans-serif;font-size:15px;font-weight:500;letter-spacing:.04em}
.detail-copy{font-size:13.5px;line-height:1.9;letter-spacing:.02em;color:var(--muted)}
.production-figure{padding:6px;border:0;background:var(--mount);box-shadow:0 0 0 1px var(--hair)}
.production-figure figcaption{font-size:11px;line-height:1.75;letter-spacing:.04em;padding:8px 2px 2px}
.appendix-item{gap:16px;padding:16px 0;border-top:1px solid var(--line)}
.appendix-item.with-thumb{grid-template-columns:minmax(0,1fr) 120px}
.appendix-item .detail-heading{margin:0 0 4px;font-size:14.5px;line-height:1.6;font-weight:500;letter-spacing:.06em}
.appendix-item .detail-copy,.appendix-more .detail-copy{font-size:13.5px;line-height:1.85}
.appendix-thumb img{padding:4px;background:var(--mount);outline:0;box-shadow:0 0 0 1px var(--hair)}
.appendix-thumb figcaption{padding-top:8px;font-size:11px;line-height:1.6;letter-spacing:.02em}

/* ---------- finale: a faded archival print ---------- */
.unit.finale-unit{margin:72px -32px 0;max-width:none}
.finale-banner{-webkit-mask-image:none;mask-image:none}
/* Horizontal fade on the frame, vertical fade on the picture and its veil: two nested single-axis
   masks, because Chromium's PDF output ignores mask-composite. */
.finale-frame{height:176px;aspect-ratio:auto;border:0;outline:0;background:transparent;-webkit-mask-image:linear-gradient(90deg,transparent 0,rgba(0,0,0,.45) 10%,#000 26%,#000 74%,rgba(0,0,0,.45) 90%,transparent 100%);mask-image:linear-gradient(90deg,transparent 0,rgba(0,0,0,.45) 10%,#000 26%,#000 74%,rgba(0,0,0,.45) 90%,transparent 100%)}
.finale-frame img,.finale-veil{-webkit-mask-image:linear-gradient(180deg,transparent 0,rgba(0,0,0,.55) 14%,#000 32%,#000 64%,rgba(0,0,0,.5) 84%,transparent 100%);mask-image:linear-gradient(180deg,transparent 0,rgba(0,0,0,.55) 14%,#000 32%,#000 64%,rgba(0,0,0,.5) 84%,transparent 100%)}
.finale-frame img{object-position:50% 45%;filter:grayscale(.7) sepia(.34) hue-rotate(62deg) saturate(.55) contrast(.86) brightness(1.08)}
.finale-veil{background:linear-gradient(180deg,rgba(236,235,229,.34),rgba(236,235,229,.12) 46%,rgba(236,235,229,.3)),radial-gradient(ellipse 60% 80% at 50% 44%,rgba(248,247,243,0) 40%,rgba(236,235,229,.42) 100%)}
.finale-caption{justify-content:center;gap:24px;padding:12px 32px 0;font-family:'Studio Sans',sans-serif;font-size:8px;line-height:1.6;letter-spacing:.28em;color:var(--muted)}
.finale-caption span:first-child{color:var(--foreground)}
.finale-copy{align-items:center;text-align:center;gap:0;padding:40px 48px 0}
.finale-kicker{font-family:'Studio Sans',sans-serif;font-size:8px;line-height:1.6;letter-spacing:.36em;padding-left:.36em;color:var(--accent)}
.finale-kicker:after{content:'';display:block;width:1px;height:24px;margin:16px auto 0;background:var(--hair)}
.finale-title,.finale-title.latin{margin-top:16px;font-family:'Studio Serif',Georgia,serif;font-style:normal;font-size:24px;line-height:1.3;font-weight:300;letter-spacing:.01em;color:var(--foreground)}
.finale-meta{margin-top:12px;font-family:'Studio Sans',sans-serif;font-size:9px;line-height:1.6;letter-spacing:.3em;padding-left:.3em;color:var(--muted);font-variant-numeric:tabular-nums}

/* ---------- signature & closing ---------- */
.unit.signature{margin-top:64px;padding:12px 0 8px;border-top:1px solid var(--foreground)}
.signature-caption{font-family:'Studio Sans',sans-serif;font-size:11px;line-height:1.6;letter-spacing:.24em}
.signature-mark{margin:16px 0 0 var(--grid);font-family:'Studio Sans',sans-serif;font-size:18px;line-height:1.6;font-weight:300;letter-spacing:.04em;color:var(--foreground)}
.archive-credit{grid-template-columns:var(--grid) minmax(0,1fr);gap:0;margin-top:24px;padding-top:12px;border-top:1px solid var(--line);align-items:baseline}
.archive-credit-label{font-size:8px;line-height:1.7;letter-spacing:.24em;color:var(--muted)}
.signature-name{font-family:'Studio Sans',sans-serif;font-size:15px;line-height:1.6;font-weight:400;letter-spacing:.1em}
.signature-studio{margin-top:2px;font-family:'Studio Sans',sans-serif;font-size:11px;letter-spacing:.2em;color:var(--muted)}
.unit.signature[data-after-finale]{margin-top:0;padding:40px 0 0;border-top:0;text-align:center}
.signature[data-after-finale] .signature-caption{margin-bottom:0;padding-left:.24em}
.signature[data-after-finale] .archive-credit{grid-template-columns:auto auto;justify-content:center;column-gap:24px;width:fit-content;max-width:100%;margin:16px auto 0;padding:12px 8px;border-top:1px solid var(--line);border-bottom:1px solid var(--line);text-align:left}
.unit.closing{margin-top:40px;padding-top:0;border-top:0;text-align:center;font-family:'Studio Sans',sans-serif;font-size:11px;line-height:1.8;letter-spacing:.2em;padding-left:.2em;color:var(--muted)}

/* ---------- share card: an exhibition label / index-card keepsake ---------- */
.sc-archive{background:var(--background)}
.sc-archive:before{content:'';position:absolute;inset:12px;pointer-events:none;background:linear-gradient(var(--hair),var(--hair)) left top/14px 1px no-repeat,linear-gradient(var(--hair),var(--hair)) left top/1px 14px no-repeat,linear-gradient(var(--hair),var(--hair)) right top/14px 1px no-repeat,linear-gradient(var(--hair),var(--hair)) right top/1px 14px no-repeat,linear-gradient(var(--hair),var(--hair)) left bottom/14px 1px no-repeat,linear-gradient(var(--hair),var(--hair)) left bottom/1px 14px no-repeat,linear-gradient(var(--hair),var(--hair)) right bottom/14px 1px no-repeat,linear-gradient(var(--hair),var(--hair)) right bottom/1px 14px no-repeat}
.sc-archive .sc-top{margin:0 28px;padding:30px 0 10px;border-top:0;border-bottom:1px solid var(--foreground);font-family:'Studio Sans',sans-serif;font-size:8.5px;letter-spacing:.26em;color:var(--foreground)}
.sc-archive .sc-brand{font-weight:500}
.sc-archive .sc-label{font-size:8px;letter-spacing:.26em;color:var(--muted)}
.sc-archive .sc-photo{margin:24px 28px 0;padding:9px 9px 0;background:var(--mount);border:1px solid var(--hair)}
.sc-archive .sc-shot{background:var(--panel)}
.sc-archive .sc-caption{flex-direction:column;align-items:flex-start;gap:0;padding:8px 120px 9px 0;font-family:'Studio Sans',sans-serif;font-size:8px;letter-spacing:.24em;color:var(--muted)}
.sc-archive .sc-caption span:first-child{color:var(--foreground)}
.sc-archive .sc-photo-empty{height:240px;font-family:'Studio Serif',Georgia,serif;font-style:normal;font-weight:300;font-size:34px;line-height:1.15;color:var(--foreground)}
.sc-stamp{right:12px;bottom:-16px;width:auto;height:auto;border-radius:0;border:1px solid var(--accent);box-shadow:inset 0 0 0 2px var(--background),inset 0 0 0 3px color-mix(in srgb,var(--accent) 55%,transparent);transform:none;gap:1px;padding:7px 12px 6px;background:var(--background);color:var(--accent)}
.sc-stamp i{font-family:'Studio Sans',sans-serif;font-size:7px;letter-spacing:.3em;padding-left:.3em}
.sc-stamp b{font-family:'Studio Sans',sans-serif;font-size:11px;font-weight:500;letter-spacing:.14em;padding-left:.14em}
.sc-archive .sc-body{padding:24px 28px 16px;justify-content:safe center}
.sc-archive .sc-kicker{margin:0 0 12px;font-family:'Studio Sans',sans-serif;font-size:8px;letter-spacing:.32em;color:var(--accent)}
.share-card.sc-archive .sc-names{font-family:'Studio Sans',sans-serif;font-size:30px;line-height:1.3;font-weight:300;letter-spacing:.16em}
.share-card.sc-archive .sc-headline{margin-top:12px;font-family:'Studio Sans',sans-serif;font-size:14px;line-height:1.7;letter-spacing:.06em;color:var(--foreground)}
.share-card.sc-archive .sc-message{margin-top:4px;font-size:12px;line-height:1.85;letter-spacing:.02em;color:var(--muted)}
.share-card.sc-archive .sc-date{display:flex;justify-content:space-between;align-items:baseline;margin-top:16px;padding-top:10px;border-top:1px solid var(--line);font-family:'Studio Sans',sans-serif;font-size:13px;letter-spacing:.14em;color:var(--foreground)}
.sc-archive .sc-date:before{font-size:8px;letter-spacing:.24em;color:var(--muted);margin:0;vertical-align:0}
.share-card.sc-archive:is([data-layout=single],[data-layout=empty]) .sc-kicker{font-size:8.5px;margin-bottom:16px}
.share-card.sc-archive:is([data-layout=single],[data-layout=empty]) .sc-names{font-size:36px}
.share-card.sc-archive:is([data-layout=single],[data-layout=empty]) .sc-headline{font-size:16px;margin-top:16px}
.share-card.sc-archive:is([data-layout=single],[data-layout=empty]) .sc-message{font-size:13px;margin-top:8px}
.share-card.sc-archive:is([data-layout=single],[data-layout=empty]) .sc-date{font-size:14px;margin-top:24px}
.sc-archive .sc-foot{margin:0 28px 30px;padding-top:12px;border-top:1px solid var(--foreground);gap:16px;font-size:10px;letter-spacing:.2em;color:var(--muted)}
.sc-archive .sc-teaser img{width:60px;height:60px;padding:4px;box-shadow:0 0 0 1px var(--line)}
.sc-archive .sc-teaser b{font-family:'Studio Sans',sans-serif;font-size:10px;font-weight:400;letter-spacing:.18em;color:var(--accent)}
.sc-archive .sc-teaser i{font-family:'Studio Sans',sans-serif;font-size:13px;letter-spacing:.06em;color:var(--foreground)}
`;
