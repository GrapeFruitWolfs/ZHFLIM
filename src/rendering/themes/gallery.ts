/**
 * Gallery theme layer — loaded after every other stylesheet, so it has the final word on this
 * template's look. Structure (class names, units, pagination hooks) is shared; only style lives here.
 *
 * Language: a contemporary art museum's private exhibition after hours. A deep ink-slate night
 * wall (cool, never black), warm gallery-white type, one pale gilt accent. Works are hung centred
 * with generous negative space under soft tungsten spotlight pools (radial gradients that fade to
 * zero inside their own unit); every picture sits in the same thin frame — a pale bevel, a dark
 * passe-partout, a single gilt-edged hairline and a soft drop shadow — drawn with box-shadows so
 * the picture box itself is never resized or cropped. Typography follows museum wall labels:
 * small tracked Studio Sans caps for labels, Studio Serif SC / Source Serif at regular and light
 * weights for titles, a vertical "hanging wire" hairline as the recurring motif.
 * Spacing scale: 8 · 16 · 24 · 40 · 64.
 */
const FRAME = '0 0 0 1px rgba(236,226,206,.16),0 0 0 13px var(--mat),0 0 0 14px var(--gilt-edge),0 0 0 15px #0b0e12,0 28px 34px -16px rgba(0,0,0,.8),0 -26px 72px 14px rgba(238,224,196,.075)';
const FRAME_SM = '0 0 0 1px rgba(236,226,206,.16),0 0 0 9px var(--mat),0 0 0 10px var(--gilt-edge),0 0 0 11px #0b0e12,0 20px 26px -14px rgba(0,0,0,.8),0 -18px 48px 8px rgba(238,224,196,.06)';
const POOL = 'radial-gradient(closest-side,rgba(238,224,196,.14),rgba(238,224,196,.118) 18%,rgba(238,224,196,.085) 36%,rgba(238,224,196,.052) 54%,rgba(238,224,196,.026) 70%,rgba(238,224,196,.01) 84%,rgba(238,224,196,.002) 94%,rgba(238,224,196,0) 100%)';

