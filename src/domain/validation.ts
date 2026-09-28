import { z } from 'zod';
import type { ImportObservation, ProjectRecord, StudioSettings } from '../shared/model.js';
import { TEMPLATE_IDS } from '../shared/templates.js';
import { StudioError } from './errors.js';

const id = z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/);
const text = z.string().max(40000);
const order = z.number().int().min(0).max(1000000);
const short = z.string().max(2000);
const visibleText = z.object({ value: short, visible: z.boolean() }).strict();
const date = z.string().refine(value => value === '' || (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value), '日期格式应为有效的 YYYY-MM-DD');
const url = z.string().max(6000).refine(value => {
  if (!value) return true;
  try { const parsed = new URL(value); return ['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password; } catch { return false; }
}, '链接必须是 HTTP 或 HTTPS 地址，且不能包含账户密码');
const ref = z.object({ assetId: id, versionId: id }).strict();
const comparison = z.object({ id, title: short, description: short.optional(), order, visible: z.boolean(), before: ref.nullable(), after: ref.nullable(), sourceKey: z.string().max(3000).optional(), locked: z.boolean() }).strict();
const item = z.object({ id, title: short, description: text, format: short, method: z.enum(['link', 'attachment', 'offline', 'description']), downloadUrl: url, playbackUrl: url, accessNote: short, visible: z.boolean(), order }).strict();
const base = { id, title: short, visible: z.boolean(), order };
const block = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('intro'), cover: z.object({ emphasis: z.enum(['names', 'photo']), headline: z.string().max(120), message: z.string().max(600), image: ref.nullable() }).strict().optional() }).strict(),
  z.object({ ...base, type: z.literal('deliveries'), items: z.array(item).max(300) }).strict(),
  z.object({ ...base, type: z.literal('text'), content: text, sourceDefinitionId: id.optional(), details: z.object({ content: text, image: ref.nullable(), caption: short, placement: z.enum(['inline', 'appendix', 'hidden']) }).strict().optional() }).strict(),
  z.object({ ...base, type: z.literal('comparisons'), layout: z.enum(['stacked', 'split', 'inherit']), comparisons: z.array(comparison).max(2000) }).strict(),
  z.object({ ...base, type: z.literal('signature') }).strict(),
]);
const version = z.object({ id, hash: z.string().regex(/^[a-f0-9]{64}$/), filename: short, width: z.number().int().positive(), height: z.number().int().positive(), mime: z.enum(['image/jpeg', 'image/png']), byteSize: z.number().int().positive(), storageKey: z.string().min(1).max(500), createdAt: z.string().datetime(), derivativeHash: z.string().regex(/^[a-f0-9]{64}$/), originalStorageKey: z.string().min(1).max(500) }).strict();
const root = z.object({ id, label: short, rule: z.enum(['after-first', 'before-first', 'words', 'manual']), createdAt: z.string().datetime() }).strict();
const report = z.object({ id, rootId: id, createdAt: z.string().datetime(), scanned: order, images: order, videos: order, audio: order, other: order, imported: order, reused: order, paired: order, incomplete: order, issues: z.array(z.object({ code: short, message: short, paths: z.array(short).max(5000), sourceKey: z.string().max(3000).optional() }).strict()).max(20000), cancelled: z.boolean() }).strict();
export const projectSchema = z.object({
  schemaVersion: z.literal(1), id, tenantId: id, clientId: id, title: z.string().trim().min(1).max(200), projectNo: short, internalNotes: text,
  draftRevision: z.number().int().nonnegative(), archived: z.boolean(), createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
  document: z.object({ id,
    fields: z.object({ salutation: visibleText, coupleNames: visibleText, weddingDate: z.object({ value: date, visible: z.boolean() }).strict(), studioName: visibleText, photographerName: visibleText, projectNo: visibleText }).strict(),
    deliveryDate: z.object({ mode: z.enum(['auto', 'manual']), manualDate: date, visible: z.boolean() }).strict(),
    brand: z.object({ tagline: short, accent: z.string().regex(/^#[0-9a-fA-F]{6}$/), logo: ref.nullable() }).strict(),
    templateId: z.enum(TEMPLATE_IDS), templateVersion: z.number().int().positive(), comparisonLayout: z.enum(['stacked', 'split']), blocks: z.array(block).max(200),
    output: z.object({ mode: z.enum(['pdf', 'image', 'both']), imageWidth: z.number().int().min(600).max(2160), segmentHeight: z.number().int().min(1000).max(30000), allowImageSegments: z.boolean(), allowComparisonPageBreak: z.boolean() }).strict(),
  }).strict(),
  assets: z.array(z.object({ id, tenantId: id, projectId: id, rootId: id, relativePath: z.string().max(2000), versions: z.array(version).min(1).max(1000), latestVersionId: id }).strict()).max(10000),
  importRoots: z.array(root).max(200), excludedSourceKeys: z.array(z.string().max(3000)).max(20000), importReports: z.array(report).max(500),
}).strict();

export const settingsSchema = z.object({ tenantId: id, studioName: short, photographerName: short, tagline: short, accent: z.string().regex(/^#[0-9a-fA-F]{6}$/), timezone: z.string().max(100).refine(value => { try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; } }, '工作室时区无效') }).strict();
export const observationsSchema = z.array(z.object({ relativePath: z.string().min(1).max(2000), size: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), type: z.string().max(200), lastModified: z.number().nonnegative().finite() }).strict()).max(100000);
export const recognitionRuleSchema = z.enum(['after-first', 'before-first', 'words', 'manual']);

export function normalizeRelativePath(value: string): string {
  const normalized = value.replaceAll('\\', '/');
  if (!normalized || normalized.length > 2000 || /[\u0000-\u001f:]/.test(normalized) || normalized.startsWith('/') || normalized.split('/').some(part => !part || part === '.' || part === '..')) throw new StudioError('INVALID_PATH', '素材路径必须是文件夹内的相对路径，不能包含路径跳转。');
  return normalized;
}
export function parseObservations(value: unknown): ImportObservation[] {
  return observationsSchema.parse(value).map(file => ({ ...file, relativePath: normalizeRelativePath(file.relativePath) }));
}
export function parseSettings(value: unknown): StudioSettings { return settingsSchema.parse(value); }
export function validateProject(value: unknown, tenantId: string): ProjectRecord {
  const project = projectSchema.parse(value) as ProjectRecord;
  if (project.tenantId !== tenantId) throw new StudioError('TENANT_MISMATCH', '项目不属于当前工作区。', 403);
  const ids = new Set<string>();
  const take = (value: string) => { if (ids.has(value)) throw new StudioError('DUPLICATE_ID', '项目包含重复的对象 ID。'); ids.add(value); };
  take(project.id); take(project.document.id);
  const roots = new Set(project.importRoots.map(item => { take(item.id); return item.id; }));
  const versions = new Map<string, Set<string>>();
  for (const asset of project.assets) {
    take(asset.id);
    if (asset.tenantId !== tenantId || asset.projectId !== project.id || !roots.has(asset.rootId)) throw new StudioError('ASSET_OWNERSHIP', '素材归属或来源不匹配。');
    normalizeRelativePath(asset.relativePath);
    const owned = new Set(asset.versions.map(version => { take(version.id); return version.id; }));
    if (!owned.has(asset.latestVersionId)) throw new StudioError('ASSET_VERSION', '素材最新版本不存在。');
    versions.set(asset.id, owned);
  }
  const checkRef = (reference: { assetId: string; versionId: string } | null) => { if (reference && !versions.get(reference.assetId)?.has(reference.versionId)) throw new StudioError('INVALID_ASSET_REF', '图片引用不属于本项目或版本不存在。'); };
  checkRef(project.document.brand.logo);
  for (const block of project.document.blocks) {
    take(block.id);
    if (block.type === 'intro' && block.cover) checkRef(block.cover.image);
    if (block.type === 'text' && block.details) checkRef(block.details.image);
    if (block.type === 'deliveries') block.items.forEach(item => take(item.id));
    if (block.type === 'comparisons') block.comparisons.forEach(item => { take(item.id); checkRef(item.before); checkRef(item.after); });
  }
  for (const report of project.importReports) if (!roots.has(report.rootId)) throw new StudioError('IMPORT_ROOT', '导入报告来源不存在。');
  return project;
}
