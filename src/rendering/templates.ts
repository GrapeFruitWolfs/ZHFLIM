import type { TemplateId } from '../shared/model.js';
import { editorialCss } from './editorial.js';

export interface TemplateDefinition {
  id: TemplateId; version: 1; name: string; background: string; foreground: string; muted: string;
  line: string; panel: string; accent: string; heroLabel: string; heroTitle: string; css: string;
}

export const templates: Record<TemplateId, TemplateDefinition> = {
  editorial: {
    id: 'editorial', version: 1, name: '私人影像展册 · Editorial', background: '#fafaf9', foreground: '#222421', muted: '#62685f',
    line: '#d8dcd5', panel: '#eff1eb', accent: '#57654f', heroLabel: 'THE WEDDING COLLECTION', heroTitle: '属于你们的婚礼影像。',
    css: editorialCss,
  },
  cinematic: {
    id: 'cinematic', version: 1, name: '夜幕 · Cinematic', background: '#151715', foreground: '#eeeee6', muted: '#a1a399',
    line: '#3c4038', panel: '#22261f', accent: '#b7b88c', heroLabel: 'A STORY IN MOTION', heroTitle: 'Every frame,\nforever.',
    css: `.chapter-heading{font-weight:350}.comparison-frame{background:#080b09}.signature-mark{font-style:italic}.delivery-heading{border-bottom:1px solid var(--line);padding-bottom:16px}`,
  },
  archive: {
    id: 'archive', version: 1, name: '制作档案 · Archive', background: '#ebe9df', foreground: '#26362f', muted: '#687269',
    line: '#b6beb2', panel: '#e1e3d8', accent: '#6f7954', heroLabel: 'PRIVATE PRODUCTION ARCHIVE', heroTitle: 'The wedding\narchive.',
    css: `.edition{font-family:'Studio Sans',sans-serif;font-style:normal;font-size:8px;letter-spacing:.1em}.masthead{border-bottom:2px solid var(--foreground)}.chapter{border-top:2px solid var(--foreground);display:grid;grid-template-columns:67px minmax(0,1fr);gap:14px;padding-top:17px}.chapter-index{font-family:'Studio Sans',sans-serif;font-style:normal;letter-spacing:.08em;font-size:9px;line-height:1.8}.chapter-heading{font-size:21px;margin:0 0 7px;letter-spacing:0}.chapter-caption{font-size:8px;letter-spacing:.1em}.delivery-heading{border-bottom:1px solid var(--line);padding:9px 0 15px;gap:17px}.item-number{font-family:'Studio Sans',sans-serif;font-size:9px;letter-spacing:.09em;line-height:1.8;min-width:62px;padding-top:6px}.item-format{font-variant-numeric:tabular-nums}.comparison-heading{padding:9px 0;border-top:1px solid var(--foreground);border-bottom:1px solid var(--line)}.comparison-number{font-family:'Studio Sans',sans-serif;font-size:10px;font-style:normal;letter-spacing:.06em}.comparison-label{font-size:12px;letter-spacing:.04em}.signature{border-top:2px solid var(--foreground)}.signature-mark{font-family:'Studio Sans',sans-serif;font-size:26px;letter-spacing:-.03em}.archive-credit{display:grid;grid-template-columns:95px minmax(0,1fr);gap:14px;margin-top:24px}.archive-credit-label{font-size:9px;color:var(--muted);letter-spacing:.08em}.closing{text-align:left;letter-spacing:.07em}`,
  },
  correspondence: {
    id: 'correspondence', version: 1, name: '写给你们 · Correspondence', background: '#f6f0e9', foreground: '#49352f', muted: '#786258',
    line: '#dacbc1', panel: '#eee3da', accent: '#a16858', heroLabel: 'A LETTER FOR TWO', heroTitle: 'For you,\nfor always.',
    css: `.masthead{border-bottom:0;margin-bottom:12px}.edition{font-size:11px}.chapter{border-top:0;padding-top:10px;margin-top:28px}.chapter-index{font-size:13px;font-style:italic;color:var(--muted);display:block}.chapter-heading{font-family:'Studio Serif','Studio Sans',serif;font-size:24px;font-weight:400;letter-spacing:.015em;margin:8px 0 9px}.chapter-caption{letter-spacing:.12em;font-size:8px}.body-copy{line-height:1.85}.delivery-heading{display:block;border-top:1px solid var(--line);padding-top:14px}.item-number{display:block;font-size:12px;font-style:italic;line-height:1.6;margin-bottom:8px}.item-title{font-size:18px;font-weight:450}.delivery-access{background:transparent;border:1px solid var(--line)}.comparison-heading{font-family:'Studio Serif','Studio Sans',serif;font-size:14px}.comparison-number{font-size:13px}.comparison-frame{padding:7px;background:#fffbf5;border:1px solid var(--line)}.comparison-label{font-size:12px;letter-spacing:.04em}.signature{border-top:0;padding-top:18px}.signature-caption{letter-spacing:.09em}.signature-mark{font-style:italic;font-size:44px;font-weight:380;margin:16px 0 24px}.signature-name{font-size:18px}.signature-studio{margin-top:8px}.letter-signoff{width:45px;height:1px;background:var(--accent);margin:24px 0 0}.closing{border-top:0;font-size:10px;letter-spacing:.06em;text-align:left;padding-top:5px}`,
  },
  gallery: {
    id: 'gallery', version: 1, name: '私人展映 · Gallery', background: '#18212a', foreground: '#f2eee6', muted: '#a1acb4',
    line: '#41505d', panel: '#222f3a', accent: '#cc9c6d', heroLabel: 'A PRIVATE VIEWING', heroTitle: 'The moments\nremain.',
    css: `.masthead{border-bottom:0;margin-bottom:18px}.edition{font-family:'Studio Sans',sans-serif;font-style:normal;font-size:8px;letter-spacing:.14em}.gallery-poster-art{height:100%;display:grid;grid-template-columns:1fr 1.4fr 1fr;gap:8px;align-items:center;padding:16px}.gallery-poster-art i{height:68%;border:1px solid #7e8d98;transform:skewY(-8deg)}.gallery-poster-art i:nth-child(2){height:100%;border-color:var(--accent);transform:skewY(8deg)}.chapter{border-top:1px solid var(--line);padding-top:20px;margin-top:30px}.chapter-index{font-family:'Studio Sans',sans-serif;font-style:normal;font-size:8px;letter-spacing:.2em}.chapter-heading{font-size:25px;line-height:1.4;font-weight:350;letter-spacing:-.015em;margin:12px 0 10px}.chapter-caption{font-size:8px;letter-spacing:.15em}.gallery-chapter-line{display:block;width:34px;height:2px;background:var(--accent);margin-top:17px}.delivery-heading{gap:17px;padding-top:9px}.item-number{font-size:32px;line-height:1.2}.item-title{font-weight:400;font-size:18px}.item-format{letter-spacing:.06em}.delivery-access{border:1px solid var(--line);background:transparent}.comparison-heading{font-size:12px;align-items:baseline;margin-bottom:10px}.comparison-number{font-size:11px;font-family:'Studio Sans',sans-serif;font-style:normal;letter-spacing:.14em}.comparison-frame{background:#0d141c;padding:8px;border:1px solid var(--line)}.comparison-label{font-size:12px;letter-spacing:.06em;padding-top:12px}.signature{border-top:1px solid var(--line);padding-top:25px}.signature-mark{font-size:42px;letter-spacing:-.04em;line-height:1.08}.gallery-credit{display:flex;justify-content:space-between;gap:18px;align-items:baseline;margin-top:25px}.signature-name{font-size:15px}.signature-studio{font-size:12px;text-align:right}.closing{font-size:8px;letter-spacing:.11em}`,
  },
};

