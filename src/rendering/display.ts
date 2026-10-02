import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import QRCode from 'qrcode';
import { STILLS_LIMITS, type AssetRef, type ComparisonLayout, type DeliveryDocument, type Issue, type ProjectRecord, type StudioSettings, type TemplateId } from '../shared/model.js';
import type { StudioStore } from '../server/contracts.js';
import { TEMPLATE_IDS } from '../shared/templates.js';
import { normalizeChapters } from '../shared/chapters.js';

export const RENDERER_VERSION = 'studio-renderer-8';
export const RENDER_BUDGET = { comparisons: 100, decodedPixels: 120_000_000, sourceBytes: 512 * 1024 * 1024, managedBytes: 256 * 1024 * 1024, visibleCharacters: 200_000, htmlBytes: 96 * 1024 * 1024 };
export const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
export const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);

/** `busy` is 0 (calm, simple) … 1 (crowded); used to pick closing pictures that can carry text. */
export interface DisplayImage { uri: string; width: number; height: number; backdrop?: string; busy?: number }

/** Mean local contrast of a small greyscale copy: crowds and confetti score high, portraits and skies low. */
export async function busyness(bytes: Buffer): Promise<number> {
  const { data, info } = await sharp(bytes).resize({ width: 96, height: 96, fit: 'inside' }).greyscale().raw().toBuffer({ resolveWithObject: true });
  let total = 0; let count = 0;
  for (let y = 0; y < info.height - 1; y++) for (let x = 0; x < info.width - 1; x++) {
    const index = y * info.width + x;
    total += Math.abs(data[index] - data[index + 1]) + Math.abs(data[index] - data[index + info.width]);
    count += 2;
  }
  return count ? Math.min(1, total / count / 40) : 0;
}

/** Fractions of the oriented source trimmed from each edge. */
export interface Bars { top: number; right: number; bottom: number; left: number }
export const NO_BARS: Bars = Object.freeze({ top: 0, right: 0, bottom: 0, left: 0 });

/**
 * Finds uniform near-black letterbox / pillarbox bands baked into film stills. Only full-width
 * (or full-height) bands count, thin bands are ignored, and the remaining picture must stay large,
 * so dark photographs are not cropped into their content.
 */
export async function detectLetterbox(bytes: Buffer): Promise<Bars> {
  const { data, info } = await sharp(bytes, { limitInputPixels: 80_000_000 }).rotate().resize({ width: 480, height: 480, fit: 'inside' }).greyscale().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const darkRow = (y: number, from: number, to: number) => {
    let count = 0;
    for (let x = from; x < to; x++) if (data[y * width + x] <= 24) count++;
    return count >= (to - from) * 0.985;
  };
  const darkColumn = (x: number, from: number, to: number) => {
    let count = 0;
    for (let y = from; y < to; y++) if (data[y * width + x] <= 24) count++;
    return count >= (to - from) * 0.985;
  };
  let top = 0; while (top < height && darkRow(top, 0, width)) top++;
  let bottom = 0; while (bottom < height - top && darkRow(height - 1 - bottom, 0, width)) bottom++;
  let left = 0; while (left < width && darkColumn(left, top, height - bottom)) left++;
  let right = 0; while (right < width - left && darkColumn(width - 1 - right, top, height - bottom)) right++;
  // Step one analysis pixel past anti-aliased band edges; ignore bands under 2 %.
  const edge = (value: number, size: number) => value / size >= 0.02 ? Math.min(1, (value + 1) / size) : 0;
  const result = { top: edge(top, height), right: edge(right, width), bottom: edge(bottom, height), left: edge(left, width) };
  if (1 - result.top - result.bottom < 0.4 || 1 - result.left - result.right < 0.4) return NO_BARS;
  return result;
}

/** A shared crop keeps Before / After framing identical: only bands present in both images are removed. */
export const sharedBars = (a: Bars, b: Bars): Bars => ({ top: Math.min(a.top, b.top), right: Math.min(a.right, b.right), bottom: Math.min(a.bottom, b.bottom), left: Math.min(a.left, b.left) });