export const galleryTheme = `
:root{--background:#12171d;--foreground:#ebe7df;--muted:#99a2aa;--line:#28313a;--panel:#171d24;--accent:#cdb88e;--ticket-bg:#151b22;--ticket-line:#2b343d;--ticket-radius:0px;--text:#d3d3ce;--mat:#1b222a;--gilt-edge:rgba(205,184,142,.36);--display:'Studio Serif','Studio Serif SC','Studio Sans',serif}
html,body,.render-root,.image-segment,.pdf-page{background:var(--background)}
body{color:var(--foreground);font-variant-numeric:lining-nums}

/* ---------- running heads ---------- */
.masthead,.page-masthead{align-items:baseline;font-family:'Studio Sans',sans-serif;font-size:8px;font-weight:400;line-height:1.6;letter-spacing:.32em;text-transform:uppercase;color:var(--muted)}
.masthead{border-bottom:0;padding-bottom:0;margin-bottom:40px}
.image-segment .masthead.unit{margin-bottom:40px}
.brand-name{color:var(--foreground);font-weight:400}
.masthead .edition,.page-masthead .edition{font-family:'Studio Sans',sans-serif;font-style:normal;font-size:8px;letter-spacing:.32em;text-transform:uppercase;color:var(--accent)}
.page-masthead{height:36px}
.image-segment-footer,.page-footer{border-top:0;font-family:'Studio Sans',sans-serif;font-size:8px;letter-spacing:.32em;text-transform:uppercase;color:#7f8891;font-variant-numeric:tabular-nums;background:linear-gradient(90deg,transparent,var(--line) 18%,var(--line) 82%,transparent) top/100% 1px no-repeat}
.image-segment-footer{margin-top:28px;padding-top:12px}
.page-footer{padding-top:6px;box-sizing:border-box}
.page-number,.image-segment-footer span:last-child{letter-spacing:.24em;color:var(--muted)}

/* ---------- reading text ---------- */
.body-copy{font-size:15px;line-height:1.95;font-weight:350;letter-spacing:.03em;color:var(--text);text-align:justify}
.unit:has(> .body-copy:not(.delivery-copy)){padding:0 8px}
.chapter-heading,.finale-title,.cv-headline,.sc-headline{text-wrap:balance}
.body-copy,.comparison-description,.detail-copy,.tl-note,.cv-message{text-wrap:pretty}

/* ---------- cover: the exhibition's first room ---------- */
.cv-gallery{padding-top:8px;padding-bottom:0;text-align:center}
.cv-gallery .cv-kicker{display:flex;justify-content:center;align-items:center;gap:0;font-family:'Studio Sans',sans-serif;font-size:8px;line-height:1.6;letter-spacing:.38em;color:var(--accent)}
.cv-gallery .cv-kicker span:first-child:after{content:'';display:inline-block;width:24px;height:1px;background:var(--line);vertical-align:middle;margin:0 16px 0 10px}
.cv-gallery .cv-kicker span:last-child{color:var(--muted)}
.cv-gallery-title{font-family:'Studio Serif',Georgia,serif;font-size:26px;line-height:1.25;font-weight:300;letter-spacing:.02em;color:var(--foreground);margin:20px 0 0}
.cv-gallery .gallery-poster{margin:16px -32px 0;padding:0}
.cv-wall{padding:32px 32px 32px;background:${POOL}}
.cv-frame{padding:13px;background:var(--mat);border:0;box-shadow:0 0 0 1px var(--gilt-edge),0 0 0 2px #0b0e12,0 30px 36px -16px rgba(0,0,0,.82),0 -26px 72px 14px rgba(238,224,196,.075)}
.cv-frame .cv-photo{background:var(--mat);box-shadow:0 0 0 1px rgba(236,226,206,.16)}
.cv-gallery .gallery-poster-art{height:210px;padding:24px 56px;gap:16px;border:0;background:var(--mat);box-shadow:0 0 0 1px var(--gilt-edge),0 0 0 2px #0b0e12,0 30px 36px -16px rgba(0,0,0,.82)}
.gallery-poster-art i{border-color:rgba(205,184,142,.28)}
.gallery-poster-art i:nth-child(2){border-color:var(--accent)}
/* the wall label: title / year / medium, then a line of description */
.cv-label{margin:0 auto 0;width:auto;max-width:320px;padding:0;background:none;color:var(--foreground);box-shadow:none;display:flex;flex-direction:column;align-items:center;gap:0}
.cv-label b{order:1;font-family:var(--display);font-size:32px;line-height:1.25;font-weight:400;letter-spacing:.24em;padding-left:.24em;color:var(--foreground)}
.cv-label span{order:2;margin-top:8px;font-family:'Studio Sans',sans-serif;font-size:11px;line-height:1.6;letter-spacing:.2em;padding-left:.2em;color:var(--muted)}
.cv-label .cv-label-meta{order:3;margin-top:4px;font-size:8px;letter-spacing:.34em;padding-left:.34em;color:var(--accent)}
.cv-label em{order:4;font-family:var(--display);font-style:normal;font-size:15px;line-height:1.8;letter-spacing:.1em;color:var(--text);margin-top:0}
.cv-label em:before{content:'';display:block;width:1px;height:16px;margin:12px auto 10px;background:linear-gradient(180deg,transparent,var(--accent))}
.cv-gallery .cv-salutation{margin:24px 0 0;font-size:13px;letter-spacing:.1em;color:var(--muted)}
.cv-gallery .cv-foot{margin-top:24px;padding-top:14px;border-top:0;background:linear-gradient(90deg,transparent,var(--line) 30%,var(--line) 70%,transparent) top/100% 1px no-repeat}
.cv-gallery .cv-dates{justify-content:center;gap:48px}
.cv-gallery .cv-date{flex-direction:row;align-items:baseline;gap:16px}
.cv-gallery .cv-date-label{font-family:'Studio Sans',sans-serif;font-size:8px;letter-spacing:.34em;color:var(--muted)}
.cv-gallery .cv-date-label i{margin-left:8px;letter-spacing:.2em}
.cv-gallery .cv-date-value{font-family:'Studio Serif',Georgia,serif;font-size:16px;font-weight:300;letter-spacing:.18em;padding-left:.18em;color:var(--foreground)}
.cv-gallery .cv-project{margin-top:16px;font-size:11px;letter-spacing:.2em}
.unit.cv-message-unit.cv-gallery-message{margin:32px 0 0;padding:0 24px;text-align:center}
.cv-gallery-message .cv-message{font-family:var(--display);font-size:14.5px;line-height:2.05;letter-spacing:.08em;color:var(--text)}

/* ---------- teaser: an acquisition card ---------- */
.unit.teaser-unit{margin:40px 0 0}
.teaser-card{background:var(--ticket-bg);border:1px solid var(--ticket-line);border-radius:0;padding:20px 20px 20px 24px;gap:20px;align-items:center}
.teaser-card .teaser-stub{order:2;margin-left:auto;padding:5px;background:#fff}
.teaser-card .teaser-qr{width:72px;height:72px}
.teaser-text{gap:4px}
.teaser-kicker{font-family:'Studio Sans',sans-serif;font-size:8.5px;letter-spacing:.34em;color:var(--accent)}
.teaser-label{margin-top:4px;font-family:var(--display);font-size:16px;line-height:1.5;font-weight:400;letter-spacing:.1em;color:var(--foreground)}
.teaser-host{font-size:11px;letter-spacing:.1em;color:var(--muted)}
.teaser-hint{font-size:11px;letter-spacing:.08em;color:var(--muted)}
.teaser-card.teaser-link{padding:20px 24px;gap:20px}
.teaser-play{width:40px;height:40px;background:transparent;box-shadow:inset 0 0 0 1px var(--accent)}
.teaser-play:after{left:16px;top:13px;border-left:10px solid var(--accent);border-top:7px solid transparent;border-bottom:7px solid transparent}

/* ---------- chapters: exhibition room titles ---------- */
.unit.chapter,.unit.chapter.compact-chapter{text-align:center;border-top:0;margin:64px 0 0;padding:0}
.chapter-index,.compact-chapter .chapter-index{display:inline-flex;align-items:center;font-family:'Studio Sans',sans-serif;font-style:normal;font-size:8.5px;line-height:1.6;font-weight:400;letter-spacing:.4em;color:var(--accent)}
.chapter-index:before,.chapter-index:after{content:'';width:20px;height:1px;background:color-mix(in srgb,var(--accent) 40%,transparent)}
.chapter-index:before{margin-right:14px}.chapter-index:after{margin-left:10px}
.chapter-heading,.compact-chapter .chapter-heading{font-family:var(--display);font-size:21px;line-height:1.55;font-weight:400;letter-spacing:.14em;color:var(--foreground);margin:16px 0 8px}
.compact-chapter .chapter-heading{font-size:20px}
.chapter-caption{font-family:'Studio Sans',sans-serif;font-size:8px;line-height:1.6;letter-spacing:.36em;padding-left:.36em;color:var(--muted)}
.gallery-chapter-line{display:block;width:1px;height:24px;margin:16px auto 0;background:linear-gradient(180deg,var(--accent),transparent)}
.unit.chapter + .unit{margin-top:24px}
.appendix-caption{margin:16px auto 0;max-width:300px;font-size:12.5px;line-height:1.8;letter-spacing:.06em;color:var(--muted)}
.compact-context{font-size:11px;font-weight:400;letter-spacing:.2em;color:var(--accent);text-align:center}
.image-segment .masthead + .chapter{margin-top:0}
.pdf-page .unit.chapter{margin-top:48px}
.pdf-page .page-body>.unit.chapter:first-child{margin-top:8px}

/* ---------- tickets: museum acquisition cards ---------- */
.unit.ticket{padding:0 24px;background:var(--ticket-bg);border-left:1px solid var(--ticket-line);border-right:1px solid var(--ticket-line)}
.unit.ticket-start{margin-top:24px;padding-top:24px;border-top:1px solid var(--ticket-line);border-radius:0}
.unit.ticket-end{margin-bottom:16px;padding-bottom:24px;border-bottom:1px solid var(--ticket-line);border-radius:0}
.unit.ticket-start.ticket-end{border-radius:0}
.unit.chapter + .unit.ticket-start{margin-top:24px}
.ticket-start:not(.ticket-end):before,.ticket-start:not(.ticket-end):after{display:none}
.ticket .delivery-heading,.ticket-start.ticket-end .delivery-heading{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:16px;margin:0;padding:0 0 16px;border:0;border-bottom:1px solid var(--line)}
.ticket-start.ticket-end .delivery-heading{border-bottom:0;padding-bottom:0}
.ticket .item-number{grid-column:2;grid-row:1;min-width:0;padding:0;font-family:'Studio Serif',Georgia,serif;font-style:normal;font-size:26px;line-height:1;font-weight:200;letter-spacing:.04em;color:var(--accent);font-variant-numeric:lining-nums tabular-nums}
.ticket .delivery-heading>div{grid-column:1;grid-row:1;min-width:0}
.ticket .item-title{font-family:var(--display);font-size:17px;line-height:1.5;font-weight:400;letter-spacing:.1em;color:var(--foreground)}
.ticket .item-format{display:flex;flex-wrap:wrap;align-items:center;gap:0;margin-top:8px;letter-spacing:0}
.ticket .chip{padding:0;border:0;border-radius:0;font-family:'Studio Sans',sans-serif;font-size:11px;line-height:1.6;letter-spacing:.16em;color:var(--muted)}
.ticket .chip + .chip:before{content:'';display:inline-block;width:1px;height:9px;background:#3a444e;margin:0 10px;vertical-align:-1px}
.ticket .delivery-copy{padding-top:16px;font-size:14px;line-height:1.95;letter-spacing:.03em;text-align:left;color:var(--text)}
.ticket .access-note{display:grid;grid-template-columns:72px minmax(0,1fr);align-items:baseline;margin:0;padding-top:16px;font-size:14px;line-height:1.85;color:var(--muted)}
.ticket .access-label{margin:0;font-family:'Studio Sans',sans-serif;font-size:8.5px;line-height:1.6;letter-spacing:.3em;color:var(--accent);vertical-align:0}
.ticket .delivery-access{padding:24px 0 0}
.ticket .qr-image{width:144px;height:144px;outline:6px solid #fff}
.ticket .qr-label{margin-top:16px;font-family:var(--display);font-size:14px;letter-spacing:.1em}
.ticket .qr-host{font-size:11px;letter-spacing:.1em}
.ticket .qr-hint{margin-top:12px;font-size:11px;letter-spacing:.08em}
.delivery-link{font-size:13px;letter-spacing:.08em;border-bottom:1px solid color-mix(in srgb,var(--accent) 55%,transparent)}
.link-arrow{color:var(--accent)}

/* ---------- highlight stills: works hung under spotlights ---------- */
.unit.stills-hero-unit,.unit.stills-hero-unit.bleed{margin:0 -32px;padding:40px 46px 24px;max-width:none;background:${POOL}}
.unit.stills-row-unit{margin:0 -32px;padding:24px 43px;max-width:none;background:${POOL}}
.unit.stills-last{margin-bottom:16px}
.pdf-page .unit.stills-unit{max-width:none}
.still-frame,.still-hero.framed .still-frame{padding:0;border:0;background:var(--mat);box-shadow:${FRAME}}
.still-frame img,.still-hero.framed .still-frame img{inset:0;width:100%;height:100%}
.still-row{gap:38px}
.still-cell .still-frame{box-shadow:${FRAME_SM}}
.still-cell.wide .still-frame{box-shadow:${FRAME}}
.unit.stills-row-unit:has(> .still-row.single){padding-left:46px;padding-right:46px}
.still-caption{justify-content:center;gap:12px;padding-top:24px;font-size:12px;line-height:20px;letter-spacing:.1em;color:var(--muted)}
.still-cell .still-caption{justify-content:flex-start;padding-top:18px}
.still-cell.wide .still-caption{justify-content:center}
.still-no{font-family:'Studio Sans',sans-serif;font-size:8.5px;letter-spacing:.3em;color:var(--accent)}
.still-text{color:var(--text)}

/* ---------- the day: a quiet rail of hours ---------- */
.unit.tl{grid-template-columns:60px 32px minmax(0,1fr)}
.tl-time{font-family:'Studio Serif',Georgia,serif;font-size:15px;line-height:1.6;font-weight:300;letter-spacing:.12em;color:var(--foreground);text-align:right;padding-top:1px}
.tl-rail:before{left:16px;background:var(--line)}
.tl-first .tl-rail:before{top:12px}
.tl-last .tl-rail:before{height:12px}
.tl-dot:after{left:13px;top:9px;width:7px;height:7px;border:1px solid var(--accent);background:var(--background);box-shadow:0 0 0 4px var(--background),0 0 12px 4px rgba(238,224,196,.14)}
.tl-body{padding-bottom:24px}
.tl-title{font-family:var(--display);font-size:16px;line-height:1.6;font-weight:400;letter-spacing:.12em;color:var(--foreground)}
.tl-note{margin-top:4px;font-size:14px;line-height:1.9;letter-spacing:.03em;color:var(--muted)}
.tl-figure{margin:8px 0 8px;padding:8px;background:var(--mat);box-shadow:0 0 0 1px var(--gilt-edge),0 0 0 2px #0b0e12,0 20px 26px -14px rgba(0,0,0,.75)}
.tl-figure img{max-height:220px;box-shadow:0 0 0 1px rgba(236,226,206,.14)}
.unit.tl-last{margin-bottom:16px}

/* ---------- reveals: two states of one work under one spotlight ---------- */
.unit.reveal-unit{margin:16px -32px 0;padding:40px 0 0;background:${POOL}}
.reveal-frame{zoom:.784;background:var(--mat);box-shadow:0 0 0 1.4px rgba(236,226,206,.18),0 0 0 16.5px var(--mat),0 0 0 17.8px var(--gilt-edge),0 0 0 19px #0b0e12,0 34px 42px -20px rgba(0,0,0,.8),0 -32px 90px 18px rgba(238,224,196,.075)}
.reveal-line{width:1px;margin-left:0;background:rgba(246,240,228,.72);box-shadow:none}
.reveal-knob{width:28px;height:28px;margin:-14px 0 0 -14px;gap:5px;background:rgba(18,23,29,.55);border:1px solid rgba(246,240,228,.7);box-shadow:none}
.reveal-knob i:first-child{border-right:4px solid rgba(246,240,228,.92);border-top-width:3.5px;border-bottom-width:3.5px}
.reveal-knob i:last-child{border-left:4px solid rgba(246,240,228,.92);border-top-width:3.5px;border-bottom-width:3.5px}
.reveal-tag{top:auto;bottom:16px;padding:6px 8px 6px 12px;font-family:'Studio Sans',sans-serif;font-size:10.5px;line-height:1;letter-spacing:.36em;color:rgba(246,240,228,.94);background:rgba(18,23,29,.42)}
.reveal-tag-before{left:16px}
.reveal-tag-after{right:16px;color:#ecdcb8;background:rgba(18,23,29,.42)}
.reveal-caption{flex-direction:column;align-items:center;gap:8px;padding:40px 48px 0;text-align:center;font-size:11px;letter-spacing:.12em;color:var(--muted)}
.reveal-title{flex-direction:column;align-items:center;gap:8px;font-family:var(--display);font-size:15px;line-height:1.6;font-weight:400;letter-spacing:.14em;color:var(--foreground)}
.reveal-no{font-family:'Studio Sans',sans-serif;font-size:8.5px;letter-spacing:.36em;padding-left:.36em;color:var(--accent)}
.reveal-hint{font-size:11px;letter-spacing:.12em;color:var(--muted)}
.unit.reveal-description{margin:12px 0 0;padding:0 24px}
.comparison-description{font-size:14px;line-height:1.95;letter-spacing:.04em;text-align:center;color:var(--muted)}
.unit.reveal-unit+.unit.reveal-unit,.unit.reveal-description+.unit.reveal-unit{margin-top:24px}
.comparison-heading{font-family:var(--display);font-size:14px;font-weight:400;letter-spacing:.12em;margin-bottom:16px}
.comparison-number{font-family:'Studio Sans',sans-serif;font-style:normal;font-size:8.5px;letter-spacing:.34em;color:var(--accent)}
.comparison-frame{background:var(--mat);padding:6px;border:0;box-shadow:0 0 0 1px var(--gilt-edge)}
.comparison-tag,.comparison-pair.split .comparison-tag{background:rgba(18,23,29,.6);font-size:8px;letter-spacing:.3em;color:rgba(246,240,228,.92)}
.comparison-tag-after{color:#e6d4ae}

/* ---------- production details & appendix ---------- */
.detail-heading{font-family:var(--display);font-size:15px;font-weight:400;letter-spacing:.1em;color:var(--foreground)}
.detail-copy{font-size:14px;line-height:1.85;letter-spacing:.03em;color:var(--muted)}
.production-figure{padding:10px;border:0;background:var(--mat);box-shadow:0 0 0 1px var(--gilt-edge)}
.production-figure figcaption{font-size:12px;letter-spacing:.04em;text-align:center}
.appendix-start + .unit.appendix-unit{margin-top:24px}
.appendix-item{gap:20px;padding:24px 0;border-top:1px solid var(--line)}
.appendix-item.with-thumb{grid-template-columns:minmax(0,1fr) 120px}
.appendix-item .detail-heading{margin:0 0 8px;font-size:15px;line-height:1.6;letter-spacing:.1em}
.appendix-item .detail-copy,.appendix-more .detail-copy{font-size:14px;line-height:1.85}
.appendix-thumb img{padding:5px;background:var(--mat);outline:0;box-shadow:0 0 0 1px var(--gilt-edge)}
.appendix-thumb figcaption{padding-top:8px;font-size:11px;line-height:1.65;letter-spacing:.04em;color:#8a939b}

/* ---------- finale: the last work, dissolving into the wall ---------- */
.unit.finale-unit{margin:72px -32px 0;padding:32px 0 0;max-width:none;background:radial-gradient(ellipse 260px 132px at 50% 132px,rgba(238,224,196,.15),rgba(238,224,196,.12) 20%,rgba(238,224,196,.08) 40%,rgba(238,224,196,.045) 58%,rgba(238,224,196,.02) 74%,rgba(238,224,196,.006) 88%,rgba(238,224,196,0) 100%)}
.finale-banner{-webkit-mask-size:100% 100%;mask-size:100% 100%;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-image:linear-gradient(90deg,transparent 0%,rgba(0,0,0,.06) 5%,rgba(0,0,0,.15) 10%,rgba(0,0,0,.27) 15%,rgba(0,0,0,.41) 20%,rgba(0,0,0,.58) 25%,rgba(0,0,0,.76) 30%,rgba(0,0,0,.93) 35%,#000 40%,#000 60%,rgba(0,0,0,.93) 65%,rgba(0,0,0,.76) 70%,rgba(0,0,0,.58) 75%,rgba(0,0,0,.41) 80%,rgba(0,0,0,.27) 85%,rgba(0,0,0,.15) 90%,rgba(0,0,0,.06) 95%,transparent 100%);mask-image:linear-gradient(90deg,transparent 0%,rgba(0,0,0,.06) 5%,rgba(0,0,0,.15) 10%,rgba(0,0,0,.27) 15%,rgba(0,0,0,.41) 20%,rgba(0,0,0,.58) 25%,rgba(0,0,0,.76) 30%,rgba(0,0,0,.93) 35%,#000 40%,#000 60%,rgba(0,0,0,.93) 65%,rgba(0,0,0,.76) 70%,rgba(0,0,0,.58) 75%,rgba(0,0,0,.41) 80%,rgba(0,0,0,.27) 85%,rgba(0,0,0,.15) 90%,rgba(0,0,0,.06) 95%,transparent 100%)}
.finale-frame{height:186px;aspect-ratio:auto;border:0;padding:0;background:transparent;-webkit-mask-size:100% 100%;mask-size:100% 100%;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-image:linear-gradient(180deg,transparent 0%,rgba(0,0,0,.03) 5%,rgba(0,0,0,.09) 10%,rgba(0,0,0,.18) 15%,rgba(0,0,0,.3) 20%,rgba(0,0,0,.45) 25%,rgba(0,0,0,.63) 30%,rgba(0,0,0,.81) 35%,rgba(0,0,0,.97) 40%,#000 45%,#000 55%,rgba(0,0,0,.97) 60%,rgba(0,0,0,.81) 65%,rgba(0,0,0,.63) 70%,rgba(0,0,0,.45) 75%,rgba(0,0,0,.3) 80%,rgba(0,0,0,.18) 85%,rgba(0,0,0,.09) 90%,rgba(0,0,0,.03) 95%,transparent 100%);mask-image:linear-gradient(180deg,transparent 0%,rgba(0,0,0,.03) 5%,rgba(0,0,0,.09) 10%,rgba(0,0,0,.18) 15%,rgba(0,0,0,.3) 20%,rgba(0,0,0,.45) 25%,rgba(0,0,0,.63) 30%,rgba(0,0,0,.81) 35%,rgba(0,0,0,.97) 40%,#000 45%,#000 55%,rgba(0,0,0,.97) 60%,rgba(0,0,0,.81) 65%,rgba(0,0,0,.63) 70%,rgba(0,0,0,.45) 75%,rgba(0,0,0,.3) 80%,rgba(0,0,0,.18) 85%,rgba(0,0,0,.09) 90%,rgba(0,0,0,.03) 95%,transparent 100%)}
.finale-frame img{inset:0;width:100%;height:100%;object-position:50% 42%;filter:sepia(.14) saturate(.5) contrast(.74) brightness(.94) blur(.35px)}
.finale-veil{background:linear-gradient(rgba(30,44,64,.2),rgba(30,44,64,.2))}
.finale-veil:before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 30% 46% at 50% 44%,rgba(255,244,224,.26),rgba(255,238,208,.09) 55%,rgba(255,238,208,0) 100%);mix-blend-mode:screen}
.finale-caption{justify-content:center;align-items:center;gap:0;padding:16px 0 0;font-family:'Studio Sans',sans-serif;font-size:8px;line-height:1.6;letter-spacing:.38em;color:var(--muted)}
.finale-caption span:first-child{color:var(--accent)}
.finale-caption span + span:before{content:'';display:inline-block;width:18px;height:1px;background:#3a444e;vertical-align:middle;margin:0 14px 0 8px}
.finale-copy{align-items:center;text-align:center;gap:0;padding:40px 40px 0}
.finale-kicker{display:inline-flex;align-items:center;font-family:'Studio Sans',sans-serif;font-size:8.5px;line-height:1.6;letter-spacing:.42em;color:var(--accent)}
.finale-kicker:before,.finale-kicker:after{content:'';width:20px;height:1px;background:color-mix(in srgb,var(--accent) 40%,transparent)}
.finale-kicker:before{margin-right:14px}.finale-kicker:after{margin-left:10px}
.finale-title{margin-top:24px;font-family:var(--display);font-size:20px;line-height:1.7;font-weight:400;letter-spacing:.2em;padding-left:.2em;color:var(--foreground);text-shadow:0 0 22px rgba(238,224,196,.18)}
.finale-meta{margin-top:16px;font-family:'Studio Sans',sans-serif;font-size:9px;line-height:1.6;letter-spacing:.3em;color:var(--muted);font-variant-numeric:tabular-nums}
.finale-names{font-family:var(--display);font-size:13px;letter-spacing:.24em;color:var(--text)}
.finale-sep{color:var(--accent)}

/* ---------- signature & closing wall text ---------- */
.unit.signature{text-align:center;border-top:0;margin-top:64px;padding-top:0;padding-bottom:0}
.signature-caption{font-family:'Studio Sans',sans-serif;font-size:11px;line-height:1.6;letter-spacing:.3em;padding-left:.3em}
.signature-mark{margin:16px 0 0;font-family:'Studio Serif',Georgia,serif;font-size:24px;line-height:1.4;font-weight:300;letter-spacing:.02em;color:var(--foreground)}
.gallery-credit{flex-direction:column;align-items:center;justify-content:center;gap:8px;margin-top:24px}
.signature-name{font-family:var(--display);font-size:16px;line-height:1.6;font-weight:400;letter-spacing:.3em;padding-left:.3em;color:var(--foreground)}
.signature-studio{margin-top:0;font-family:'Studio Sans',sans-serif;font-size:11px;letter-spacing:.28em;padding-left:.28em;text-align:center;color:var(--muted)}
.unit.signature[data-after-finale]{margin-top:0;padding-top:40px;padding-bottom:0;text-align:center}
.signature[data-after-finale] .signature-caption{margin-bottom:0}
.signature[data-after-finale] .gallery-credit{margin-top:16px}
.unit.closing{border-top:0;margin-top:40px;padding-top:0;font-family:'Studio Sans',sans-serif;font-size:11px;line-height:1.9;letter-spacing:.24em;padding-left:.24em;color:#8a939b;text-align:center}
.unit.closing:before{content:'';display:block;width:1px;height:24px;margin:0 auto 16px;background:linear-gradient(180deg,transparent,var(--accent))}

/* ---------- PDF pages: the same rooms, a slightly tighter rhythm ---------- */
.pdf-page .cv-wall{padding:24px 32px 28px}
.pdf-page .cv-gallery-title{margin-top:16px}
.pdf-page .unit.chapter,.pdf-page .unit.chapter.compact-chapter{margin-top:36px}
.pdf-page .page-body>.unit.chapter:first-child{margin-top:8px}
.pdf-page .chapter-heading,.pdf-page .compact-chapter .chapter-heading{margin:12px 0 4px}
.pdf-page .gallery-chapter-line{height:14px;margin-top:10px}
.pdf-page .unit.chapter + .unit{margin-top:18px}
.pdf-page .unit.chapter + .unit.ticket-start{margin-top:18px}
.pdf-page .unit.ticket-start{margin-top:16px;padding-top:20px}
.pdf-page .unit.ticket-end{padding-bottom:20px}
.pdf-page .unit:has(> .body-copy:not(.delivery-copy)){margin-bottom:12px}
.pdf-page .unit.stills-hero-unit{padding-top:28px;padding-bottom:16px}
.pdf-page .unit.stills-row-unit{padding-top:18px;padding-bottom:18px}
.pdf-page .still-caption{padding-top:20px}
.pdf-page .still-cell .still-caption{padding-top:16px}
.pdf-page .unit.reveal-unit{margin-top:8px;padding-top:28px}
.pdf-page .unit.reveal-unit+.unit.reveal-unit,.pdf-page .unit.reveal-description+.unit.reveal-unit{margin-top:16px}
.pdf-page .reveal-caption{padding-top:30px;gap:6px}
.pdf-page .reveal-title{gap:6px}
.pdf-page .unit.reveal-description{margin-top:8px}
.pdf-page .appendix-item{padding:16px 0;gap:16px}
.pdf-page .appendix-item.with-thumb{grid-template-columns:minmax(0,1fr) 112px}
.pdf-page .appendix-item .detail-copy,.pdf-page .appendix-more .detail-copy{line-height:1.8}
.pdf-page .appendix-caption{margin-top:10px}
.pdf-page .appendix-start + .unit.appendix-unit{margin-top:16px}
.pdf-page .unit.finale-unit{margin-top:32px;padding-top:24px}
.pdf-page .finale-frame img{filter:sepia(.14) saturate(.5) contrast(.74) brightness(.94)}
.pdf-page .finale-copy{padding-top:28px}
.pdf-page .finale-title{margin-top:18px}
.pdf-page .finale-meta{margin-top:12px}
.pdf-page .unit.signature[data-after-finale]{padding-top:28px}
.pdf-page .unit.closing{margin-top:24px}
.pdf-page .unit.closing:before{height:18px;margin-bottom:12px}

/* ---------- share card: an exhibition invitation ---------- */
.sc-gallery{background:radial-gradient(ellipse 300px 230px at 50% 220px,rgba(238,224,196,.12),rgba(238,224,196,.095) 22%,rgba(238,224,196,.06) 42%,rgba(238,224,196,.03) 62%,rgba(238,224,196,.01) 82%,rgba(238,224,196,0) 100%),var(--background);text-align:center}
.sc-gallery:before{content:'';position:absolute;inset:14px;border:1px solid rgba(205,184,142,.22);box-shadow:inset 0 0 0 3px var(--background),inset 0 0 0 4px rgba(205,184,142,.1);pointer-events:none}
.sc-gallery .sc-top{flex-direction:column;justify-content:center;gap:6px;padding:40px 40px 32px}
.sc-gallery .sc-brand{font-family:'Studio Sans',sans-serif;font-size:9px;font-weight:400;letter-spacing:.4em;color:var(--foreground)}
.sc-gallery .sc-label{text-align:center;font-size:8px;letter-spacing:.42em;color:var(--accent)}
.sc-gallery .sc-photo{zoom:.9}
.sc-gallery .sc-shot{padding:14px;border:0;background:var(--mat);box-shadow:0 0 0 1px var(--gilt-edge),0 0 0 2px #0b0e12,0 26px 34px -16px rgba(0,0,0,.85)}
.sc-gallery .sc-shot img{box-shadow:0 0 0 1px rgba(236,226,206,.16)}
.sc-gallery .sc-small{padding:9px;box-shadow:0 0 0 1px var(--gilt-edge),0 0 0 2px #0b0e12,0 18px 26px -14px rgba(0,0,0,.8)}
.sc-gallery .sc-photo-empty{height:240px;margin:0 40px;background:var(--mat);box-shadow:0 0 0 1px var(--gilt-edge);font-family:'Studio Serif',Georgia,serif;font-style:normal;font-weight:300;font-size:30px;line-height:1.25;color:var(--foreground)}
.sc-gallery .sc-body{align-items:center;padding:24px 40px 16px}
.sc-gallery .sc-kicker{display:inline-flex;align-items:center;font-family:'Studio Sans',sans-serif;font-size:8.5px;letter-spacing:.42em;color:var(--accent);margin-bottom:16px}
.sc-gallery .sc-kicker:before,.sc-gallery .sc-kicker:after{content:'';width:20px;height:1px;background:color-mix(in srgb,var(--accent) 40%,transparent)}
.sc-gallery .sc-kicker:before{margin-right:14px}.sc-gallery .sc-kicker:after{margin-left:10px}
.share-card.sc-gallery .sc-names{font-family:var(--display);font-size:32px;line-height:1.3;font-weight:400;letter-spacing:.24em;padding-left:.24em;color:var(--foreground)}
.share-card.sc-gallery .sc-names:after{content:none}
.share-card.sc-gallery .sc-headline{margin-top:12px;font-family:var(--display);font-size:14.5px;line-height:1.75;letter-spacing:.1em;color:var(--text)}
.share-card.sc-gallery .sc-message{margin-top:8px;font-size:12px;line-height:1.85;letter-spacing:.04em;color:var(--muted)}
.share-card.sc-gallery .sc-date{display:flex;align-items:center;justify-content:center;gap:14px;margin-top:16px;font-family:'Studio Sans',sans-serif;font-size:11px;letter-spacing:.34em;color:var(--muted)}
.sc-gallery .sc-date:before,.sc-gallery .sc-date:after{content:'';width:20px;height:1px;background:var(--line)}
.share-card.sc-gallery:is([data-layout=single],[data-layout=empty]) .sc-names{font-size:38px}
.share-card.sc-gallery:is([data-layout=single],[data-layout=empty]) .sc-headline{font-size:16px;margin-top:16px}
.share-card.sc-gallery:is([data-layout=single],[data-layout=empty]) .sc-message{font-size:13px;-webkit-line-clamp:3}
.share-card.sc-gallery:is([data-layout=single],[data-layout=empty]) .sc-date{font-size:12px;margin-top:24px}
.sc-gallery .sc-foot{justify-content:center;margin:0 40px 40px;padding-top:16px;border-top:0;background:linear-gradient(90deg,transparent,var(--line) 25%,var(--line) 75%,transparent) top/100% 1px no-repeat;font-size:9px;letter-spacing:.3em;color:var(--muted)}
.sc-gallery .sc-teaser{gap:16px}
.sc-gallery .sc-teaser img{width:56px;height:56px;outline:4px solid #fff}
.sc-gallery .sc-teaser span{text-align:left;gap:4px}
.sc-gallery .sc-teaser b{font-family:'Studio Sans',sans-serif;font-size:11px;font-weight:400;letter-spacing:.24em;color:var(--accent)}
.sc-gallery .sc-teaser i{font-family:var(--display);font-size:12.5px;letter-spacing:.08em;color:var(--text)}
`;