const luminance = (hex: string): number => {
  const channels = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255).map(value => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};
export const contrastRatio = (a: string, b: string): number => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
};

/**
 * Each template owns a complete palette (`--accent`). The studio colour is applied only to small
 * brand marks (`--brand`) and only when it stays legible on the template background.
 */
export function brandColor(template: TemplateDefinition, studioAccent: string | undefined): string {
  return studioAccent && /^#[a-f\d]{6}$/i.test(studioAccent) && contrastRatio(studioAccent, template.background) >= 3 ? studioAccent : template.accent;
}

export const PAGE_WIDTH = 432;
export const PAGE_HEIGHT = 768;
export const PAGE_CONTENT_HEIGHT = 648;

export const sharedCss = `
*{box-sizing:border-box}html{margin:0;background:var(--background);color:var(--foreground);-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;font-family:'Studio Sans','Noto Sans CJK SC','Microsoft YaHei',sans-serif;font-size:13px;font-weight:400;line-height:1.9;font-synthesis:none}
.render-root{width:432px;margin:0 auto;background:var(--background)}.flow{padding:32px}.masthead,.page-masthead{display:flex;justify-content:space-between;align-items:flex-start;font-size:9px;letter-spacing:.15em;line-height:1.6;text-transform:uppercase;color:var(--muted)}
.masthead{padding-bottom:24px;border-bottom:1px solid var(--line);margin-bottom:24px}.brand-name{max-width:75%;overflow-wrap:anywhere}.brand-logo{max-width:115px;max-height:35px;object-fit:contain;display:block}.edition{font-family:'Studio Serif',Georgia,serif;font-style:italic;letter-spacing:0;font-size:12px}
.unit{margin:0 0 18px;overflow-wrap:anywhere;min-width:0}.unit:last-child{margin-bottom:0}
.chapter{margin-top:35px;padding-top:23px;border-top:1px solid var(--line)}.chapter-index{font-family:'Studio Serif',Georgia,serif;font-size:11px;color:var(--accent);font-style:italic}.chapter-heading{font-size:22px;line-height:1.5;letter-spacing:.035em;margin:8px 0 12px}.chapter-caption{font-size:8px;letter-spacing:.18em;color:var(--muted);text-transform:uppercase}.body-copy{white-space:pre-wrap;margin:0;line-height:1.95;font-size:13px}.delivery-heading{display:flex;align-items:flex-start;gap:14px;margin-top:8px}.item-number{font-family:'Studio Serif',Georgia,serif;font-size:25px;color:var(--accent);line-height:1.4}.item-title{font-size:16px;font-weight:500;line-height:1.6;margin:0}.item-format{display:block;font-size:12px;letter-spacing:.12em;color:var(--muted);margin-top:4px}.delivery-copy{color:var(--foreground)}.delivery-access{padding:17px;background:var(--panel);margin-top:5px}.access-note{font-size:11px;white-space:pre-wrap;margin:12px 0 0;color:var(--muted)}.delivery-link{display:inline-block;padding:8px 0;margin-right:20px;color:var(--foreground);text-decoration:none;font-size:11px;border-bottom:1px solid var(--accent);word-break:break-all}.link-arrow{padding-left:8px;color:var(--accent)}.qr-links{display:flex;flex-wrap:wrap;justify-content:center;gap:20px}.qr-link{display:flex;align-items:center;flex-direction:column;max-width:100%;text-align:center}.qr-image{width:172px;height:172px;display:block;background:#fff}.qr-label{font-size:14px;margin-top:10px}.qr-host{color:var(--muted);font-size:12px;word-break:break-all}.qr-hint{color:var(--muted);font-size:10px;margin:14px 0 0;text-align:center}
.comparison-unit{margin-top:12px}.comparison-heading{display:flex;justify-content:space-between;gap:10px;align-items:baseline;margin:0 0 13px;font-size:11px;letter-spacing:.04em}.comparison-number{font-family:'Studio Serif',Georgia,serif;color:var(--accent);font-size:16px;font-style:italic;white-space:nowrap}.comparison-pair{display:grid;gap:16px}.comparison-pair.split{grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:start}.comparison-pair.stacked{grid-template-columns:1fr}.comparison-figure{margin:0;min-width:0}.comparison-frame{position:relative;width:100%}.comparison-image{display:block;width:100%;height:auto}.comparison-label{display:flex;justify-content:space-between;font-size:8px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);padding:8px 0 0;gap:8px}.comparison-after .comparison-label{color:var(--accent)}.missing-image{border:1px dashed var(--line);padding:40px 12px;text-align:center;font-size:12px;color:var(--muted)}.comparison-single .comparison-image{max-height:550px;object-fit:contain;object-position:center}.comparison-single{break-before:page}.signature{border-top:1px solid var(--line);padding-top:30px;margin-top:32px;padding-bottom:26px}.signature-mark{font-family:'Studio Serif',Georgia,serif;font-size:40px;font-weight:400;line-height:1.2;letter-spacing:-.04em;margin:12px 0 25px}.signature-name{font-size:12px}.signature-studio{font-size:10px;color:var(--muted);margin-top:4px}.signature-caption{font-size:9px;letter-spacing:.16em;color:var(--accent);text-transform:uppercase}.closing{font-size:9px;letter-spacing:.15em;color:var(--muted);border-top:1px solid var(--line);padding-top:16px;margin-top:30px;text-align:center}
.pdf-page{width:432px;height:768px;padding:32px;break-after:page;background:var(--background);position:relative}.pdf-page:last-child{break-after:auto}.page-masthead{height:36px}.page-body{height:648px;display:flow-root}.page-footer{height:20px;display:flex;justify-content:space-between;align-items:flex-end;font-size:8px;color:var(--muted);letter-spacing:.1em}.pdf-page .chapter:first-child{margin-top:0}.pdf-page .unit{max-width:100%}.pdf-pages .flow{display:none}.image-segment{width:432px;padding:32px;background:var(--background);display:flow-root}.image-segment .unit:first-child{margin-top:0}.image-segment-footer{margin-top:16px;padding-top:12px;border-top:1px solid var(--line);font-size:8px;color:var(--muted);display:flex;justify-content:space-between;letter-spacing:.1em}

body{font-size:16px}.body-copy{font-size:16px;line-height:1.85}.item-title{font-size:18px}.delivery-link{font-size:14px}.access-note{font-size:14px;line-height:1.85}.comparison-label{font-size:12px;letter-spacing:.09em}.comparison-heading{font-size:13px}.signature-name{font-size:15px}.signature-studio{font-size:12px}.qr-hint{font-size:12px;line-height:1.7}
@page{size:432px 768px;margin:0}@media print{html,body,.render-root{width:432px;margin:0}.pdf-page{box-shadow:none}}
`;
