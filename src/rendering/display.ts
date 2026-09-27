import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import QRCode from 'qrcode';
import type { AssetRef, ComparisonLayout, DeliveryDocument, Issue, ProjectRecord, StudioSettings, TemplateId } from '../shared/model.js';
import type { StudioStore } from '../server/contracts.js';
import { TEMPLATE_IDS } from '../shared/templates.js';

export const RENDERER_VERSION = 'studio-renderer-2';
export const RENDER_BUDGET = { comparisons: 100, decodedPixels: 120_000_000, sourceBytes: 512 * 1024 * 1024, managedBytes: 256 * 1024 * 1024, visibleCharacters: 200_000, htmlBytes: 96 * 1024 * 1024 };
export const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
export const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);

export interface DisplayImage { uri: string; width: number; height: number }
export interface DisplayLink { label: string; url: string; host: string; qr?: string }
export interface DisplayComparison { id: string; title: string; before?: DisplayImage; after?: DisplayImage; number: string }
export type DisplayBlock =
  | { type: 'intro'; id: string; title: string; salutation?: string; names?: string; weddingDate?: string; deliveryDate?: string; projectNo?: string }
  | { type: 'text'; id: string; title: string; content: string }
  | { type: 'deliveries'; id: string; title: string; items: { id: string; title: string; description: string; format: string; accessNote: string; links: DisplayLink[] }[] }
  | { type: 'comparisons'; id: string; title: string; layout: ComparisonLayout; comparisons: DisplayComparison[] }
  | { type: 'signature'; id: string; title: string; photographer?: string; studio?: string };
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
  const textCount = visibleBlocks.reduce((count, block) => count + block.title.length + (block.type === 'text' ? block.content.length : block.type === 'deliveries' ? block.items.filter(item => item.visible).reduce((sum, item) => sum + item.title.length + item.description.length + item.accessNote.length, 0) : 0), 0);
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

  async function image(ref: AssetRef | null, blockId?: string, comparisonId?: string, logo = false): Promise<DisplayImage | undefined> {
    if (!ref) return undefined;
    if (budgetIssues.length) return undefined;
    const cacheKey = `${ref.assetId}:${ref.versionId}:${logo}`;
    if (images.has(cacheKey)) return images.get(cacheKey);
    try {
      const asset = project.assets.find(item => item.id === ref.assetId && item.projectId === project.id && item.tenantId === project.tenantId);
      const version = asset?.versions.find(item => item.id === ref.versionId);
      if (!version) throw new Error('图片引用不属于当前项目，或版本已经缺失');
      const resource = store.assetPath(project.id, ref.versionId);
      const bytes = await readFile(resource.path);
      const hash = digest(bytes);
      if (hash !== version.derivativeHash) throw new Error('管理副本的校验值与已保存版本不一致');
      const pipeline = sharp(bytes, { limitInputPixels: 80_000_000 }).rotate().toColourspace('srgb').resize({ width: logo ? 1000 : 2160, height: logo ? 1000 : 6400, fit: 'inside', withoutEnlargement: true });
      const rendered = await (logo ? pipeline.png() : pipeline.jpeg({ quality: 93, chromaSubsampling: '4:4:4' })).toBuffer({ resolveWithObject: true });
      const result = { uri: `data:image/${logo ? 'png' : 'jpeg'};base64,${rendered.data.toString('base64')}`, width: rendered.info.width, height: rendered.info.height };
      images.set(cacheKey, result);
      if (!dependencies.some(item => item.assetId === ref.assetId && item.versionId === ref.versionId)) dependencies.push({ ...ref, hash });
      if (!logo && version.width < 800) issues.push(makeIssue('LOW_RESOLUTION', '一张对比图宽度不足 800 像素，请检查手机阅读时的细节。', 'warning', 'all', { blockId, comparisonId, assetId: asset!.id }));
      return result;
    } catch (error) {
      issues.push(makeIssue('ASSET_UNAVAILABLE', `图片无法读取：${error instanceof Error ? error.message.replace(/(?:[A-Z]:\\|\/)[^\s，。]+/gi, '管理文件') : '请重新导入'}`, 'error', 'all', { blockId, comparisonId, assetId: ref.assetId }));
      images.set(cacheKey, undefined);
      return undefined;
    }
  }

  if (document.brand.logo) display.logo = await image(document.brand.logo, undefined, undefined, true);
  for (const block of ordered(document.blocks.filter(item => item.visible))) {
    if (!block.title.trim()) issues.push(makeIssue('BLOCK_TITLE_EMPTY', '一个可见章节尚未填写标题，请补充标题或隐藏该章节。', 'error', 'all', { blockId: block.id }));
    if (block.type === 'intro') {
      const intro: Extract<DisplayBlock, { type: 'intro' }> = { type: 'intro', id: block.id, title: block.title, salutation: shown(document.fields.salutation), names: shown(document.fields.coupleNames), weddingDate: shown(document.fields.weddingDate), deliveryDate: document.deliveryDate.visible ? date : undefined, projectNo: shown(document.fields.projectNo) };
      if (intro.names !== undefined && !intro.names) issues.push(makeIssue('NAMES_EMPTY', '请填写新人姓名，或明确关闭该字段的显示。', 'error', 'all', { blockId: block.id }));
      if (intro.weddingDate !== undefined && !intro.weddingDate) issues.push(makeIssue('WEDDING_DATE_EMPTY', '请填写婚礼日期，或关闭该字段的显示。', 'error', 'all', { blockId: block.id }));
      if (intro.deliveryDate !== undefined && !intro.deliveryDate) issues.push(makeIssue('DELIVERY_DATE_EMPTY', '请填写手动交付日期，或使用自动日期。', 'error', 'all', { blockId: block.id }));
      display.blocks.push(intro);
    } else if (block.type === 'text') {
      if (!block.content.trim()) issues.push(makeIssue('TEXT_EMPTY', `“${block.title || '文案章节'}”尚未填写内容，请补充或隐藏。`, 'error', 'all', { blockId: block.id }));
      display.blocks.push({ type: 'text', id: block.id, title: block.title, content: block.content });
    } else if (block.type === 'signature') {
      display.blocks.push({ type: 'signature', id: block.id, title: block.title, photographer: shown(document.fields.photographerName), studio: shown(document.fields.studioName) });
    } else if (block.type === 'deliveries') {
      const items: Extract<DisplayBlock, { type: 'deliveries' }>['items'] = [];
      for (const item of ordered(block.items.filter(value => value.visible))) {
        if (!item.title.trim()) issues.push(makeIssue('ITEM_TITLE_EMPTY', '一个可见交付条目尚未填写名称，请补充或隐藏。', 'error', 'all', { blockId: block.id }));
        const links: DisplayLink[] = [];
        for (const [value, label] of [[item.playbackUrl, '观看影片'], [item.downloadUrl, '下载与保存']] as const) {
          const checked = safeDeliveryUrl(value);
          if (checked.error) issues.push(makeIssue('LINK_INVALID', `${item.title || '交付内容'}：${checked.error}`, 'error', 'all', { blockId: block.id }));
          if (!checked.url) continue;
          const link: DisplayLink = { label, url: checked.url.href, host: checked.url.hostname };
          try {
            const qr = QRCode.create(link.url, { errorCorrectionLevel: 'M' });
            if (qr.modules.size > 77) throw new Error('链接过长');
            link.qr = await QRCode.toDataURL(link.url, { width: 600, margin: 4, errorCorrectionLevel: 'M', color: { dark: '#181818', light: '#ffffff' } });
          } catch { issues.push(makeIssue('QR_UNREADABLE', `${item.title || '交付内容'}的链接过长，无法生成适合手机识别的二维码。请使用更短的稳定分享链接。`, 'error', 'image', { blockId: block.id })); }
          links.push(link);
        }
        if (item.method === 'link' && !links.length && !item.playbackUrl.trim() && !item.downloadUrl.trim()) issues.push(makeIssue('LINK_MISSING', `${item.title || '交付内容'}选择了链接交付，但尚未填写观看或下载地址。`, 'error', 'all', { blockId: block.id }));
        if (item.method === 'attachment') issues.push(makeIssue('ATTACHMENT_UNSUPPORTED', `${item.title || '交付内容'}使用附件交付，本版尚未绑定附件；请改用链接或在说明中明确线下交接。`, 'error', 'all', { blockId: block.id }));
        items.push({ id: item.id, title: item.title, description: item.description, format: item.format, accessNote: item.accessNote, links });
      }
      if (!items.length) issues.push(makeIssue('DELIVERIES_EMPTY', `“${block.title || '交付清单'}”没有可见交付内容，请添加条目或隐藏该章节。`, 'error', 'all', { blockId: block.id }));
      display.blocks.push({ type: 'deliveries', id: block.id, title: block.title, items });
    } else if (block.type === 'comparisons') {
      const layout = block.layout === 'inherit' ? document.comparisonLayout : block.layout;
      if (!['split', 'stacked'].includes(layout)) issues.push(makeIssue('LAYOUT_UNSUPPORTED', '对比模块的布局不受支持，请选择上下或左右排列。', 'error', 'all', { blockId: block.id }));
      const comparisons: DisplayComparison[] = [];
      for (const [index, comparison] of ordered(block.comparisons.filter(item => item.visible)).entries()) {
        if (!comparison.before || !comparison.after) issues.push(makeIssue('COMPARISON_INCOMPLETE', `${comparison.title || `对比 ${index + 1}`}缺少 Before 或 After，请补图或隐藏该组。`, 'error', 'all', { blockId: block.id, comparisonId: comparison.id }));
        const before = await image(comparison.before, block.id, comparison.id);
        const after = await image(comparison.after, block.id, comparison.id);
        if (before && after && Math.abs(before.width / before.height - after.width / after.height) > 0.05) issues.push(makeIssue('ASPECT_RATIO_MISMATCH', `${comparison.title || `对比 ${index + 1}`}的前后图片比例不同，将保留完整画面，请确认是否可比。`, 'warning', 'all', { blockId: block.id, comparisonId: comparison.id }));
        if (comparison.before && comparison.after && comparison.before.versionId === comparison.after.versionId) issues.push(makeIssue('IDENTICAL_COMPARISON', `${comparison.title || `对比 ${index + 1}`}使用同一张图片作为 Before 和 After，请确认。`, 'warning', 'all', { blockId: block.id, comparisonId: comparison.id }));
        comparisons.push({ id: comparison.id, title: comparison.title, number: String(index + 1).padStart(2, '0'), before, after });
      }
      if (!comparisons.length) issues.push(makeIssue('COMPARISONS_EMPTY', `“${block.title || '调色对比'}”尚无可见对比组，请导入图片、添加对比或隐藏该章节。`, 'error', 'all', { blockId: block.id }));
      display.blocks.push({ type: 'comparisons', id: block.id, title: block.title, layout, comparisons });
    }
  }
  if (!display.blocks.length) issues.push(makeIssue('DOCUMENT_EMPTY', '没有可见的交付章节，请至少显示一个模块。'));
  if (display.blocks.some(block => block.type === 'deliveries' && block.items.some(item => item.links.length))) issues.push(makeIssue('LINKS_UNVERIFIED', '交付链接未自动访问，请确认客户拥有访问权限；长图二维码需在实际发送后检查识别效果。', 'warning'));
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

export async function loadFonts(rootDir: string, embed = true): Promise<FontBundle> {
  const hashes: Record<string, string> = {};
  const issues: Issue[] = [];
  const styles: string[] = [];
  for (const [filename, family] of [['NotoSansSC.ttf', 'Studio Sans'], ['SourceSerif4.ttf', 'Studio Serif']]) {
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