async function cropRegion(bytes: Buffer, crop: Bars): Promise<{ left: number; top: number; width: number; height: number } | undefined> {
  if (!crop.top && !crop.right && !crop.bottom && !crop.left) return undefined;
  const meta = await sharp(bytes, { limitInputPixels: 80_000_000 }).metadata();
  const [width, height] = (meta.orientation ?? 1) >= 5 ? [meta.height!, meta.width!] : [meta.width!, meta.height!];
  const left = Math.round(width * crop.left); const top = Math.round(height * crop.top);
  const region = { left, top, width: Math.round(width * (1 - crop.right)) - left, height: Math.round(height * (1 - crop.bottom)) - top };
  return region.width > 0 && region.height > 0 ? region : undefined;
}
export interface DisplayLink { label: string; url: string; host: string; qr?: string }
export interface DisplayComparison { id: string; title: string; description?: string; before?: DisplayImage; after?: DisplayImage; number: string }
export interface DisplayDetails { content: string; image?: DisplayImage; caption: string; placement: 'inline' | 'appendix' }
export type DisplayBlock =
  | { type: 'intro'; id: string; title: string; salutation?: string; names?: string; weddingDate?: string; deliveryDate?: string; projectNo?: string; cover?: { emphasis: 'names' | 'photo'; headline: string; message: string; image?: DisplayImage; teaser?: DisplayLink } }
  | { type: 'text'; id: string; title: string; content: string; details?: DisplayDetails; source?: string }
  | { type: 'deliveries'; id: string; title: string; items: { id: string; title: string; description: string; format: string; accessNote: string; links: DisplayLink[] }[] }
  | { type: 'comparisons'; id: string; title: string; layout: ComparisonLayout; comparisons: DisplayComparison[] }
  | { type: 'signature'; id: string; title: string; photographer?: string; studio?: string }
  | { type: 'stills'; id: string; title: string; frames: { id: string; caption: string; image: DisplayImage }[] }
  | { type: 'timeline'; id: string; title: string; entries: { id: string; time: string; title: string; note: string; image?: DisplayImage }[] };
export interface DisplayDocument {
  templateId: TemplateId; accent: string; tagline: string; studio?: string; logo?: DisplayImage;
  blocks: DisplayBlock[]; output: DeliveryDocument['output'];
}
export interface AssetDependency { assetId: string; versionId: string; hash: string }
export interface PreparedDocument { display: DisplayDocument; issues: Issue[]; assets: AssetDependency[] }
export interface FontBundle { css: string; hashes: Record<string, string>; issues: Issue[] }

export function studioDay(timezone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)!.value).join('-');
}

export function resolvedDeliveryDate(document: DeliveryDocument, timezone: string, now = new Date()): string {
  if (!document.deliveryDate.visible) return '';
  return document.deliveryDate.mode === 'auto' ? studioDay(timezone, now) : document.deliveryDate.manualDate;
}

export const settingsFingerprint = (settings: StudioSettings) => digest(JSON.stringify({ timezone: settings.timezone }));

export function candidateIsStale(candidate: { draftRevision: number; resolvedDate: string; settingsHash: string }, project: ProjectRecord, settings: StudioSettings, now = new Date()): boolean {
  return candidate.draftRevision !== project.draftRevision || candidate.settingsHash !== settingsFingerprint(settings)
    || candidate.resolvedDate !== resolvedDeliveryDate(project.document, settings.timezone, now);
}

export function makeIssue(code: string, message: string, severity: Issue['severity'] = 'error', scope: Issue['scope'] = 'all', extra: Partial<Issue> = {}): Issue {
  return { id: digest(`${code}:${scope}:${message}:${extra.blockId ?? ''}:${extra.comparisonId ?? ''}`).slice(0, 24), code, severity, scope, message, ...extra };
}

