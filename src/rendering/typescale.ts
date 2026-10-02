import type { TemplateId } from '../shared/model.js';

/**
 * The quiet type scale, loaded last so it settles every template: names and titles stay
 * clearly the largest words on a screen, but never shout. Chinese display text uses regular
 * or medium weights with a little tracking instead of heavy bold.
 */
export const typeScaleCss = `
.chapter-heading{font-size:22px;line-height:1.45;font-weight:400;letter-spacing:.03em}
.compact-chapter .chapter-heading{font-size:20px}
.signature-mark{font-size:24px;line-height:1.35;font-weight:300;letter-spacing:.01em}
.item-title{font-size:18px;font-weight:500;letter-spacing:.01em}
.item-number{font-weight:300}
.tl-title{font-size:17px;font-weight:500}
.teaser-label{font-size:17px;font-weight:500}
.cv-headline{font-weight:400}
.sc-names{font-size:34px;font-weight:400;letter-spacing:.04em}
.share-card:is([data-layout=single],[data-layout=empty]) .sc-names{font-size:42px}
.sc-photo-empty{font-size:30px}
.sc-seal{font-weight:500}
`;

export const typeScaleTemplateCss: Record<TemplateId, string> = {
  editorial: `
.cv-editorial .cv-names{font-size:38px;line-height:1.25;font-weight:400;letter-spacing:.06em}
.cv-editorial.no-photo .cv-names{font-size:44px}
.cv-editorial .cv-headline{font-size:17px;letter-spacing:.04em}
.cv-editorial .cv-numeral{font-size:88px;font-weight:200}
.chapter-heading{font-size:22px}
.signature-mark{font-size:22px;line-height:1.6;letter-spacing:.06em}`,
  cinematic: `
.cv-cinematic .cv-names{font-size:32px;letter-spacing:.2em}
.cv-film-title{font-size:38px}
.chapter-heading{font-weight:300;letter-spacing:.08em}
.item-number{font-size:24px}
.signature-mark{font-size:24px;font-weight:300;letter-spacing:.04em}
.sc-cinematic .sc-names{font-weight:300;letter-spacing:.18em}`,
  archive: `
.cv-archive-title{font-size:32px;font-weight:400;letter-spacing:-.01em}
.cv-archive.no-photo .cv-archive-title{font-size:42px}
.chapter-heading{font-size:19px;font-weight:500;letter-spacing:.02em}
.compact-chapter .chapter-heading{font-size:18px}
.signature-mark{font-size:20px;font-weight:400;letter-spacing:0}
.sc-archive .sc-names{font-size:30px}
.sc-archive:is([data-layout=single],[data-layout=empty]) .sc-names{font-size:38px}`,
  correspondence: `
.cv-correspondence .cv-names{font-size:34px;font-weight:400;letter-spacing:.08em}
.cv-correspondence.no-photo .cv-names{font-size:40px}
.cv-correspondence .cv-letter-fallback{font-size:44px}
.cv-correspondence .cv-headline{font-size:17px}
.signature-mark{font-size:20px;line-height:1.3;margin:18px 0 8px}`,
  gallery: `
.cv-gallery-title{font-size:32px;letter-spacing:0}
.item-number{font-size:24px}
.signature-mark{font-size:24px;font-weight:300}
.sc-gallery .sc-names{font-weight:400}`,
};
