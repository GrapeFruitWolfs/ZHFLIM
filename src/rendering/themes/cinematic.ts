/**
 * Cinematic theme layer — loaded after every other stylesheet, so it has the final word on this
 * template's look. Structure (class names, units, pagination hooks) is shared; only style lives here.
 *
 * Language: an arthouse film's title sequence and press kit. Warm ink-black stock, smoky warm-grey
 * type, one muted brass accent. Credits typography (light display weights, widely tracked small
 * caps), centred compositions, letterboxed pictures with thin black bars, quiet timecodes.
 * Spacing scale: 8 · 14 · 22 · 34 · 56.
 */
export const cinematicTheme = `
:root{--background:#13110f;--foreground:#e6dfd3;--muted:#9b9287;--line:#2f2a24;--panel:#1b1815;--accent:#b99a6b;--ticket-bg:#171411;--ticket-line:#3b342b;--ticket-radius:0px;--ink:#090807;--smoke:#cfc6b8}
body{color:var(--foreground)}

/* ── running heads: one centred credit line ─────────────────────────────── */
.masthead,.page-masthead{justify-content:center;align-items:center;gap:0;font-size:8.5px;letter-spacing:.36em;color:var(--muted)}
.masthead{border-bottom:0;padding-bottom:0;margin-bottom:34px}
.masthead .brand-name,.page-masthead .brand-name{max-width:60%;text-align:right}
.masthead .edition,.page-masthead .edition{font-family:'Studio Sans',sans-serif;font-style:normal;font-size:8.5px;letter-spacing:.36em;text-transform:uppercase;color:var(--muted);display:flex;align-items:center;white-space:nowrap}
.masthead .edition:before,.page-masthead .edition:before{content:'';display:block;width:22px;height:1px;background:var(--accent);opacity:.55;margin:0 14px 0 10px}
.page-masthead{height:36px;align-items:flex-start}
.image-segment-footer,.page-footer{border-top:0;font-size:8px;letter-spacing:.32em;color:#888074;font-variant-numeric:tabular-nums}
.image-segment-footer{margin-top:34px;padding-top:14px;background:linear-gradient(90deg,transparent,var(--line) 30%,var(--line) 70%,transparent) top/100% 1px no-repeat}

/* ── reading text ───────────────────────────────────────────────────────── */
.body-copy{font-size:15px;line-height:2;font-weight:300;letter-spacing:.03em;color:var(--smoke);text-align:justify}
.unit:has(> .body-copy:not(.delivery-copy)){padding:0 8px}

/* ── cover: an opening title card ───────────────────────────────────────── */
.cv-cinematic{padding-top:22px;padding-bottom:0;background:radial-gradient(ellipse 210px 120px at 50% 130px,rgba(185,154,107,.085) 0,rgba(185,154,107,.03) 55%,rgba(185,154,107,0) 100%)}
.cv-credit{font-size:8.5px;letter-spacing:.42em;color:var(--muted);margin:0 0 34px;line-height:1.9}
.cv-cinematic .cv-text{margin-top:0}
.cv-cinematic .cv-salutation{font-size:12px;letter-spacing:.24em;color:var(--muted);margin-bottom:14px}
.cv-cinematic .cv-names{font-size:34px;line-height:1.35;font-weight:250;letter-spacing:.34em;text-indent:.34em;color:var(--foreground)}
.cv-cinematic .cv-headline{font-size:14px;line-height:1.8;font-weight:300;letter-spacing:.22em;color:var(--accent);margin-top:14px}
.cv-billing{margin:22px auto 0;padding:0;border:0;font-size:8.5px;letter-spacing:.36em;color:var(--muted);gap:4px 14px;align-items:center}
.cv-billing:before,.cv-billing:after{content:'';width:26px;height:1px;background:var(--line);align-self:center}
.cv-billing b{font-family:'Studio Serif',Georgia,serif;font-weight:300;font-size:12px;letter-spacing:.22em;color:var(--foreground);margin-left:10px}
.cv-billing i{color:var(--accent);opacity:.7}
.cv-cinematic .cv-screen{margin:0 -32px;padding:20px 0;background:var(--ink);box-shadow:0 0 0 1px rgba(255,236,210,.02)}
.cv-cinematic.names-first .cv-screen{margin-top:34px}
.cv-cinematic.photo-first .cv-text{margin-top:34px}
.cv-cinematic .cv-screen .cv-photo{background:var(--ink)}
.cv-band{left:16px;right:16px;font-size:8px;line-height:1;letter-spacing:.3em;color:#7a7266}
.cv-band-top{top:6px}.cv-band-bottom{bottom:6px}
.cv-band span:last-child{color:color-mix(in srgb,var(--accent) 70%,#000)}
.cv-title-card{min-height:240px}
.cv-film-title{font-style:normal;font-weight:200;font-size:34px;line-height:1.3;letter-spacing:.12em;color:var(--foreground)}
.cv-cinematic .cv-project{font-size:11px;letter-spacing:.24em;margin-top:14px}
.unit.cv-message-unit.cv-cinematic-message{margin:34px 0 0;padding:0 22px}
.cv-cinematic-message:before{content:'';display:block;width:1px;height:26px;margin:0 auto 22px;background:linear-gradient(180deg,transparent,var(--accent))}
.cv-cinematic-message .cv-message{font-family:var(--display);font-size:14.5px;line-height:2.05;font-weight:300;letter-spacing:.12em;color:var(--smoke)}

/* ── teaser: a minimal cinema ticket ────────────────────────────────────── */
.unit.teaser-unit{margin:34px 0 0}
.teaser-card{position:relative;overflow:visible;border-radius:0;background:var(--ticket-bg);border:1px solid var(--ticket-line)}
.teaser-card .teaser-text{padding:18px 20px;gap:4px}
.teaser-card .teaser-stub{border-left:0;background:repeating-linear-gradient(180deg,var(--ticket-line) 0 3px,transparent 3px 7px) left/1px 100% no-repeat;padding:14px 18px}
.teaser-card .teaser-qr{width:74px;height:74px}
.teaser-kicker{font-size:8.5px;letter-spacing:.38em;color:var(--accent)}
.teaser-label{font-family:var(--display);font-size:16px;font-weight:400;letter-spacing:.12em;color:var(--foreground);margin-top:4px}
.teaser-host{font-size:11px;letter-spacing:.12em;color:var(--muted)}
.teaser-hint{font-size:11px;letter-spacing:.08em;color:var(--muted)}
.teaser-card.teaser-link{padding:16px 20px;gap:18px}
.teaser-play{width:40px;height:40px;background:transparent;border:1px solid var(--accent)}
.teaser-play:after{left:15px;top:12px;border-left:11px solid var(--accent);border-top:7px solid transparent;border-bottom:7px solid transparent}

/* ── chapter heads: scene cards ─────────────────────────────────────────── */
.chapter{text-align:center;border-top:0;margin-top:56px;padding-top:0}
.chapter:before{content:'';display:block;width:1px;height:22px;margin:0 auto 18px;background:linear-gradient(180deg,transparent,color-mix(in srgb,var(--accent) 70%,transparent))}
.chapter-index{display:inline-flex;align-items:center;font-size:8.5px;letter-spacing:.42em;color:var(--accent);line-height:1.6}
.chapter-index i{display:inline-flex;align-items:center;margin-left:0;font-size:8px;letter-spacing:.26em;color:#888074}
.chapter-index i:before{content:'';display:block;width:18px;height:1px;background:var(--line);margin:0 12px 0 2px}
.chapter-heading,.compact-chapter .chapter-heading{font-family:var(--display);font-size:21px;line-height:1.5;font-weight:300;letter-spacing:.16em;text-indent:.16em;margin:12px 0 8px;color:var(--foreground)}
.compact-chapter .chapter-heading{font-size:19px}
.chapter-caption{font-size:8px;letter-spacing:.38em;color:var(--muted)}
.unit.chapter + .unit{margin-top:22px}
.compact-chapter{margin-top:48px}
.appendix-caption{font-size:12px;letter-spacing:.1em;margin-top:14px}

.image-segment .masthead + .chapter{margin-top:0}
.pdf-page .chapter{margin-top:40px}
.pdf-page .chapter:before{height:16px;margin-bottom:14px}
.pdf-page .chapter:first-child:before{height:0;margin-bottom:0}
.image-segment .masthead + .chapter:before{height:16px}

/* ── delivery tickets: a stub with the number, a perforation, the details ─ */
.unit.ticket{padding:0 22px 0 92px;background:repeating-linear-gradient(180deg,var(--ticket-line) 0 3px,transparent 3px 7px) 70px 0/1px 100% no-repeat,var(--ticket-bg)}
.unit.ticket-start{margin-top:22px;padding-top:22px}
.unit.ticket-end{position:relative;margin-bottom:14px;padding-bottom:22px}
.unit.ticket-start:before,.unit.ticket-end:after{content:'';position:absolute;left:63px;right:auto;width:15px;height:8px;background:var(--background);border:1px solid var(--ticket-line);z-index:2}
.unit.ticket-start:before{top:-1px;bottom:auto;border-top:0;border-left:1px solid var(--ticket-line);border-radius:0 0 8px 8px}
.unit.ticket-end:after{bottom:-1px;top:auto;border-bottom:0;border-right:1px solid var(--ticket-line);border-radius:8px 8px 0 0}
.unit.ticket-start:not(.ticket-end):after{display:none}
.unit.ticket-start + .unit.ticket-start{margin-top:22px}
.ticket .delivery-heading,.ticket-start.ticket-end .delivery-heading{display:block;margin:0;padding:0 0 4px;border:0}
.ticket .item-number{position:absolute;left:0;top:24px;width:70px;text-align:center;font-family:'Studio Serif',Georgia,serif;font-size:22px;line-height:1;font-weight:250;letter-spacing:.06em;color:var(--accent);font-variant-numeric:lining-nums tabular-nums}
.ticket .item-title{font-family:var(--display);font-size:17px;line-height:1.5;font-weight:400;letter-spacing:.12em;color:var(--foreground)}
.ticket .item-format{display:flex;flex-wrap:wrap;gap:0;margin-top:8px;letter-spacing:0}
.ticket .chip{padding:0;border:0;border-radius:0;font-size:11px;line-height:1.6;letter-spacing:.18em;color:var(--muted)}
.ticket .chip + .chip:before{content:'';display:inline-block;width:3px;height:3px;border-radius:50%;background:var(--accent);opacity:.7;margin:0 10px;vertical-align:.24em}
.ticket .delivery-copy{padding-top:14px;font-size:14px;line-height:1.95;text-align:left;color:var(--smoke)}
.ticket .access-note{padding-top:14px;font-size:14px;line-height:1.85;color:var(--muted)}
.access-label{display:block;margin:0 0 2px;font-size:8.5px;letter-spacing:.36em;color:var(--accent)}
.ticket .delivery-access{padding-top:22px}
.ticket .qr-links{justify-content:flex-start}
.ticket .qr-link{align-items:flex-start;text-align:left}
.ticket .qr-image{width:150px;height:150px;outline:6px solid #fff}
.ticket .qr-label{font-family:var(--display);font-size:14px;letter-spacing:.12em;margin-top:14px}
.ticket .qr-host{font-size:11px;letter-spacing:.1em}
.ticket .qr-hint{text-align:left;font-size:11px;letter-spacing:.08em;margin-top:8px}
.ticket .delivery-link{font-size:13px;letter-spacing:.08em;border-bottom-color:color-mix(in srgb,var(--accent) 60%,transparent);margin-right:18px}

/* ── highlight stills: one dark strip, sprockets only at its two edges ──── */
.unit.stills-unit,.unit.stills-hero-unit{margin:0 -32px;padding:14px 40px;background:var(--ink)}
.unit.stills-hero-unit{margin-top:22px;padding-top:34px}
.unit.stills-unit.stills-last{margin-bottom:34px;padding-bottom:34px}
.stills-unit:before,.stills-unit:after{content:none;height:4px;left:16px;right:16px;background:repeating-linear-gradient(90deg,#2a251f 0 6px,transparent 6px 15px)}
.stills-hero-unit:before{content:'';top:12px;bottom:auto}
.stills-last:after{content:'';bottom:12px;top:auto}
.stills-unit .still-frame{background:#000;box-shadow:0 0 0 1px rgba(255,236,210,.04)}
.still-row{gap:10px}
.still-caption{justify-content:center;gap:12px;padding-top:10px;font-size:11.5px;letter-spacing:.12em}
.stills-unit .still-caption{color:#958c80}
.still-cell .still-caption{justify-content:flex-start}
.still-cell.wide .still-caption{justify-content:center}
.still-no{font-family:'Studio Sans',sans-serif;font-size:8.5px;letter-spacing:.3em;color:var(--accent)}

/* ── the day: a quiet rail of timecodes ─────────────────────────────────── */
.unit.tl{grid-template-columns:62px 30px minmax(0,1fr)}
.tl-time{font-family:'Studio Serif',Georgia,serif;font-size:14px;line-height:1.6;font-weight:300;letter-spacing:.14em;color:var(--accent);text-align:right;padding-top:2px}
.tl-rail:before{left:15px;background:var(--line)}
.tl-first .tl-rail:before{top:12px}
.tl-last .tl-rail:before{height:12px}
.tl-dot:after{left:13px;top:10px;width:5px;height:5px;border:0;background:var(--accent);box-shadow:0 0 0 4px var(--background),0 0 10px 3px rgba(185,154,107,.25)}
.tl-body{padding-bottom:22px}
.tl-title{font-family:var(--display);font-size:16px;line-height:1.6;font-weight:400;letter-spacing:.12em;color:var(--foreground)}
.tl-note{font-size:14px;line-height:1.9;font-weight:300;letter-spacing:.03em;margin-top:4px;color:var(--muted)}
.tl-figure{margin-top:4px;padding:7px 0;background:#000}
.tl-figure img{max-height:220px}
.unit.tl-last{margin-bottom:14px}

/* ── reveals: frames from the film ──────────────────────────────────────── */
.unit.reveal-unit{margin:22px -32px 0}
.unit.reveal-unit+.unit.reveal-unit,.unit.reveal-description+.unit.reveal-unit{margin-top:34px}
.reveal-frame{background:#000;box-shadow:0 -12px 0 #000,0 12px 0 #000}
.reveal-frame:after{content:'';position:absolute;inset:0;box-shadow:inset 0 0 60px rgba(0,0,0,.28);pointer-events:none}
.reveal-line{width:1px;margin-left:0;background:rgba(255,246,232,.78);box-shadow:none}
.reveal-knob{width:26px;height:26px;margin:-13px 0 0 -13px;background:rgba(14,12,10,.55);border:1px solid rgba(255,246,232,.75);box-shadow:none;gap:5px}
.reveal-knob i:first-child{border-right:4px solid rgba(255,246,232,.9);border-top-width:3.5px;border-bottom-width:3.5px}
.reveal-knob i:last-child{border-left:4px solid rgba(255,246,232,.9);border-top-width:3.5px;border-bottom-width:3.5px}
.reveal-tag{top:12px;padding:5px 8px 5px 10px;background:rgba(12,10,8,.62);font-size:8px;line-height:1;letter-spacing:.36em;color:rgba(255,246,232,.9)}
.reveal-tag-before{left:14px}
.reveal-tag-after{right:14px;background:rgba(12,10,8,.62);color:#e2c79d}
.reveal-caption{flex-direction:column;align-items:center;gap:4px;padding:24px 40px 0;text-align:center;font-size:11px;letter-spacing:.12em}
.reveal-title{flex-direction:row;justify-content:center;align-items:baseline;gap:14px;font-family:var(--display);font-size:15px;font-weight:400;letter-spacing:.16em;line-height:1.5}
.reveal-no{font-family:'Studio Sans',sans-serif;font-size:8.5px;letter-spacing:.38em;text-transform:uppercase;color:var(--accent)}
.reveal-hint{font-size:11px;letter-spacing:.14em;color:#8f877b}
.unit.reveal-description{margin:10px 0 0;padding:0 22px}
.comparison-description{font-size:14px;line-height:1.95;font-weight:300;letter-spacing:.04em;text-align:center;color:var(--muted)}
.comparison-frame{background:#000}
.comparison-tag{background:none;padding:0;font-size:8px;letter-spacing:.3em;text-shadow:0 1px 6px rgba(0,0,0,.6)}
.comparison-tag-after{background:none;color:#e2c79d}
.comparison-heading{font-family:var(--display);font-size:14px;font-weight:400;letter-spacing:.14em}
.comparison-number{font-family:'Studio Sans',sans-serif;font-style:normal;font-size:8.5px;letter-spacing:.34em;color:var(--accent)}

/* ── appendix: end credits ──────────────────────────────────────────────── */
.appendix-start + .unit.appendix-unit{margin-top:22px}
.appendix-item{gap:18px;padding:22px 0;border-top:1px solid var(--line)}
.appendix-item.with-thumb{grid-template-columns:minmax(0,1fr) 120px}
.appendix-item .detail-heading{font-family:var(--display);font-size:15px;font-weight:400;letter-spacing:.12em;margin:0 0 8px;color:var(--foreground)}
.appendix-item .detail-copy,.appendix-more .detail-copy,.detail-copy{font-size:14px;line-height:1.85;font-weight:300;letter-spacing:.03em;color:var(--muted)}
.appendix-thumb img{background:#000;outline:0;padding:6px 0}
.appendix-thumb figcaption{font-size:11px;line-height:1.65;letter-spacing:.04em;color:#8f877b;padding-top:8px}
.detail-heading{font-family:var(--display);font-weight:400;letter-spacing:.12em}
.production-figure{background:#000;border:0;padding:8px 0}
.production-figure figcaption{padding:10px 14px 0;font-size:12px;text-align:center}

/* ── finale: a dreamy anamorphic still, then the end credits ────────────── */
.unit.finale-unit{margin:56px -32px 0;padding:0;max-width:none;background:none}
.finale-unit:before,.finale-unit:after{content:none}
/* two nested single-layer masks (no mask-composite) so the feather survives PDF printing */
.finale-banner{-webkit-mask-image:linear-gradient(90deg,transparent 0,transparent 2%,rgba(0,0,0,.18) 8%,rgba(0,0,0,.5) 16%,rgba(0,0,0,.85) 28%,#000 38%,#000 62%,rgba(0,0,0,.85) 72%,rgba(0,0,0,.5) 84%,rgba(0,0,0,.18) 92%,transparent 98%,transparent 100%);mask-image:linear-gradient(90deg,transparent 0,transparent 2%,rgba(0,0,0,.18) 8%,rgba(0,0,0,.5) 16%,rgba(0,0,0,.85) 28%,#000 38%,#000 62%,rgba(0,0,0,.85) 72%,rgba(0,0,0,.5) 84%,rgba(0,0,0,.18) 92%,transparent 98%,transparent 100%)}
.finale-frame{aspect-ratio:auto;height:180px;background:transparent;-webkit-mask-size:100% 100%;mask-size:100% 100%;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-image:linear-gradient(180deg,transparent 0,transparent 3%,rgba(0,0,0,.15) 9%,rgba(0,0,0,.45) 18%,rgba(0,0,0,.82) 30%,#000 42%,#000 58%,rgba(0,0,0,.82) 70%,rgba(0,0,0,.45) 82%,rgba(0,0,0,.15) 91%,transparent 97%,transparent 100%);-webkit-mask-composite:source-over;mask-image:linear-gradient(180deg,transparent 0,transparent 3%,rgba(0,0,0,.15) 9%,rgba(0,0,0,.45) 18%,rgba(0,0,0,.82) 30%,#000 42%,#000 58%,rgba(0,0,0,.82) 70%,rgba(0,0,0,.45) 82%,rgba(0,0,0,.15) 91%,transparent 97%,transparent 100%);mask-composite:add}
.finale-frame img{object-position:50% 42%;filter:saturate(.5) sepia(.3) contrast(.82) brightness(.76) blur(.3px)}
.finale-veil{background:linear-gradient(180deg,rgba(19,17,15,.3),rgba(19,17,15,0) 40%,rgba(19,17,15,0) 60%,rgba(19,17,15,.4)),linear-gradient(rgba(120,78,36,.14),rgba(120,78,36,.14))}
.finale-veil:before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 38% 52% at 50% 42%,rgba(255,214,164,.30),rgba(255,206,150,.10) 55%,rgba(255,206,150,0) 100%);mix-blend-mode:screen}
.finale-veil:after{content:'';position:absolute;left:0;right:0;top:calc(44% - 9px);height:18px;background:radial-gradient(ellipse 46% 50% at 50% 50%,rgba(255,204,146,.20),rgba(255,204,146,0) 100%);mix-blend-mode:screen}
.finale-copy{align-items:center;text-align:center;gap:0;padding:30px 32px 0}
.finale-kicker{font-size:8.5px;letter-spacing:.5em;text-indent:.5em;color:var(--accent)}
.finale-title.latin{font-family:'Studio Serif',Georgia,serif;font-style:normal;font-size:38px;line-height:1.2;font-weight:200;letter-spacing:.1em;text-indent:.1em;color:#efe7da;margin:14px 0 0;text-shadow:0 0 22px rgba(232,190,130,.28)}
.finale-meta{display:flex;flex-direction:column;align-items:center;font-size:9px;letter-spacing:.38em;text-indent:.38em;color:var(--muted)}
.finale-meta:before{content:'';width:1px;height:22px;margin:16px 0 14px;background:linear-gradient(180deg,transparent,var(--line))}

/* ── signature: billing block ───────────────────────────────────────────── */
.signature{text-align:center;border-top:0}
.signature-caption{font-size:8.5px;letter-spacing:.42em;text-indent:.42em}
.signature-mark{font-family:'Studio Serif',Georgia,serif;font-weight:200;letter-spacing:.08em}
.signature-name{font-family:var(--display);font-size:18px;line-height:1.6;font-weight:300;letter-spacing:.34em;text-indent:.34em;color:var(--foreground)}
.signature-studio{font-size:11px;letter-spacing:.3em;text-indent:.3em;color:var(--muted);margin-top:6px}
.unit.signature[data-after-finale]{text-align:center;padding-top:34px;padding-bottom:0}
.signature[data-after-finale] .signature-caption{margin-bottom:12px}
.unit.closing{border-top:0;margin-top:34px;padding-top:0;font-size:11px;letter-spacing:.26em;line-height:1.9;color:#8f877b;text-align:center}
.unit.closing:before{content:'';display:block;width:3px;height:3px;border-radius:50%;background:var(--accent);opacity:.6;margin:0 auto 16px}

/* ── PDF pages: the same language, a slightly tighter rhythm ───────────── */
.pdf-page .unit.ticket-start{margin-top:18px;padding-top:18px}
.pdf-page .unit.ticket-end{padding-bottom:18px}
.pdf-page .ticket .item-number{top:20px}
.pdf-page .unit.chapter + .unit{margin-top:18px}
.pdf-page .unit.stills-unit{padding-top:10px;padding-bottom:10px}
.pdf-page .unit.stills-hero-unit{margin-top:18px;padding-top:28px}
.pdf-page .unit.stills-unit.stills-last{padding-bottom:28px;margin-bottom:22px}
.pdf-page .unit.reveal-unit{margin-top:18px}
.pdf-page .unit.reveal-unit+.unit.reveal-unit,.pdf-page .unit.reveal-description+.unit.reveal-unit{margin-top:22px}
.pdf-page .unit.reveal-unit:first-child{margin-top:12px}
.pdf-page .reveal-caption{padding-top:16px;gap:2px}
.pdf-page .unit.reveal-description{margin-top:6px}
.pdf-page .comparison-description{line-height:1.8}
.pdf-page .appendix-item{padding:16px 0}
.pdf-page .unit.finale-unit{margin-top:34px}
.pdf-page .finale-frame img{filter:saturate(.5) sepia(.3) contrast(.82) brightness(.76)}
.pdf-page .finale-copy{padding-top:22px}
.pdf-page .finale-meta:before{height:16px;margin:12px 0 10px}
.pdf-page .unit.signature[data-after-finale]{padding-top:26px}
.pdf-page .unit.closing{margin-top:22px}

/* ── share card: a one-sheet ────────────────────────────────────────────── */
.sc-cinematic{background:radial-gradient(ellipse 80% 30% at 50% 68%,rgba(185,154,107,.09),rgba(185,154,107,0) 100%),var(--background)}
.sc-cinematic .sc-top{padding:26px 28px 20px;gap:6px}
.sc-cinematic .sc-brand{font-size:9px;letter-spacing:.42em;font-weight:400;color:var(--foreground)}
.sc-cinematic .sc-label{font-size:8px;letter-spacing:.46em;color:var(--muted)}
.sc-cinematic .sc-photo{padding:18px 0;background:var(--ink)}
.sc-cinematic .sc-shot{background:#000}
.sc-cinematic .sc-band{display:none}
.sc-cinematic .sc-body{padding:18px 40px 10px}
.sc-cinematic .sc-kicker{font-size:8.5px;letter-spacing:.5em;margin-bottom:16px}
.sc-cinematic .sc-names,.sc-cinematic:is([data-layout=single],[data-layout=empty]) .sc-names{font-size:38px;line-height:1.3;font-weight:250;letter-spacing:.34em;text-indent:.34em}
.sc-cinematic:is([data-layout=single],[data-layout=empty]) .sc-names{font-size:44px}
.sc-cinematic .sc-headline,.sc-cinematic:is([data-layout=single],[data-layout=empty]) .sc-headline{font-size:14px;font-weight:300;letter-spacing:.22em;color:var(--accent);margin-top:12px}
.sc-cinematic .sc-message,.sc-cinematic:is([data-layout=single],[data-layout=empty]) .sc-message{font-size:12.5px;line-height:1.9;letter-spacing:.06em;font-weight:300;margin-top:12px}
.sc-cinematic .sc-date,.sc-cinematic:is([data-layout=single],[data-layout=empty]) .sc-date{display:flex;align-items:center;justify-content:center;gap:14px;font-size:12px;font-weight:300;letter-spacing:.32em;margin-top:16px}
.sc-cinematic .sc-date:before,.sc-cinematic .sc-date:after{content:'';width:22px;height:1px;background:var(--line)}
.sc-cinematic .sc-photo-empty{font-style:normal;font-weight:200;font-size:30px;letter-spacing:.12em;line-height:1.35;color:var(--foreground)}
.sc-cinematic .sc-foot{border-top:0;margin:0 40px 26px;padding-top:16px;background:linear-gradient(90deg,transparent,var(--line) 25%,var(--line) 75%,transparent) top/100% 1px no-repeat;font-size:9px;letter-spacing:.3em}
.sc-cinematic .sc-teaser{gap:16px}
.sc-cinematic .sc-teaser img{width:60px;height:60px;outline:4px solid #fff}
.sc-cinematic .sc-teaser span{text-align:left;gap:4px}
.sc-cinematic .sc-teaser b{font-size:12px;font-weight:400;letter-spacing:.24em}
.sc-cinematic .sc-teaser i{font-size:12px;letter-spacing:.1em;color:var(--muted)}
`;