export function safeDeliveryUrl(value: string): { url?: URL; error?: string } {
  if (!value.trim()) return {};
  try {
    const url = new URL(value.trim());
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return { error: '交付链接只支持不含账号凭据的 HTTP / HTTPS 地址。' };
    if (/^(localhost|127(?:\.\d+){3}|\[::1\])$/i.test(url.hostname)) return { error: '本机地址不能作为客户交付链接，请使用稳定的分享地址。' };
    if ([...url.searchParams.keys()].some(key => /^(x-amz-signature|x-amz-credential|awsaccesskeyid|signature|x-goog-signature)$/i.test(key))) return { error: '临时签名地址会过期，请填写稳定的交付页面或网盘分享链接。' };
    if (url.href.length > 4096) return { error: '交付链接过长，请使用稳定的分享地址。' };
    return { url };
  } catch { return { error: '交付链接不是有效网址，请检查完整的 HTTP / HTTPS 地址。' }; }
}

export function visibleAssetRefs(project: ProjectRecord): AssetRef[] {
  const refs: AssetRef[] = [];
  if (project.document.brand.logo) refs.push(project.document.brand.logo);
  for (const block of project.document.blocks) {
    if (block.visible && block.type === 'intro' && block.cover?.image) refs.push(block.cover.image);
    if (block.visible && block.type === 'text' && block.details?.placement !== 'hidden' && block.details?.image) refs.push(block.details.image);
    if (block.visible && block.type === 'stills') for (const frame of block.frames) if (frame.visible && frame.image) refs.push(frame.image);
    if (block.visible && block.type === 'timeline') for (const entry of block.entries) if (entry.visible && entry.image) refs.push(entry.image);
    if (!block.visible || block.type !== 'comparisons') continue;
    for (const comparison of block.comparisons.filter(item => item.visible)) {
      if (comparison.before) refs.push(comparison.before);
      if (comparison.after) refs.push(comparison.after);
    }
  }
  return [...new Map(refs.map(ref => [`${ref.assetId}:${ref.versionId}`, ref])).values()];
}

export async function verifyAssets(project: ProjectRecord, store: StudioStore, expected?: AssetDependency[]): Promise<AssetDependency[]> {
  const dependencies: AssetDependency[] = [];
  for (const ref of visibleAssetRefs(project)) {
    const asset = project.assets.find(item => item.id === ref.assetId && item.projectId === project.id && item.tenantId === project.tenantId);
    const version = asset?.versions.find(item => item.id === ref.versionId);
    if (!version) throw new Error('文档引用的图片版本不存在，请重新选择图片。');
    const resource = store.assetPath(project.id, version.id);
    const hash = digest(await readFile(resource.path));
    if (hash !== version.derivativeHash || (expected && !expected.some(item => item.assetId === ref.assetId && item.versionId === ref.versionId && item.hash === hash))) throw new Error('文档图片的管理副本已变化，请重新导入并检查预览。');
    dependencies.push({ assetId: ref.assetId, versionId: ref.versionId, hash });
  }
  return dependencies;
}

const ordered = <T extends { order: number; id: string }>(items: T[]): T[] => [...items].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
const shown = (field: { visible: boolean; value: string }): string | undefined => field.visible ? field.value.trim() : undefined;

