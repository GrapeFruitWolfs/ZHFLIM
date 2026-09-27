import sharp, { type OutputInfo } from 'sharp';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { newId, type Asset, type AssetVersion, type ImportObservation, type ImportReport, type ProjectRecord, type RecognitionRule } from '../shared/model.js';
import { normalizeRelativePath } from '../domain/validation.js';
import { createImportReport, reconcileComparisons, reorientAutomaticComparisons, selectDocumentImages, supportedImage } from '../domain/recognition.js';
import { StudioError } from '../domain/errors.js';
import type { SqliteStudioStore } from './store.js';

export const MAX_IMAGE_BYTES = 40 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 40_000_000;
interface ImportRun { projectId: string; rootId: string; observations: ImportObservation[]; imagePaths: string[]; reportId: string; processedPaths: string[]; finalized: boolean }
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
let processing = Promise.resolve();
async function serializeImage<T>(operation: () => Promise<T>): Promise<T> {
  const previous = processing;
  let release!: () => void;
  processing = new Promise<void>(resolve => { release = resolve; });
  await previous;
  try { return await operation(); } finally { release(); }
}
function runKey(projectId: string, rootId: string) { return `${projectId}:${rootId}`; }
function currentRun(store: SqliteStudioStore, projectId: string, rootId: string): ImportRun {
  const run = store.getRecord<ImportRun>('import-run', runKey(projectId, rootId));
  if (!run || run.projectId !== projectId || run.rootId !== rootId) throw new StudioError('IMPORT_NOT_FOUND', '请先扫描或选择素材来源文件夹。', 404);
  return run;
}
function getReport(project: ProjectRecord, run: ImportRun): ImportReport {
  const report = project.importReports.find(item => item.id === run.reportId);
  if (!report) throw new StudioError('IMPORT_NOT_FOUND', '导入报告不存在，请重新开始导入。', 409);
  return report;
}
function limitIssues(report: ImportReport) {
  if (report.issues.length > 2000) {
    const total = report.issues.length;
    report.issues = report.issues.slice(0, 1999);
    report.issues.push({ code: 'ISSUES_TRUNCATED', message: `共发现 ${total} 个问题，当前显示前 1999 个。请分批导入并处理问题。`, paths: [] });
  }
}
export function beginImport(store: SqliteStudioStore, projectId: string, input: { rootId?: string; label: string; rule: RecognitionRule; files: ImportObservation[]; includeUnclassifiedImages?: boolean }) {
  const project = store.getProject(projectId);
  const rootId = input.rootId || newId();
  let root = project.importRoots.find(item => item.id === rootId);
  if (input.rootId && !root) throw new StudioError('IMPORT_ROOT', '指定的素材来源不属于本项目。', 404);
  const reoriented = root ? reorientAutomaticComparisons(project, rootId, root.rule, input.rule) : 0;
  if (!root) { root = { id: rootId, label: input.label || '项目素材', rule: input.rule, createdAt: new Date().toISOString() }; project.importRoots.push(root); }
  else { root.label = input.label || root.label; root.rule = input.rule; }
  const seen = new Set<string>();
  const observations: ImportObservation[] = [];
  const report = createImportReport(rootId, input.files);
  if (reoriented) report.issues.push({ code: 'PAIR_DIRECTION_UPDATED', message: `已按新的识别顺序调整 ${reoriented} 组自动配对；人工修正的关系和已选图片版本保持不变。请预览确认方向。`, paths: [] });
  for (const file of input.files) {
    const key = file.relativePath.toLowerCase();
    if (seen.has(key)) report.issues.push({ code: 'DUPLICATE_PATH', message: '来源索引有重复或大小写冲突的路径，已保留第一条，请核对目录。', paths: [file.relativePath] });
    else { seen.add(key); observations.push(file); }
  }
  const missingPaths = project.assets.filter(asset => asset.rootId === rootId && !seen.has(asset.relativePath.toLowerCase())).map(asset => asset.relativePath);
  if (missingPaths.length) report.issues.push({ code: 'SOURCE_MISSING', message: `本次所选目录未发现 ${missingPaths.length} 张此前导入的来源图片。已保留文档配对与管理副本，请核对是否选对来源目录或移动过文件。`, paths: missingPaths.slice(0, 100) });
  const selection = selectDocumentImages(rootId, root.label, observations, root.rule, input.includeUnclassifiedImages);
  if (selection.unclassifiedImagePaths.length) report.issues.push({ code: 'UNCLASSIFIED_IMAGES_SKIPPED', message: `${selection.unclassifiedImagePaths.length} 张其他图片仅建立目录索引，未复制到文档库；需要时可明确选择导入。`, paths: selection.unclassifiedImagePaths.slice(0, 20) });
  project.importReports.push(report);
  if (project.importReports.length > 100) project.importReports.splice(0, project.importReports.length - 100);
  const selected = new Set(selection.imagePaths);
  reconcileComparisons(project, rootId, observations.filter(item => selected.has(item.relativePath)), report);
  limitIssues(report);
  const run: ImportRun = { projectId, rootId, observations, imagePaths: selection.imagePaths, reportId: report.id, processedPaths: [], finalized: false };
  const saved = store.saveProjectWithRecord(project, project.draftRevision, 'import-run', runKey(projectId, rootId), run);
  return { project: saved, rootId, report, ...selection };
}
async function writeImmutable(path: string, bytes: Buffer) {
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.${newId()}.tmp`;
  await writeFile(temp, bytes, { flag: 'wx' });
  await rename(temp, path);
}
function recordFailure(store: SqliteStudioStore, projectId: string, rootId: string, reportId: string, relativePath: string, message: string) {
  const project = store.getProject(projectId);
  const run = currentRun(store, projectId, rootId);
  if (run.reportId !== reportId || run.finalized) return;
  const report = getReport(project, run);
  report.issues = report.issues.filter(issue => !(issue.code === 'IMAGE_IMPORT_FAILED' && issue.paths.includes(relativePath)));
  report.issues.push({ code: 'IMAGE_IMPORT_FAILED', message, paths: [relativePath] });
  limitIssues(report);
  store.saveProject(project, project.draftRevision);
}
export async function importImage(store: SqliteStudioStore, projectId: string, rootId: string, relativeInput: string, bytes: Buffer, importId?: string) {
  const relativePath = normalizeRelativePath(relativeInput);
  store.getProject(projectId);
  const requestedRun = currentRun(store, projectId, rootId);
  if (requestedRun.finalized || (importId && importId !== requestedRun.reportId)) throw new StudioError('IMPORT_FINISHED', '本次导入已结束或已被新的扫描替换，请重新开始。', 409);
  const reportId = requestedRun.reportId;
  return serializeImage(async () => {
    try {
      if (!supportedImage(relativePath)) throw new StudioError('UNSUPPORTED_IMAGE', '目前仅支持 JPEG 和 PNG 文档图片。', 415);
      if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new StudioError('IMAGE_TOO_LARGE', '图片为空或超过 40 MiB，请缩小文档用图后重试。', 413);
      const authorizedRun = currentRun(store, projectId, rootId);
      if (authorizedRun.finalized || authorizedRun.reportId !== reportId) throw new StudioError('IMPORT_FINISHED', '本次导入已结束或已被新的扫描替换，请重新开始。', 409);
      if (!authorizedRun.observations.some(item => item.relativePath.toLowerCase() === relativePath.toLowerCase())) throw new StudioError('FILE_NOT_SCANNED', '这张图片不在本次授权的导入索引中。', 400);
      if (!authorizedRun.imagePaths.some(path => path.toLowerCase() === relativePath.toLowerCase())) throw new StudioError('FILE_NOT_SELECTED', '这张图片目前仅建立索引，请明确选择导入后再上传。', 400);
      const metadata = await sharp(bytes, { limitInputPixels: MAX_IMAGE_PIXELS, failOn: 'warning', animated: false }).metadata();
      if (!['jpeg', 'png'].includes(metadata.format ?? '') || (metadata.pages ?? 1) > 1) throw new StudioError('UNSUPPORTED_IMAGE', '图片实际格式必须是单帧 JPEG 或 PNG。', 415);
      const contentHash = hash(bytes);
      let project = store.getProject(projectId);
      let run = currentRun(store, projectId, rootId);
      if (run.finalized || run.reportId !== authorizedRun.reportId) throw new StudioError('IMPORT_FINISHED', '本次导入已结束或已被新的扫描替换，请重新开始。', 409);
      let asset = project.assets.find(item => item.rootId === rootId && item.relativePath.toLowerCase() === relativePath.toLowerCase());
      let sameVersion = asset?.versions.find(item => item.hash === contentHash);
      let normalized: { data: Buffer; info: OutputInfo } | undefined;
      let recovered = false;
      const normalize = async () => normalized ??= await sharp(bytes, { limitInputPixels: MAX_IMAGE_PIXELS, failOn: 'warning' }).rotate().toColourspace('srgb').png().toBuffer({ resolveWithObject: true });
      if (sameVersion) {
        const originalCopy = await readFile(store.storagePath(sameVersion.originalStorageKey)).catch(() => null);
        const managedCopy = await readFile(store.storagePath(sameVersion.storageKey)).catch(() => null);
        const originalValid = originalCopy && hash(originalCopy) === sameVersion.hash;
        const managedValid = managedCopy && hash(managedCopy) === sameVersion.derivativeHash;
        if (!originalValid || !managedValid) {
          const rebuilt = await normalize();
          if (hash(rebuilt.data) === sameVersion.derivativeHash) {
            if (!originalValid) await writeImmutable(store.storagePath(sameVersion.originalStorageKey), bytes);
            if (!managedValid) await writeImmutable(store.storagePath(sameVersion.storageKey), rebuilt.data);
            recovered = true;
          } else sameVersion = undefined; // A changed image processor must not rewrite historical version bytes.
        }
        project = store.getProject(projectId); run = currentRun(store, projectId, rootId);
        if (run.finalized || run.reportId !== authorizedRun.reportId) throw new StudioError('IMPORT_FINISHED', '本次导入已结束或已被新的扫描替换，请重新开始。', 409);
        asset = project.assets.find(item => item.id === asset!.id);
      }
      const wasReused = !!sameVersion;
      let version: AssetVersion;
      if (sameVersion) version = sameVersion;
      else {
        const normalized = await normalize();
        const assetId = asset?.id ?? newId();
        const versionId = newId();
        const prefix = `assets/${projectId}/${assetId}/${versionId}`;
        version = { id: versionId, hash: contentHash, filename: relativePath.split('/').pop()!, width: normalized.info.width, height: normalized.info.height, mime: metadata.format === 'jpeg' ? 'image/jpeg' : 'image/png', byteSize: bytes.length, storageKey: `${prefix}.png`, originalStorageKey: `${prefix}.original`, derivativeHash: hash(normalized.data), createdAt: new Date().toISOString() };
        await writeImmutable(store.storagePath(version.originalStorageKey), bytes);
        await writeImmutable(store.storagePath(version.storageKey), normalized.data);
        // Read again after asynchronous I/O so concurrent text edits are preserved.
        project = store.getProject(projectId);
        run = currentRun(store, projectId, rootId);
        if (run.finalized || run.reportId !== authorizedRun.reportId) throw new StudioError('IMPORT_FINISHED', '本次导入已结束或已被新的扫描替换，请重新开始。', 409);
        asset = project.assets.find(item => item.id === assetId);
        if (!asset) { asset = { id: assetId, tenantId: project.tenantId, projectId, rootId, relativePath, versions: [], latestVersionId: version.id }; project.assets.push(asset); }
        asset.versions.push(version);
      }
      asset = project.assets.find(item => item.id === asset!.id)!;
      const changed = asset.latestVersionId !== version.id || asset.versions.length > 1 && !wasReused;
      asset.latestVersionId = version.id;
      const report = getReport(project, run);
      if (!run.processedPaths.includes(relativePath.toLowerCase())) {
        report[wasReused ? 'reused' : 'imported']++;
        run.processedPaths.push(relativePath.toLowerCase());
      }
      report.issues = report.issues.filter(issue => !(issue.code === 'IMAGE_IMPORT_FAILED' && issue.paths.includes(relativePath)));
      if (recovered) report.issues.push({ code: 'ASSET_RECOVERED', message: '已从重新导入的原图恢复缺失或损坏的管理副本，并通过版本校验。', paths: [relativePath] });
      if (changed && !report.issues.some(issue => issue.code === 'SOURCE_UPDATED' && issue.paths.includes(relativePath))) report.issues.push({ code: 'SOURCE_UPDATED', message: '发现源图片更新。当前文档继续使用原版本，请查看新图后选择是否采用。', paths: [relativePath] });
      const selected = new Set(run.imagePaths);
      reconcileComparisons(project, rootId, run.observations.filter(item => selected.has(item.relativePath)), report);
      limitIssues(report);
      const saved = store.saveProjectWithRecord(project, project.draftRevision, 'import-run', runKey(projectId, rootId), run);
      return { project: saved, asset: saved.assets.find(item => item.id === asset!.id)!, report };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException | undefined)?.code;
      const storageFailure = !!code && (code.startsWith('ERR_SQLITE') || ['ENOSPC', 'EDQUOT', 'EACCES', 'EPERM', 'EROFS', 'EIO', 'EMFILE', 'ENFILE', 'ENOENT'].includes(code));
      const failure = error instanceof StudioError ? error : storageFailure
        ? new StudioError('STORAGE_WRITE_FAILED', '图片保存失败，请检查数据目录的可写权限、磁盘空间或存储状态后重试。已登记的图片与版本保持不变。', 500)
        : new StudioError('IMAGE_DECODE_FAILED', '图片读取失败、像素超过 4000 万或文件损坏，请换用 JPEG／PNG 导出图。', 422);
      if (!['IMPORT_FINISHED', 'FILE_NOT_SCANNED', 'FILE_NOT_SELECTED'].includes(failure.code)) recordFailure(store, projectId, rootId, reportId, relativePath, failure.message);
      throw failure;
    }
  });
}
export function finalizeImport(store: SqliteStudioStore, projectId: string, rootId: string, cancelled = false, importId?: string) {
  const project = store.getProject(projectId);
  const run = currentRun(store, projectId, rootId);
  if (importId && importId !== run.reportId) throw new StudioError('IMPORT_FINISHED', '本次导入已被新的扫描替换，不能结束另一批导入。', 409);
  const report = getReport(project, run);
  if (run.finalized) return { project, report };
  report.cancelled = cancelled;
  run.finalized = true;
  const processed = new Set(run.processedPaths);
  const unfinished = run.imagePaths.filter(path => !processed.has(path.toLowerCase()));
  if (unfinished.length) report.issues.push({ code: 'IMPORT_INCOMPLETE', message: `${unfinished.length} 张已选图片尚未完成本次导入或内容校验，请重新选择同一来源重试。此前已保存的图片仍然保留。`, paths: unfinished.slice(0, 100) });
  const selected = new Set(run.imagePaths);
  reconcileComparisons(project, rootId, run.observations.filter(item => selected.has(item.relativePath)), report);
  limitIssues(report);
  const saved = store.saveProjectWithRecord(project, project.draftRevision, 'import-run', runKey(projectId, rootId), run);
  return { project: saved, report };
}
export function acceptAssetVersion(store: SqliteStudioStore, projectId: string, assetId: string, versionId: string, expectedRevision: number) {
  const project = store.getProject(projectId);
  const asset = project.assets.find(item => item.id === assetId);
  if (!asset?.versions.some(item => item.id === versionId)) throw new StudioError('ASSET_VERSION', '图片版本不存在或不属于本项目。', 404);
  for (const block of project.document.blocks) if (block.type === 'comparisons') for (const comparison of block.comparisons) {
    for (const slot of ['before', 'after'] as const) if (comparison[slot]?.assetId === assetId) comparison[slot] = { assetId, versionId };
  }
  if (project.document.brand.logo?.assetId === assetId) project.document.brand.logo = { assetId, versionId };
  return store.saveProject(project, expectedRevision);
}
