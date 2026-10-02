/**
 * Correspondence theme layer — loaded after every other stylesheet, so it has the final word on this
 * template's look. Structure (class names, units, pagination hooks) is shared; only style lives here.
 *
 * Direction: a handwritten love letter on fine stationery — letterpress wedding paper, cotton stock,
 * a wax seal, a Parisian papeterie. Warm cream cotton paper, deep rose-brown ink, one faded
 * terracotta-rose accent. Centred, letter-like compositions with generous margins; Chinese set in
 * Studio Serif SC with relaxed spacing, Latin in Studio Serif (synthesised italic only for a few
 * short salutations). Details are drawn in CSS: fine double rules, dot-and-hairline flourishes,
 * wax-seal discs, circular postmarks, paper photo borders made from spread shadows (they never
 * widen a unit). Spacing scale: 6 · 12 · 18 · 24 · 36 · 48 · 72.
 */
export const correspondenceTheme = `
:root{--background:#f6efe8;--foreground:#4a2e33;--muted:#7b625f;--line:#e4d5cb;--panel:#efe5dc;--accent:#a3655c;--ticket-bg:#fdf9f4;--ticket-line:#ecdfd5;--ticket-radius:2px;--paper:#fffcf8;--rose:#c4968b;--blush:#efd8cf;--ink:#56393d;--wax:#9a5853;--display:'Studio Serif','Studio Serif SC','Studio Sans',serif}

/* ---------- paper & running heads ---------- */
html,body,.render-root,.image-segment,.pdf-page{background:var(--background)}
body{font-family:var(--display);font-size:15px;line-height:2;color:var(--foreground)}
.masthead,.page-masthead{justify-content:center;align-items:center;gap:0;font-family:'Studio Serif','Studio Serif SC',serif;font-size:9px;font-weight:400;line-height:1.6;letter-spacing:.3em;text-transform:uppercase;color:var(--muted)}
.masthead{margin-bottom:36px;padding-bottom:12px;border-bottom:3px double var(--line)}
.image-segment .masthead.unit{margin-bottom:36px}
.masthead .brand-name,.page-masthead .brand-name{max-width:60%;text-align:right}
.masthead .edition,.page-masthead .edition{display:flex;align-items:center;white-space:nowrap;font-family:'Studio Serif',Georgia,serif;font-style:normal;font-size:9px;letter-spacing:.3em;text-transform:uppercase;color:var(--accent)}
.masthead .edition:before,.page-masthead .edition:before{content:'';flex:none;width:3px;height:3px;border-radius:50%;background:var(--rose);margin:0 14px 0 10px}
.page-masthead{height:24px;margin-bottom:12px;padding-bottom:8px;border-bottom:3px double var(--line);align-items:flex-start}
.page-footer,.image-segment-footer{font-family:'Studio Serif',Georgia,serif;font-size:8px;letter-spacing:.3em;text-transform:uppercase;color:var(--muted)}
.image-segment-footer{margin-top:24px;padding-top:10px;border-top:3px double var(--line)}
.page-footer{align-items:flex-end;border-top:3px double var(--line);height:20px;padding-top:4px}
.page-number,.image-segment-footer span:last-child{font-size:10px;letter-spacing:.16em;font-variant-numeric:oldstyle-nums proportional-nums;color:var(--accent)}

/* ---------- the letter's body ---------- */
.body-copy{font-family:var(--display);font-size:15px;line-height:2;font-weight:400;letter-spacing:.04em;color:var(--ink);text-align:justify}
.unit:has(> .body-copy:not(.delivery-copy)){padding:0 6px}
.body-copy,.comparison-description,.detail-copy,.tl-note,.access-note,.cv-message{text-wrap:pretty}
.chapter-heading,.cv-headline,.finale-title,.sc-headline,.sc-message,.reveal-title,.delivery-copy,.comparison-description{text-wrap:balance}

/* ---------- cover: the first page of a letter ---------- */
.cv-correspondence{padding-top:6px;padding-bottom:0;text-align:center;align-items:stretch}
.cv-correspondence .letter-opening{position:relative;border-top:0;padding-top:0;display:flex;flex-direction:column;align-items:center}
.cv-letter-head{position:relative;align-self:stretch;display:flex;justify-content:center;align-items:center;min-height:70px;margin:0}
.cv-correspondence .cv-kicker{display:flex;align-items:center;gap:12px;padding:0;font-family:'Studio Serif',Georgia,serif;font-size:9px;letter-spacing:.3em;color:var(--accent)}
.cv-correspondence .cv-kicker:before,.cv-correspondence .cv-kicker:after{content:'';width:3px;height:3px;border-radius:50%;background:var(--rose)}
.cv-postmark{position:absolute;right:0;top:-2px;width:72px;height:72px;border:1px solid var(--rose);box-shadow:inset 0 0 0 3px var(--background),inset 0 0 0 4px color-mix(in srgb,var(--rose) 70%,transparent);color:var(--accent);opacity:.8;transform:rotate(-10deg);gap:1px}
.cv-postmark:before{display:none}
.cv-postmark span{font-family:'Studio Serif',Georgia,serif;font-size:8px;letter-spacing:.14em;line-height:1.2}
.cv-postmark span:first-child{font-style:italic;font-synthesis:style;font-size:10px;letter-spacing:.02em;text-transform:none}
.cv-postmark b{font-family:'Studio Serif',Georgia,serif;font-size:14px;font-weight:400;line-height:1.25;letter-spacing:.04em;font-variant-numeric:lining-nums}

/* the photograph, tucked into the letter with paper corners */
.cv-letter-print{position:relative;width:304px;margin:24px auto 36px;padding:9px;background:var(--paper);box-shadow:0 1px 2px rgba(74,46,51,.07),0 18px 30px -18px rgba(74,46,51,.45);transform:rotate(-.8deg)}
.cv-letter-print .cv-photo{background:var(--panel)}
.cv-tape,.cv-letter-print:before,.cv-letter-print:after{content:'';position:absolute;width:24px;height:24px;background:none;box-shadow:none;transform:none;z-index:2;filter:drop-shadow(0 1px 1px rgba(74,46,51,.14))}
.cv-tape-left{top:-5px;left:-5px;background:linear-gradient(135deg,#ead7cc 50%,transparent 50%)}
.cv-tape-right{top:-5px;right:-5px;left:auto;background:linear-gradient(225deg,#ead7cc 50%,transparent 50%)}
.cv-letter-print:before{bottom:-5px;left:-5px;background:linear-gradient(45deg,#ead7cc 50%,transparent 50%)}
.cv-letter-print:after{bottom:-5px;right:-5px;background:linear-gradient(315deg,#ead7cc 50%,transparent 50%)}
/* wax seal: an uneven disc with a pressed inner ring */
.cv-seal{right:-20px;bottom:-22px;width:56px;height:56px;z-index:3;border-radius:52% 48% 50% 47%/48% 52% 47% 53%;background:radial-gradient(circle at 34% 28%,#c27c73 0,var(--wax) 42%,#7a3f3d 100%);box-shadow:0 3px 7px rgba(74,46,51,.32),inset 0 -2px 4px rgba(60,20,22,.35),inset 0 2px 3px rgba(255,220,210,.25);transform:rotate(-8deg)}
.cv-seal span{width:38px;height:38px;border:1px solid rgba(255,232,224,.32);box-shadow:inset 0 1px 2px rgba(60,20,22,.4),0 1px 0 rgba(255,225,215,.18);font-family:'Studio Serif SC',var(--display);font-size:17px;font-weight:500;color:rgba(255,238,230,.88);text-shadow:0 -1px 0 rgba(60,20,22,.45)}
.cv-correspondence.no-photo .cv-seal{position:relative;right:auto;bottom:auto;margin:36px auto 0}

.cv-correspondence .cv-salutation{margin:24px 0 0;font-family:var(--display);font-size:15px;letter-spacing:.12em;color:var(--muted)}
.cv-correspondence .cv-names{margin:0;font-family:'Studio Serif SC',var(--display);font-size:34px;line-height:1.4;font-weight:400;letter-spacing:.32em;padding-left:.32em;color:var(--foreground)}
.cv-correspondence.no-photo .cv-names{font-size:38px;margin-top:48px}
.cv-correspondence .cv-letter-fallback{font-family:'Studio Serif',Georgia,serif;font-style:normal;font-size:36px;font-weight:300;line-height:1.3;letter-spacing:.02em;padding-left:0}
.cv-correspondence .cv-headline{margin-top:12px;font-size:15px;line-height:1.8;letter-spacing:.16em;padding-left:.16em;color:var(--muted)}
.cv-dedication{margin:18px 0 0;font-family:'Studio Serif',Georgia,serif;font-style:italic;font-synthesis:style;font-size:15px;font-weight:300;line-height:1.75;letter-spacing:.02em;color:var(--accent)}
.cv-dedication:before{content:'';display:block;width:64px;height:7px;margin:0 auto 12px;background:linear-gradient(var(--rose),var(--rose)) left center/24px 1px no-repeat,linear-gradient(var(--rose),var(--rose)) right center/24px 1px no-repeat,radial-gradient(circle,var(--rose) 0 2px,transparent 2.6px) center/7px 7px no-repeat}
.cv-correspondence .cv-foot{margin-top:24px;padding-top:0;border-top:0;display:flex;flex-direction:column;align-items:center}
.cv-correspondence .cv-dates{justify-content:center;gap:36px}
.cv-correspondence .cv-date{align-items:center;gap:4px}
.cv-correspondence .cv-date-label{font-family:'Studio Serif',Georgia,serif;font-size:8.5px;letter-spacing:.3em;color:var(--muted)}
.cv-correspondence .cv-date-label i{margin-left:8px;letter-spacing:.2em}
.cv-correspondence .cv-date-value{font-size:15px;font-weight:400;letter-spacing:.22em;padding-left:.22em;color:var(--foreground);font-variant-numeric:oldstyle-nums proportional-nums}
.cv-correspondence .cv-project{margin-top:12px;font-size:11px;letter-spacing:.2em;color:var(--muted)}
.unit.cv-message-unit.cv-correspondence-message{margin:36px 0 0;padding:0 24px;text-align:center}
.cv-correspondence-message .cv-message{font-family:var(--display);font-size:15px;line-height:2.05;letter-spacing:.08em;color:var(--ink)}

/* teaser: a small letterpress card */
.unit.teaser-unit{margin:36px 6px 0}
.teaser-card{position:relative;gap:18px;padding:18px 20px;background:var(--paper);border:0;border-radius:var(--ticket-radius);outline:1px solid var(--line);outline-offset:-6px;box-shadow:0 1px 2px rgba(74,46,51,.06),0 14px 24px -18px rgba(74,46,51,.4)}
.teaser-card .teaser-stub{padding:0;background:transparent;border:0;box-shadow:none;transform:none}
.teaser-card .teaser-qr{width:76px;height:76px;padding:4px;background:#fff;box-shadow:0 0 0 1px var(--line)}
.teaser-kicker{font-family:'Studio Serif','Studio Serif SC',serif;font-style:normal;text-transform:uppercase;font-size:9px;letter-spacing:.3em;color:var(--accent)}
.teaser-label{margin-top:4px;font-family:var(--display);font-size:16px;line-height:1.5;font-weight:400;letter-spacing:.08em;color:var(--foreground)}
.teaser-host{font-family:'Studio Serif',Georgia,serif;font-size:11.5px;letter-spacing:.06em;color:var(--muted)}
.teaser-hint{font-size:11px;letter-spacing:.08em;color:var(--muted)}
.teaser-play{width:42px;height:42px;background:transparent;border:1px solid var(--rose)}
.teaser-play:after{left:16px;top:12px;border-left:12px solid var(--accent);border-top:8px solid transparent;border-bottom:8px solid transparent}

/* ---------- chapter heads: letter salutations ---------- */
.unit.chapter,.unit.chapter.compact-chapter{display:flex;flex-direction:column;align-items:center;text-align:center;margin:72px 0 24px;padding-top:0;border-top:0}
.unit.chapter.compact-chapter{margin-top:60px}
.unit.chapter:before{content:'';display:block;width:56px;height:7px;margin:0 0 18px;background:linear-gradient(var(--line),var(--line)) left center/22px 1px no-repeat,linear-gradient(var(--line),var(--line)) right center/22px 1px no-repeat,radial-gradient(circle,var(--rose) 0 1.8px,transparent 2.4px) center/7px 7px no-repeat}
.chapter-index,.compact-chapter .chapter-index{display:block;font-family:'Studio Serif',Georgia,serif;font-style:italic;font-synthesis:style;font-size:14px;font-weight:400;line-height:1.5;letter-spacing:.04em;color:var(--accent)}
.chapter-heading,.compact-chapter .chapter-heading{margin:8px 0 0;font-family:var(--display);font-size:21px;line-height:1.6;font-weight:400;letter-spacing:.12em;padding-left:.12em;color:var(--foreground)}
.compact-chapter .chapter-heading{font-size:19px}
.chapter-caption{margin-top:8px;font-family:'Studio Serif',Georgia,serif;font-size:8.5px;line-height:1.6;letter-spacing:.32em;padding-left:.32em;color:var(--muted)}
.appendix-caption{margin:12px 0 0;font-size:13px;line-height:1.8;letter-spacing:.06em;color:var(--muted)}
.image-segment .masthead + .unit.chapter{margin-top:12px}
.pdf-page .unit.chapter:not(:first-child){margin-top:48px}

/* ---------- tickets: enclosures in soft paper envelopes ---------- */
.unit.ticket{display:flow-root;padding:0 28px;background:var(--ticket-bg);border-left:1px solid var(--ticket-line);border-right:1px solid var(--ticket-line);text-align:center}
.unit.ticket-start{position:relative;margin-top:24px;padding-top:40px;border-top:1px solid var(--ticket-line);border-radius:var(--ticket-radius) var(--ticket-radius) 0 0}
.unit.ticket-end{margin-bottom:24px;padding-bottom:20px;border-bottom:1px solid var(--ticket-line);border-radius:0 0 var(--ticket-radius) var(--ticket-radius);box-shadow:0 18px 22px -20px rgba(74,46,51,.42)}
.unit.ticket-start.ticket-end{border-radius:var(--ticket-radius)}
.unit.chapter+.unit.ticket-start{margin-top:6px}
/* the envelope flap: two hairlines meeting at a tiny seal */
.unit.ticket-start:before,.unit.ticket-start:after{content:'';position:absolute;z-index:1;border:0;border-radius:0}
.unit.ticket-start:before{left:0;right:0;top:0;bottom:auto;width:auto;height:26px;background:linear-gradient(to top right,transparent calc(50% - .6px),var(--ticket-line) 50%,transparent calc(50% + .6px)) left top/50% 100% no-repeat,linear-gradient(to bottom right,transparent calc(50% - .6px),var(--ticket-line) 50%,transparent calc(50% + .6px)) right top/50% 100% no-repeat}
.unit.ticket-start:after{left:50%;right:auto;top:21px;bottom:auto;width:11px;height:11px;margin-left:-5.5px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#c27c73,var(--wax) 60%,#7a3f3d);box-shadow:0 1px 2px rgba(74,46,51,.3)}
.ticket .delivery-heading,.ticket-start.ticket-end .delivery-heading{display:block;margin:0;padding:0;border:0}
.ticket .delivery-heading:after{content:'';display:block;width:24px;height:1px;margin:12px auto 0;background:var(--rose)}
.ticket .item-number{display:block;margin:0 0 6px;padding:0;min-width:0;font-family:'Studio Serif',Georgia,serif;font-style:normal;font-size:9px;font-weight:400;line-height:1.6;letter-spacing:.32em;padding-left:.32em;text-transform:uppercase;color:var(--accent);font-variant-numeric:lining-nums}
.ticket .item-title{font-family:var(--display);font-size:18px;line-height:1.6;font-weight:400;letter-spacing:.12em;padding-left:.12em;color:var(--foreground)}
.ticket .item-format{display:flex;flex-wrap:wrap;justify-content:center;gap:0;margin-top:4px;letter-spacing:0}
.ticket .chip{padding:0;border:0;border-radius:0;font-family:'Studio Serif','Studio Serif SC',serif;font-size:11px;line-height:1.8;letter-spacing:.16em;color:var(--muted);font-variant-numeric:lining-nums}
.ticket .chip+.chip:before{content:'';display:inline-block;width:3px;height:3px;border-radius:50%;background:var(--rose);margin:0 10px 0 6px;vertical-align:.3em}
.ticket .delivery-copy{padding-top:12px;font-size:14.5px;line-height:1.95;letter-spacing:.04em;text-align:center;color:var(--ink)}
.ticket .access-note{margin:0;padding-top:8px;font-size:13px;line-height:1.85;letter-spacing:.04em;color:var(--muted)}
.access-label{margin-right:10px;font-family:'Studio Serif','Studio Serif SC',serif;font-size:9px;letter-spacing:.28em;color:var(--accent);vertical-align:1px}
.ticket .delivery-access{padding:18px 0 0}
.ticket .qr-image{width:132px;height:132px;padding:8px;background:#fff;box-shadow:0 0 0 1px var(--ticket-line)}
.ticket .qr-label{margin-top:12px;font-family:var(--display);font-size:14px;letter-spacing:.08em}
.ticket .qr-host{font-family:'Studio Serif',Georgia,serif;font-size:11.5px;letter-spacing:.04em}
.ticket .qr-hint{margin:8px 0 0;font-size:11px;letter-spacing:.06em}
.delivery-link{font-size:14px;letter-spacing:.04em;border-bottom:1px solid var(--rose)}
.link-arrow{color:var(--accent)}

/* ---------- highlight stills: photographs tucked between the lines ---------- */
.unit.stills-hero-unit{margin:6px 0 24px}
.still-hero.framed .still-frame{max-width:340px;background:var(--panel);border:0;box-shadow:0 0 0 7px var(--paper),0 1px 2px 7px rgba(74,46,51,.05),0 20px 28px -14px rgba(74,46,51,.42);transform:rotate(-.6deg)}
.still-cell,.still-cell.wide{background:transparent;padding:0;box-shadow:none}
.still-cell:nth-child(odd),.still-cell:nth-child(even){transform:none}
.still-row{gap:26px;padding:6px 10px 0}
.still-row .still-frame{background:var(--panel);box-shadow:0 0 0 5px var(--paper),0 1px 2px 5px rgba(74,46,51,.05),0 14px 20px -12px rgba(74,46,51,.4)}
.still-row .still-cell:nth-child(odd) .still-frame{transform:rotate(-.9deg)}
.still-row .still-cell:nth-child(even) .still-frame{transform:rotate(.7deg)}
.still-cell.wide .still-frame{max-width:300px;border:0;box-shadow:0 0 0 7px var(--paper),0 1px 2px 7px rgba(74,46,51,.05),0 18px 26px -14px rgba(74,46,51,.42);transform:rotate(.5deg)}
.unit.stills-row-unit{margin:0 0 24px}
.unit.stills-last{margin-bottom:30px}
.still-caption,.still-hero.framed .still-caption,.still-cell.wide .still-caption,.still-cell .still-caption{justify-content:center;gap:10px;padding-top:16px;font-family:var(--display);font-size:12px;line-height:20px;letter-spacing:.08em;color:var(--muted)}
.still-no{font-family:'Studio Serif',Georgia,serif;font-style:normal;font-size:11px;letter-spacing:.08em;color:var(--accent);font-variant-numeric:oldstyle-nums}

/* ---------- timeline: a dotted guide line, hours in old-style figures ---------- */
.unit.tl{grid-template-columns:58px 26px minmax(0,1fr)}
.tl-time{padding-top:0;font-family:'Studio Serif',Georgia,serif;font-style:normal;font-size:15px;line-height:26px;font-weight:400;letter-spacing:.06em;text-align:right;color:var(--accent);font-variant-numeric:oldstyle-nums tabular-nums}
.tl-rail:before{left:13px;width:1px;background:repeating-linear-gradient(180deg,var(--rose) 0 1px,transparent 1px 5px)}
.tl-first .tl-rail:before{top:13px}
.tl-last .tl-rail:before{bottom:auto;height:13px}
.tl-dot:after{left:10px;top:10px;width:7px;height:7px;border:1px solid var(--accent);background:var(--background)}
.tl-body{padding:0 0 24px 4px}
.tl-title{font-family:var(--display);font-size:16px;line-height:26px;font-weight:400;letter-spacing:.1em;color:var(--foreground)}
.tl-note{margin-top:4px;font-family:var(--display);font-size:14px;line-height:1.9;letter-spacing:.04em;color:var(--muted)}
.tl-figure{margin:10px 6px 4px;background:transparent;box-shadow:0 0 0 5px var(--paper),0 14px 20px -12px rgba(74,46,51,.38)}
.unit.tl-last{margin-bottom:30px}
.unit.tl-last .tl-body{padding-bottom:0}

/* ---------- reveals: a print laid on the letter ---------- */
.unit.reveal-unit{margin:12px -32px 24px}
.reveal-frame{zoom:.8;background:var(--panel);box-shadow:0 0 0 9px var(--paper),0 1px 2px 9px rgba(74,46,51,.05),0 24px 30px -18px rgba(74,46,51,.45)}
.reveal-line{width:1px;margin-left:0;background:rgba(255,250,244,.88);box-shadow:none}
.reveal-knob{width:30px;height:30px;margin:-15px 0 0 -15px;gap:5px;background:rgba(255,251,246,.94);box-shadow:0 2px 8px rgba(74,46,51,.25)}
.reveal-knob i{border-top-width:4px;border-bottom-width:4px}
.reveal-knob i:first-child{border-right:5px solid var(--accent)}.reveal-knob i:last-child{border-left:5px solid var(--accent)}
.reveal-tag{top:auto;bottom:14px;padding:4px 10px 3px 12px;font-family:'Studio Serif',Georgia,serif;font-size:10.5px;line-height:1.4;letter-spacing:.3em;color:var(--muted);background:rgba(255,251,246,.9)}
.reveal-tag-before{left:14px}.reveal-tag-after{right:14px;color:var(--accent);background:rgba(255,251,246,.9)}
.reveal-caption{flex-direction:column;align-items:center;gap:2px;padding:24px 40px 0;text-align:center;font-size:11px;letter-spacing:.08em;color:var(--muted)}
.reveal-title{justify-content:center;gap:12px;font-family:var(--display);font-size:15px;line-height:1.6;font-weight:400;letter-spacing:.1em;color:var(--foreground)}
.reveal-no{font-family:'Studio Serif',Georgia,serif;font-size:11px;letter-spacing:.12em;color:var(--accent);font-variant-numeric:oldstyle-nums}
.reveal-hint{font-size:11px;letter-spacing:.1em}
.unit.reveal-description{margin:-10px 0 6px;padding:0 24px}
.comparison-description{font-family:var(--display);font-size:14px;line-height:1.95;letter-spacing:.04em;text-align:center;color:var(--muted)}
.unit.reveal-unit+.unit.reveal-unit,.unit.reveal-description+.unit.reveal-unit{margin-top:48px}
.comparison-heading{font-family:var(--display);font-size:15px;font-weight:400;letter-spacing:.08em}
.comparison-number{font-family:'Studio Serif',Georgia,serif;font-style:normal;font-size:12px;letter-spacing:.1em;color:var(--accent)}
.comparison-frame{padding:0;background:var(--panel);border:0;box-shadow:0 0 0 5px var(--paper),0 12px 18px -12px rgba(74,46,51,.4)}
.comparison-tag,.comparison-pair.split .comparison-tag{left:8px;top:auto;bottom:8px;padding:3px 7px 2px 8px;font-family:'Studio Serif',Georgia,serif;font-size:8px;letter-spacing:.26em;color:var(--muted);background:rgba(255,251,246,.9)}
.comparison-tag-after{color:var(--accent)}

/* ---------- production notes & appendix ---------- */
.detail-heading{font-family:var(--display);font-size:16px;font-weight:400;letter-spacing:.08em}
.detail-copy{font-family:var(--display);font-size:14px;line-height:1.95;letter-spacing:.04em;color:var(--muted)}
.production-figure{padding:0;border:0;background:transparent;margin:6px 6px 0}
.production-figure img{box-shadow:0 0 0 5px var(--paper),0 12px 18px -12px rgba(74,46,51,.38)}
.production-figure figcaption{padding-top:14px;font-size:11.5px;line-height:1.8;letter-spacing:.04em;text-align:center}
.unit.chapter.appendix-start{margin-bottom:18px}
.appendix-item{gap:22px;padding:22px 6px 18px;border-top:1px solid var(--line)}
.appendix-item.with-thumb{grid-template-columns:minmax(0,1fr) 112px}
.appendix-item .detail-heading{margin:0 0 6px;font-size:15px;line-height:1.6;letter-spacing:.1em}
.appendix-item .detail-copy,.appendix-more .detail-copy{font-size:13.5px;line-height:1.9}
.appendix-thumb{padding-top:4px}
.image-segment .masthead + .unit.appendix-unit .appendix-item,.page-body > .unit.appendix-unit:first-child .appendix-item{border-top:0;padding-top:6px}
.appendix-thumb img{background:var(--panel);outline:0;box-shadow:0 0 0 4px var(--paper),0 10px 16px -10px rgba(74,46,51,.4)}
.appendix-thumb figcaption{padding-top:12px;font-size:11px;line-height:1.6;letter-spacing:.02em}

/* ---------- finale: a sun-faded keepsake, then the end of the letter ---------- */
.unit.finale-unit{margin:72px -32px 0;max-width:none}
.finale-banner{-webkit-mask-image:linear-gradient(90deg,transparent 0,rgba(0,0,0,.45) 11%,#000 30%,#000 70%,rgba(0,0,0,.45) 89%,transparent 100%);mask-image:linear-gradient(90deg,transparent 0,rgba(0,0,0,.45) 11%,#000 30%,#000 70%,rgba(0,0,0,.45) 89%,transparent 100%)}
.finale-frame{height:176px;aspect-ratio:auto;border:0;box-shadow:none;background:transparent;-webkit-mask-image:linear-gradient(180deg,transparent 0,rgba(0,0,0,.55) 14%,#000 32%,#000 50%,rgba(0,0,0,.62) 66%,rgba(0,0,0,.22) 84%,transparent 98%);mask-image:linear-gradient(180deg,transparent 0,rgba(0,0,0,.55) 14%,#000 32%,#000 50%,rgba(0,0,0,.62) 66%,rgba(0,0,0,.22) 84%,transparent 98%)}
.finale-frame img{height:calc(100% - 3px);object-position:50% 42%;filter:sepia(.34) saturate(.62) contrast(.84) brightness(1.1)}
.finale-veil{bottom:3px;background:radial-gradient(ellipse 38% 85% at 84% 8%,rgba(246,196,182,.7),rgba(246,196,182,0) 100%),radial-gradient(ellipse 34% 70% at 10% 90%,rgba(255,236,214,.55),rgba(255,236,214,0) 100%),linear-gradient(100deg,rgba(255,240,226,.24),rgba(240,200,190,.18));mix-blend-mode:normal}
.finale-copy{position:relative;align-items:center;text-align:center;gap:0;margin-top:6px;padding:0 48px}
.finale-kicker{display:flex;align-items:center;gap:12px;font-family:'Studio Serif',Georgia,serif;font-size:10px;line-height:1.6;letter-spacing:.3em;padding-left:.3em;color:var(--accent)}
.finale-kicker:before,.finale-kicker:after{content:'';width:18px;height:1px;background:var(--rose)}
.finale-title,.finale-title.latin{margin-top:12px;font-family:'Studio Serif',Georgia,serif;font-style:italic;font-synthesis:style;font-size:27px;line-height:1.3;font-weight:300;letter-spacing:.01em;color:var(--foreground)}
.finale-meta{position:relative;display:inline-block;margin-top:30px;padding:7px 18px 6px;border:1px solid var(--rose);border-radius:999px;box-shadow:inset 0 0 0 2px var(--background),inset 0 0 0 3px color-mix(in srgb,var(--rose) 60%,transparent);font-family:'Studio Serif','Studio Serif SC',serif;font-size:10px;line-height:1.5;letter-spacing:.24em;color:var(--accent);font-variant-numeric:lining-nums;transform:rotate(-3deg);opacity:.92}
.finale-meta:after{content:'';position:absolute;left:100%;top:50%;width:30px;height:13px;margin:-6px 0 0 6px;background:repeating-linear-gradient(180deg,var(--rose) 0 1px,transparent 1px 4px);opacity:.55}

/* ---------- signature & closing ---------- */
.unit.signature{margin-top:72px;padding:36px 0 6px;border-top:0;text-align:center}
.unit.signature:before{content:'';display:block;width:56px;height:7px;margin:0 auto 24px;background:linear-gradient(var(--line),var(--line)) left center/22px 1px no-repeat,linear-gradient(var(--line),var(--line)) right center/22px 1px no-repeat,radial-gradient(circle,var(--rose) 0 1.8px,transparent 2.4px) center/7px 7px no-repeat}
.signature-caption{font-family:var(--display);font-size:12px;letter-spacing:.24em;padding-left:.24em;text-transform:none}
.signature-mark{margin:12px 0 12px;font-family:'Studio Serif',Georgia,serif;font-style:italic;font-synthesis:style;font-size:20px;line-height:1.4;font-weight:300;letter-spacing:.01em;color:var(--muted)}
.signature-name{font-family:'Studio Serif SC',var(--display);font-style:normal;font-size:20px;line-height:1.6;font-weight:400;letter-spacing:.24em;padding-left:.24em;color:var(--foreground)}
.signature-studio{margin-top:4px;font-family:'Studio Serif','Studio Serif SC',serif;font-size:10px;letter-spacing:.28em;padding-left:.28em;text-transform:uppercase;color:var(--muted)}
.letter-signoff{width:24px;height:1px;margin:24px auto 0;background:var(--rose)}
.unit.signature[data-after-finale]{margin-top:0;padding:30px 0 0;border-top:0}
.unit.signature[data-after-finale]:before{display:none}
.signature[data-after-finale] .signature-caption{margin-bottom:10px}
.signature[data-after-finale] .letter-signoff{display:none}
.unit.closing{margin-top:36px;padding:0;border-top:0;text-align:center;font-family:var(--display);font-size:12px;line-height:1.8;letter-spacing:.16em;padding-left:.16em;color:var(--muted)}
.unit.closing:after{content:'';display:block;width:26px;height:26px;margin:24px auto 6px;border-radius:52% 48% 50% 47%/48% 52% 47% 53%;background:radial-gradient(circle at 34% 28%,#c27c73 0,var(--wax) 45%,#7a3f3d 100%);box-shadow:0 2px 5px rgba(74,46,51,.3),inset 0 0 0 5px rgba(60,20,22,.12),inset 0 0 0 6px rgba(255,225,215,.18)}

/* ---------- share card: a postcard keepsake ---------- */
.sc-correspondence{background:var(--background);text-align:center}
.sc-correspondence:before{content:'';position:absolute;inset:14px;border:3px double var(--line);pointer-events:none}
.sc-correspondence .sc-top{flex-direction:column;justify-content:center;gap:2px;margin:0 36px;padding:36px 0 0;font-family:'Studio Serif','Studio Serif SC',serif;font-size:9px;letter-spacing:.32em;color:var(--muted)}
.sc-correspondence .sc-brand{font-weight:400;color:var(--foreground)}
.sc-correspondence .sc-label{display:none}
.sc-correspondence .sc-photo{align-self:center;margin-top:30px}
.sc-correspondence .sc-shot{padding:8px;background:var(--paper);box-shadow:0 1px 2px rgba(74,46,51,.07),0 16px 26px -16px rgba(74,46,51,.45)}
.sc-correspondence .sc-shot img{background:var(--panel)}
.sc-correspondence .sc-main{transform:rotate(-.8deg)}
.sc-correspondence .sc-small{padding:6px}
.sc-correspondence .sc-small-1{transform:rotate(-1.4deg)}
.sc-correspondence .sc-small-2{transform:rotate(1.2deg) translateY(4px)}
.sc-seal{right:-14px;top:-16px;bottom:auto;width:50px;height:50px;border-radius:52% 48% 50% 47%/48% 52% 47% 53%;background:radial-gradient(circle at 34% 28%,#c27c73 0,var(--wax) 42%,#7a3f3d 100%);box-shadow:0 3px 7px rgba(74,46,51,.32),inset 0 -2px 4px rgba(60,20,22,.35),inset 0 0 0 7px rgba(60,20,22,.1),inset 0 0 0 8px rgba(255,225,215,.2);font-family:'Studio Serif SC',var(--display);font-size:16px;font-weight:500;color:rgba(255,238,230,.88);text-shadow:0 -1px 0 rgba(60,20,22,.45);transform:rotate(-8deg)}
.sc-correspondence .sc-photo-empty{height:220px;margin:30px 40px 0;align-self:stretch;background:transparent;border-top:1px solid var(--line);border-bottom:1px solid var(--line);font-family:'Studio Serif',Georgia,serif;font-style:italic;font-synthesis:style;font-size:30px;font-weight:300;line-height:1.3;color:var(--foreground)}
.sc-correspondence .sc-photo-empty .sc-seal{right:50%;margin-right:-25px;bottom:-25px}
.sc-correspondence .sc-body{align-items:center;text-align:center;padding:12px 44px}
.sc-correspondence .sc-kicker{display:flex;align-items:center;gap:10px;margin:0 0 14px;font-family:'Studio Serif',Georgia,serif;font-size:9px;letter-spacing:.32em;color:var(--accent)}
.sc-correspondence .sc-kicker:before,.sc-correspondence .sc-kicker:after{content:'';width:3px;height:3px;border-radius:50%;background:var(--rose)}
.share-card.sc-correspondence .sc-names{font-family:'Studio Serif SC',var(--display);font-size:32px;line-height:1.4;font-weight:400;letter-spacing:.32em;padding-left:.32em}
.share-card.sc-correspondence .sc-headline{margin-top:10px;font-size:14px;line-height:1.8;letter-spacing:.14em;color:var(--ink)}
.share-card.sc-correspondence .sc-message{margin-top:8px;font-family:var(--display);font-size:12px;line-height:1.9;letter-spacing:.06em;color:var(--muted)}
.share-card.sc-correspondence .sc-date{display:flex;flex-direction:column;align-items:center;justify-content:center;width:76px;height:76px;margin:16px 0 0;border:1px solid var(--rose);border-radius:50%;box-shadow:inset 0 0 0 3px var(--background),inset 0 0 0 4px color-mix(in srgb,var(--rose) 70%,transparent);font-family:'Studio Serif',Georgia,serif;font-size:10px;line-height:1.3;letter-spacing:.04em;color:var(--accent);font-variant-numeric:lining-nums;transform:rotate(-8deg)}
.share-card.sc-correspondence .sc-date:before{content:'With love';font-size:8px;letter-spacing:.16em;text-transform:uppercase;margin-bottom:2px}
.share-card.sc-correspondence:is([data-layout=single],[data-layout=empty]) .sc-kicker{margin-bottom:18px}
.share-card.sc-correspondence:is([data-layout=single],[data-layout=empty]) .sc-names{font-size:38px}
.share-card.sc-correspondence:is([data-layout=single],[data-layout=empty]) .sc-headline{font-size:16px;margin-top:14px}
.share-card.sc-correspondence:is([data-layout=single],[data-layout=empty]) .sc-message{font-size:13px;margin-top:10px}
.share-card.sc-correspondence:is([data-layout=single],[data-layout=empty]) .sc-date{width:84px;height:84px;font-size:11px;margin-top:22px}
.sc-correspondence .sc-foot{justify-content:center;margin:0 40px 36px;padding-top:12px;border-top:0;font-family:var(--display);font-size:11px;letter-spacing:.14em;color:var(--muted);min-height:0}
.sc-correspondence .sc-foot:before{content:none}
.sc-correspondence .sc-teaser{gap:14px;text-align:left}
.sc-correspondence .sc-teaser img{width:58px;height:58px;padding:4px;box-shadow:0 0 0 1px var(--line)}
.sc-correspondence .sc-teaser b{font-family:'Studio Serif','Studio Serif SC',serif;font-size:9px;font-weight:400;letter-spacing:.3em;color:var(--accent)}
.sc-correspondence .sc-teaser i{font-size:13px;letter-spacing:.08em;color:var(--foreground)}
`;