/** Runs before reading or decoding any image; these are working-set guards, not quality claims. */
export async function checkResourceBudget(project: ProjectRecord, store: StudioStore): Promise<Issue[]> {
  const visibleBlocks = project.document.blocks.filter(block => block.visible);
  const comparisonCount = visibleBlocks.reduce((count, block) => count + (block.type === 'comparisons' ? block.comparisons.filter(comparison => comparison.visible).length : 0), 0);
  if (comparisonCount > RENDER_BUDGET.comparisons) return [makeIssue('RESOURCE_BUDGET', `本版一次最多输出 ${RENDER_BUDGET.comparisons} 组可见对比。请隐藏暂不交付的组，或分为不同文档。`)];
  const textCount = visibleBlocks.reduce((count, block) => count + block.title.length + (block.type === 'text' ? block.content.length + (block.details && block.details.placement !== 'hidden' ? block.details.content.length + block.details.caption.length : 0) : block.type === 'intro' ? (block.cover?.headline.length ?? 0) + (block.cover?.message.length ?? 0) + (block.cover?.teaser?.label.length ?? 0) : block.type === 'stills' ? block.frames.filter(item => item.visible).reduce((sum, item) => sum + item.caption.length, 0) : block.type === 'timeline' ? block.entries.filter(item => item.visible).reduce((sum, item) => sum + item.time.length + item.title.length + item.note.length, 0) : block.type === 'comparisons' ? block.comparisons.filter(item => item.visible).reduce((sum, item) => sum + item.title.length + (item.description?.length ?? 0), 0) : block.type === 'deliveries' ? block.items.filter(item => item.visible).reduce((sum, item) => sum + item.title.length + item.description.length + item.accessNote.length, 0) : 0), 0);
  if (textCount > RENDER_BUDGET.visibleCharacters) return [makeIssue('RESOURCE_BUDGET', '本次可见文案超过 20 万字符的工作预算，请分为不同交付文档。')];
  let decodedPixels = 0; let sourceBytes = 0; let managedBytes = 0;
  for (const ref of visibleAssetRefs(project)) {
    const asset = project.assets.find(item => item.id === ref.assetId && item.tenantId === project.tenantId && item.projectId === project.id);
    const version = asset?.versions.find(item => item.id === ref.versionId);
    if (!version) continue; // The normal resource check provides the precise missing-reference error.
    const scale = Math.min(1, 2160 / version.width, 6400 / version.height);
    decodedPixels += Math.ceil(version.width * scale) * Math.ceil(version.height * scale);
    sourceBytes += version.byteSize;
    if (decodedPixels > RENDER_BUDGET.decodedPixels || sourceBytes > RENDER_BUDGET.sourceBytes) return [makeIssue('RESOURCE_BUDGET', '本次图片超过 120MP 解码或 512MiB 引用源文件的工作预算，请减少可见对比组或分为不同文档。')];
    try { managedBytes += (await stat(store.assetPath(project.id, ref.versionId).path)).size; }
    catch { continue; }
    if (managedBytes > RENDER_BUDGET.managedBytes) return [makeIssue('RESOURCE_BUDGET', '本次引用的图片管理副本超过 256MiB，请减少可见对比组后再生成。')];
  }
  return [];
}

