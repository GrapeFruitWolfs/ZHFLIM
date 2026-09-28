export const editorialCss = `
body{font-size:18.5px;line-height:1.75}
.masthead{padding-bottom:17px;margin-bottom:22px;letter-spacing:.06em}
.edition{font-family:'Studio Sans',sans-serif;font-style:normal;font-size:9px;letter-spacing:.06em}
.body-copy{font-size:18.5px;line-height:1.75}
.chapter{border-top:1px solid var(--line);margin-top:28px;padding-top:19px}
.chapter-index{font-family:'Studio Sans',sans-serif;font-size:11px;font-style:normal;letter-spacing:.08em;color:var(--muted)}
.chapter-heading{font-size:27px;font-weight:580;letter-spacing:-.025em;line-height:1.35;margin:9px 0 0}
.chapter-caption{display:none}
.compact-chapter{margin-top:21px;padding-top:16px}
.compact-chapter .chapter-index{display:none}
.compact-chapter .chapter-heading{font-size:24px;margin:0;line-height:1.4}
.delivery-heading{gap:15px;margin-top:4px;padding-top:6px}
.item-number{font-family:'Studio Sans',sans-serif;font-size:13px;font-style:normal;line-height:1.8;padding-top:3px;color:var(--muted)}
.item-title{font-size:21px;line-height:1.5;font-weight:560;letter-spacing:-.015em}
.item-format{font-size:13px;letter-spacing:0;margin-top:7px}
.delivery-copy{color:var(--foreground)}
.delivery-access{padding:16px 20px;border-radius:10px}
.delivery-link{font-size:16px;padding:5px 0}
.access-note{font-size:15px;line-height:1.8}
.comparison-heading{font-size:14px;letter-spacing:0;line-height:1.6;margin-bottom:12px}
.comparison-number{font-family:'Studio Sans',sans-serif;font-size:12px;font-style:normal;letter-spacing:0}
.comparison-frame{background:#151715}
.comparison-label{font-size:13px;letter-spacing:.03em;padding-top:9px}
.comparison-after .comparison-label{color:var(--foreground)}
.signature{margin-top:30px;padding-top:26px;padding-bottom:14px}
.signature-mark{font-family:'Studio Sans',sans-serif;font-size:30px;line-height:1.5;font-weight:520;letter-spacing:-.03em;margin:13px 0 22px}
.signature-caption{font-size:12px;letter-spacing:0;color:var(--muted)}
.signature-name{font-size:16px}.signature-studio{font-size:13px}
.closing{font-size:12px;letter-spacing:0;line-height:1.8;text-align:left;margin-top:24px;padding-top:15px}
`;

export const storyCss = `
.story-cover{position:relative;display:flex;flex-direction:column;gap:19px;padding:10px 0 23px;min-height:0}
.story-kicker{font-size:11px;letter-spacing:.09em;color:var(--muted);margin:0 0 16px}
.story-name{font-family:'Studio Sans',sans-serif;font-size:37px;font-weight:560;line-height:1.35;letter-spacing:-.025em;white-space:pre-line;margin:0}
.story-headline{font-family:'Studio Sans',sans-serif;font-size:21px;line-height:1.5;font-weight:450;letter-spacing:-.015em;white-space:pre-wrap;margin:15px 0 0}
.story-message{font-size:17px;line-height:1.8;margin:0;white-space:pre-wrap;color:var(--muted)}
.story-photo{margin:0;background:var(--panel)}
.story-photo img{display:block;width:100%;height:auto;max-height:255px;object-fit:contain}
.story-cover .salutation{font-size:13px}.story-cover .date-label{font-size:10px;letter-spacing:.07em}
.story-cover .date-value{font-family:'Studio Sans',sans-serif;font-size:14px}
.story-cover .access-note{font-size:12px;margin-top:10px}
.story-cover.photo-first .story-photo{order:-1}
.story-cover.photo-first .story-photo img{max-height:315px}
.story-cover.photo-first .story-name{font-size:31px}
.story-cover.photo-first .story-headline{font-size:19px;margin-top:10px}
.story-cover .date-line{padding-top:12px}
.detail-heading{font-size:16px;font-weight:550;line-height:1.55;margin:0;color:var(--foreground)}
.detail-copy{font-size:15px;line-height:1.8;white-space:pre-wrap;margin:0;color:var(--muted)}
.production-figure{margin:0;border:1px solid var(--line);padding:10px;background:var(--panel)}
.production-figure img{display:block;width:100%;height:auto;max-height:350px;object-fit:contain}
.production-figure figcaption{font-size:13px;line-height:1.75;color:var(--muted);padding-top:10px;white-space:pre-wrap}
.comparison-description{font-size:15px;line-height:1.8;color:var(--muted);margin:0;white-space:pre-wrap}
.appendix-title{font-size:28px;line-height:1.4;margin:0 0 9px;font-weight:550}
.appendix-caption{font-size:13px;color:var(--muted);margin:0}
.detail-unit{margin-bottom:14px}
.compact-context{font-size:13px;line-height:1.6;font-weight:550;letter-spacing:0;margin-bottom:12px;color:var(--foreground)}
`;