export async function prepareDisplay(project: ProjectRecord, store: StudioStore, date: string): Promise<PreparedDocument> {
  const document = project.document;
  const issues: Issue[] = [];
  const budgetIssues = await checkResourceBudget(project, store);
  issues.push(...budgetIssues);
  const dependencies: AssetDependency[] = [];
  const images = new Map<string, DisplayImage | undefined>();
  const display: DisplayDocument = {
    templateId: document.templateId, accent: /^#[a-f\d]{6}$/i.test(document.brand.accent) ? document.brand.accent : '#a2835d',
    tagline: document.brand.tagline, studio: shown(document.fields.studioName), blocks: [], output: structuredClone(document.output),
  };
  if (!TEMPLATE_IDS.includes(document.templateId) || document.templateVersion !== 1) issues.push(makeIssue('TEMPLATE_UNSUPPORTED', '当前模板版本不受支持，请选择可用模板。'));
  if (!['stacked', 'split'].includes(document.comparisonLayout)) issues.push(makeIssue('LAYOUT_UNSUPPORTED', '当前图片布局不受支持。'));

  const sources = new Map<string, Promise<Buffer>>();
  const sourceBytes = (ref: AssetRef): Promise<Buffer> => {
    if (!sources.has(ref.versionId)) sources.set(ref.versionId, (async () => {
      const asset = project.assets.find(item => item.id === ref.assetId && item.projectId === project.id && item.tenantId === project.tenantId);
      const version = asset?.versions.find(item => item.id === ref.versionId);
      if (!version) throw new Error('图片引用不属于当前项目，或版本已经缺失');
      const bytes = await readFile(store.assetPath(project.id, ref.versionId).path);
      if (digest(bytes) !== version.derivativeHash) throw new Error('管理副本的校验值与已保存版本不一致');
      return bytes;
    })());
    return sources.get(ref.versionId)!;
  };
  /** Letterbox detection never reports errors itself; image() reports the precise unavailable asset. */
  async function bars(ref: AssetRef | null): Promise<Bars> {
    if (!ref || budgetIssues.length) return NO_BARS;
    try { return await detectLetterbox(await sourceBytes(ref)); } catch { return NO_BARS; }
  }

  async function image(ref: AssetRef | null, blockId?: string, comparisonId?: string, logo = false, options: { crop?: Bars; backdrop?: boolean } = {}): Promise<DisplayImage | undefined> {
    if (!ref) return undefined;
    if (budgetIssues.length) return undefined;
    const crop = logo ? NO_BARS : options.crop ?? await bars(ref);
    const cacheKey = `${ref.assetId}:${ref.versionId}:${logo}:${Object.values(crop).join(',')}:${options.backdrop ?? false}`;
    if (images.has(cacheKey)) return images.get(cacheKey);
    try {
      const asset = project.assets.find(item => item.id === ref.assetId && item.projectId === project.id && item.tenantId === project.tenantId);
      const version = asset?.versions.find(item => item.id === ref.versionId);
      if (!version) throw new Error('图片引用不属于当前项目，或版本已经缺失');
      const bytes = await sourceBytes(ref);
      const hash = digest(bytes);
      let pipeline = sharp(bytes, { limitInputPixels: 80_000_000 }).rotate();
      const region = await cropRegion(bytes, crop);
      if (region) pipeline = pipeline.extract(region);
      pipeline = pipeline.toColourspace('srgb').resize({ width: logo ? 1000 : 2160, height: logo ? 1000 : 6400, fit: 'inside', withoutEnlargement: true });
      const rendered = await (logo ? pipeline.png() : pipeline.jpeg({ quality: 93, chromaSubsampling: '4:4:4' })).toBuffer({ resolveWithObject: true });
      const result: DisplayImage = { uri: `data:image/${logo ? 'png' : 'jpeg'};base64,${rendered.data.toString('base64')}`, width: rendered.info.width, height: rendered.info.height };
      if (!logo) result.busy = await busyness(rendered.data);
      if (options.backdrop) {
        // A tiny blurred copy lets covers fill tall frames without cropping the photograph itself.
        const blurred = await sharp(rendered.data).resize({ width: 64, height: 64, fit: 'inside' }).blur(1.6).modulate({ saturation: 0.85 }).jpeg({ quality: 72 }).toBuffer();
        result.backdrop = `data:image/jpeg;base64,${blurred.toString('base64')}`;
      }
      images.set(cacheKey, result);
      if (!dependencies.some(item => item.assetId === ref.assetId && item.versionId === ref.versionId)) dependencies.push({ ...ref, hash });
      if (!logo && version.width < 800) issues.push(makeIssue('LOW_RESOLUTION', '一张文档图片宽度不足 800 像素，请检查手机阅读时的细节。', 'warning', 'all', { blockId, comparisonId, assetId: asset!.id }));
      return result;
    } catch (error) {
      issues.push(makeIssue('ASSET_UNAVAILABLE', `图片无法读取：${error instanceof Error ? error.message.replace(/(?:[A-Z]:\\|\/)[^\s，。]+/gi, '管理文件') : '请重新导入'}`, 'error', 'all', { blockId, comparisonId, assetId: ref.assetId }));
      images.set(cacheKey, undefined);
      return undefined;
    }
  }

  /** Validates a customer-facing link and prepares a phone-readable QR code for long images. */
  async function deliveryLink(value: string, label: string, owner: string, blockId: string): Promise<DisplayLink | undefined> {
    const checked = safeDeliveryUrl(value);
    if (checked.error) issues.push(makeIssue('LINK_INVALID', `${owner}：${checked.error}`, 'error', 'all', { blockId }));
    if (!checked.url) return undefined;
    const link: DisplayLink = { label, url: checked.url.href, host: checked.url.hostname };
    try {
      const qr = QRCode.create(link.url, { errorCorrectionLevel: 'M' });
      if (qr.modules.size > 77) throw new Error('链接过长');
      link.qr = await QRCode.toDataURL(link.url, { width: 600, margin: 4, errorCorrectionLevel: 'M', color: { dark: '#181818', light: '#ffffff' } });
    } catch { issues.push(makeIssue('QR_UNREADABLE', `${owner}的链接过长，无法生成适合手机识别的二维码。请使用更短的稳定分享链接。`, 'error', 'image', { blockId })); }
    return link;
  }

  if (document.brand.logo) display.logo = await image(document.brand.logo, undefined, undefined, true);
  for (const block of normalizeChapters(document.blocks).filter(item => item.visible)) {
    if (!block.title.trim()) issues.push(makeIssue('BLOCK_TITLE_EMPTY', '一个可见章节尚未填写标题，请补充标题或隐藏该章节。', 'error', 'all', { blockId: block.id }));
    if (block.type === 'intro') {
      const intro: Extract<DisplayBlock, { type: 'intro' }> = { type: 'intro', id: block.id, title: block.title, salutation: shown(document.fields.salutation), names: shown(document.fields.coupleNames), weddingDate: shown(document.fields.weddingDate), deliveryDate: document.deliveryDate.visible ? date : undefined, projectNo: shown(document.fields.projectNo) };
      if (block.cover) intro.cover = { emphasis: block.cover.emphasis, headline: block.cover.headline, message: block.cover.message, image: await image(block.cover.image, block.id, undefined, false, { backdrop: true }) };
      if (intro.cover && block.cover?.teaser?.url.trim()) intro.cover.teaser = await deliveryLink(block.cover.teaser.url, block.cover.teaser.label.trim() || '先看预告片', '封面预告', block.id);
      if (intro.names !== undefined && !intro.names) issues.push(makeIssue('NAMES_EMPTY', '请填写新人姓名，或明确关闭该字段的显示。', 'error', 'all', { blockId: block.id }));
      if (intro.weddingDate !== undefined && !intro.weddingDate) issues.push(makeIssue('WEDDING_DATE_EMPTY', '请填写婚礼日期，或关闭该字段的显示。', 'error', 'all', { blockId: block.id }));
      if (intro.deliveryDate !== undefined && !intro.deliveryDate) issues.push(makeIssue('DELIVERY_DATE_EMPTY', '请填写手动交付日期，或使用自动日期。', 'error', 'all', { blockId: block.id }));
      display.blocks.push(intro);
    } else if (block.type === 'text') {
      if (!block.content.trim()) issues.push(makeIssue('TEXT_EMPTY', `“${block.title || '文案章节'}”尚未填写内容，请补充或隐藏。`, 'error', 'all', { blockId: block.id }));
      const details = block.details && block.details.placement !== 'hidden' ? { content: block.details.content, caption: block.details.caption, placement: block.details.placement, image: await image(block.details.image, block.id, undefined, false, { crop: NO_BARS }) } : undefined;
      display.blocks.push({ type: 'text', id: block.id, title: block.title, content: block.content, details, ...(block.sourceDefinitionId ? { source: block.sourceDefinitionId } : {}) });
    } else if (block.type === 'signature') {
      display.blocks.push({ type: 'signature', id: block.id, title: block.title, photographer: shown(document.fields.photographerName), studio: shown(document.fields.studioName) });
    } else if (block.type === 'deliveries') {
      const items: Extract<DisplayBlock, { type: 'deliveries' }>['items'] = [];
      for (const item of ordered(block.items.filter(value => value.visible))) {
        if (!item.title.trim()) issues.push(makeIssue('ITEM_TITLE_EMPTY', '一个可见交付条目尚未填写名称，请补充或隐藏。', 'error', 'all', { blockId: block.id }));
        const links: DisplayLink[] = [];
        for (const [value, label] of [[item.playbackUrl, '观看影片'], [item.downloadUrl, '下载与保存']] as const) {
          const link = await deliveryLink(value, label, item.title || '交付内容', block.id);
          if (link) links.push(link);
        }
        if (item.method === 'link' && !links.length && !item.playbackUrl.trim() && !item.downloadUrl.trim()) issues.push(makeIssue('LINK_MISSING', `${item.title || '交付内容'}选择了链接交付，但尚未填写观看或下载地址。`, 'error', 'all', { blockId: block.id }));
        if (item.method === 'attachment') issues.push(makeIssue('ATTACHMENT_UNSUPPORTED', `${item.title || '交付内容'}使用附件交付，本版尚未绑定附件；请改用链接或在说明中明确线下交接。`, 'error', 'all', { blockId: block.id }));
        items.push({ id: item.id, title: item.title, description: item.description, format: item.format, accessNote: item.accessNote, links });
      }
      if (!items.length) issues.push(makeIssue('DELIVERIES_EMPTY', `“${block.title || '交付清单'}”没有可见交付内容，请添加条目或隐藏该章节。`, 'error', 'all', { blockId: block.id }));
      display.blocks.push({ type: 'deliveries', id: block.id, title: block.title, items });
    } else if (block.type === 'stills') {
      const frames: Extract<DisplayBlock, { type: 'stills' }>['frames'] = [];
      const visible = ordered(block.frames.filter(frame => frame.visible));
      for (const [index, frame] of visible.entries()) {
        if (!frame.image) { issues.push(makeIssue('STILL_IMAGE_MISSING', `“${block.title || '高光画面'}”第 ${index + 1} 张尚未选择图片，请选择图片或隐藏这一张。`, 'error', 'all', { blockId: block.id })); continue; }
        const picture = await image(frame.image, block.id, undefined, false, { backdrop: index === 0 });
        if (picture) frames.push({ id: frame.id, caption: frame.caption, image: picture });
      }
      if (!visible.length) issues.push(makeIssue('STILLS_EMPTY', `“${block.title || '高光画面'}”还没有可见画面，请添加图片或隐藏该章节。`, 'error', 'all', { blockId: block.id }));
      else if (visible.length < STILLS_LIMITS.min) issues.push(makeIssue('STILLS_FEW', `“${block.title || '高光画面'}”建议至少 ${STILLS_LIMITS.min} 张画面，节奏会更完整。`, 'warning', 'all', { blockId: block.id }));
      if (visible.length > STILLS_LIMITS.max) issues.push(makeIssue('STILLS_TOO_MANY', `“${block.title || '高光画面'}”最多展示 ${STILLS_LIMITS.max} 张，请隐藏多余的画面。`, 'error', 'all', { blockId: block.id }));
      display.blocks.push({ type: 'stills', id: block.id, title: block.title, frames });
    } else if (block.type === 'timeline') {
      const entries: Extract<DisplayBlock, { type: 'timeline' }>['entries'] = [];
      for (const [index, entry] of ordered(block.entries.filter(item => item.visible)).entries()) {
        if (!entry.time.trim() && !entry.title.trim()) issues.push(makeIssue('TIMELINE_ENTRY_EMPTY', `“${block.title || '当天时间线'}”第 ${index + 1} 个时刻缺少时间和标题，请补充或隐藏。`, 'error', 'all', { blockId: block.id }));
        entries.push({ id: entry.id, time: entry.time.trim(), title: entry.title.trim(), note: entry.note, image: await image(entry.image, block.id) });
      }
      if (!entries.length) issues.push(makeIssue('TIMELINE_EMPTY', `“${block.title || '当天时间线'}”还没有可见时刻，请添加或隐藏该章节。`, 'error', 'all', { blockId: block.id }));
      display.blocks.push({ type: 'timeline', id: block.id, title: block.title, entries });
    } else if (block.type === 'comparisons') {
      const layout = block.layout === 'inherit' ? document.comparisonLayout : block.layout;
      if (!['split', 'stacked'].includes(layout)) issues.push(makeIssue('LAYOUT_UNSUPPORTED', '对比模块的布局不受支持，请选择上下或左右排列。', 'error', 'all', { blockId: block.id }));
      const comparisons: DisplayComparison[] = [];
      for (const [index, comparison] of ordered(block.comparisons.filter(item => item.visible)).entries()) {
        if (!comparison.before || !comparison.after) issues.push(makeIssue('COMPARISON_INCOMPLETE', `${comparison.title || `对比 ${index + 1}`}缺少 Before 或 After，请补图或隐藏该组。`, 'error', 'all', { blockId: block.id, comparisonId: comparison.id }));
        const crop = sharedBars(await bars(comparison.before), await bars(comparison.after));
        const before = await image(comparison.before, block.id, comparison.id, false, { crop });
        const after = await image(comparison.after, block.id, comparison.id, false, { crop });
        if (before && after && Math.abs(before.width / before.height - after.width / after.height) > 0.05) issues.push(makeIssue('ASPECT_RATIO_MISMATCH', `${comparison.title || `对比 ${index + 1}`}的前后图片比例不同，将保留完整画面，请确认是否可比。`, 'warning', 'all', { blockId: block.id, comparisonId: comparison.id }));
        if (comparison.before && comparison.after && comparison.before.versionId === comparison.after.versionId) issues.push(makeIssue('IDENTICAL_COMPARISON', `${comparison.title || `对比 ${index + 1}`}使用同一张图片作为 Before 和 After，请确认。`, 'warning', 'all', { blockId: block.id, comparisonId: comparison.id }));
        comparisons.push({ id: comparison.id, title: comparison.title, description: comparison.description, number: String(index + 1).padStart(2, '0'), before, after });
      }
      if (!comparisons.length) issues.push(makeIssue('COMPARISONS_EMPTY', `“${block.title || '调色对比'}”尚无可见对比组，请导入图片、添加对比或隐藏该章节。`, 'error', 'all', { blockId: block.id }));
      // One presentation for every project: an opening reveal, then side-by-side pairs. The stored layout is kept for compatibility only.
      display.blocks.push({ type: 'comparisons', id: block.id, title: block.title, layout: 'split', comparisons });
    }
  }
  if (!display.blocks.length) issues.push(makeIssue('DOCUMENT_EMPTY', '没有可见的交付章节，请至少显示一个模块。'));
  if (display.blocks.some(block => (block.type === 'deliveries' && block.items.some(item => item.links.length)) || (block.type === 'intro' && block.cover?.teaser))) issues.push(makeIssue('LINKS_UNVERIFIED', '交付链接未自动访问，请确认客户拥有访问权限；长图二维码需在实际发送后检查识别效果。', 'warning'));
  return { display, issues, assets: dependencies };
}

const fontCache = new Map<string, { modified: number; bytes: Buffer; hash: string }>();
export async function fontBytes(rootDir: string, filename: string): Promise<{ bytes: Buffer; hash: string }> {
  const location = path.join(rootDir, 'public', 'fonts', filename);
  const info = await stat(location);
  const existing = fontCache.get(location);
  if (existing && existing.modified === info.mtimeMs) return existing;
  const bytes = await readFile(location);
  const value = { modified: info.mtimeMs, bytes, hash: digest(bytes) };
  fontCache.set(location, value);
  return value;
}

/**
 * Studio Serif SC is a GB2312 subset of Noto Serif SC (variable weight 200–900) used for display
 * headings only. Characters outside the subset fall back per glyph to Studio Sans, which is the
 * coverage font checked by checkGlyphCoverage.
 */
export const BUNDLED_FONTS = [['NotoSansSC.ttf', 'Studio Sans'], ['SourceSerif4.ttf', 'Studio Serif'], ['NotoSerifSC-GB2312.ttf', 'Studio Serif SC']] as const;

export async function loadFonts(rootDir: string, embed = true): Promise<FontBundle> {
  const hashes: Record<string, string> = {};
  const issues: Issue[] = [];
  const styles: string[] = [];
  for (const [filename, family] of BUNDLED_FONTS) {
    try {
      const { bytes, hash } = await fontBytes(rootDir, filename);
      hashes[filename] = hash;
      const source = embed ? `data:font/ttf;base64,${bytes.toString('base64')}` : `/fonts/${filename}`;
      styles.push(`@font-face{font-family:'${family}';font-style:normal;font-weight:100 900;font-display:block;src:url(${source}) format('truetype')}`);
    } catch {
      issues.push(embed
        ? makeIssue('FONT_UNAVAILABLE', `${filename} 缺失或无法读取，请恢复应用自带的字体文件后重新生成正式预览。`)
        : makeIssue('FONT_FALLBACK', `${filename} 尚未准备，快速预览暂用系统字体；正式输出需要恢复打包字体。`, 'warning'));
    }
  }
  return { css: styles.join('\n'), hashes, issues };
}
