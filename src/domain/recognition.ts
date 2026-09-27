import { newId, type Asset, type Comparison, type ComparisonBlock, type ImportIssue, type ImportObservation, type ImportReport, type ProjectRecord, type RecognitionRule } from '../shared/model.js';
import { normalizeRelativePath } from './validation.js';

export interface RecognitionMatch { sourceKey: string; role: 'before' | 'after'; label: string }
export function recognizePath(rootId: string, input: string, rule: RecognitionRule): RecognitionMatch | null {
  if (rule === 'manual') return null;
  const path = normalizeRelativePath(input);
  const slash = path.lastIndexOf('/');
  const directory = slash >= 0 ? path.slice(0, slash + 1) : '';
  const filename = path.slice(slash + 1);
  const stem = filename.replace(/\.[^.]+$/, '');
  let label: string;
  let role: 'before' | 'after';
  if (rule === 'words') {
    const suffix = /^(.*?)[_\s-]+(before|after)$/i.exec(stem);
    const prefix = /^(before|after)[_\s-]+(.+)$/i.exec(stem);
    if (suffix) { label = suffix[1]; role = suffix[2].toLowerCase() as typeof role; }
    else if (prefix) { label = prefix[2]; role = prefix[1].toLowerCase() as typeof role; }
    else return null;
    if (/(?:^|[_\s-])(before|after)(?:$|[_\s-])/i.test(label)) return null;
  } else {
    const match = /^(.*?)[_\s-]([12])$/.exec(stem);
    if (!match || !match[1]) return null;
    label = match[1];
    role = (match[2] === '1') === (rule === 'after-first') ? 'after' : 'before';
  }
  return { sourceKey: `${rootId}:${directory.toLowerCase()}${label.toLowerCase()}`, role, label };
}
export function observationKind(file: ImportObservation): 'images' | 'videos' | 'audio' | 'other' {
  const extension = file.relativePath.split('.').pop()?.toLowerCase() ?? '';
  if (['jpg', 'jpeg', 'png', 'heic', 'heif', 'tif', 'tiff', 'webp', 'raw', 'cr2', 'cr3', 'arw', 'nef', 'dng'].includes(extension) || file.type.startsWith('image/')) return 'images';
  if (['mp4', 'mov', 'mxf', 'avi', 'mkv', 'mts', 'm2ts'].includes(extension) || file.type.startsWith('video/')) return 'videos';
  if (['wav', 'mp3', 'aac', 'm4a', 'flac', 'aiff'].includes(extension) || file.type.startsWith('audio/')) return 'audio';
  return 'other';
}
export function supportedImage(path: string) { return /\.(jpe?g|png)$/i.test(path); }
export function selectDocumentImages(rootId: string, label: string, observations: ImportObservation[], rule: RecognitionRule, includeUnclassified = false) {
  const imagePaths: string[] = []; const unclassifiedImagePaths: string[] = [];
  for (const file of observations) {
    if (!supportedImage(file.relativePath)) continue;
    const inComparisonDirectory = /(?:^|\/)[^/]*(?:调色|对比|comparisons?|before[-_ ]?after)[^/]*\//i.test(`${label}/${file.relativePath}`);
    if (includeUnclassified || recognizePath(rootId, file.relativePath, rule) || inComparisonDirectory) imagePaths.push(file.relativePath);
    else unclassifiedImagePaths.push(file.relativePath);
  }
  return { imagePaths, unclassifiedImagePaths };
}
export function createImportReport(rootId: string, observations: ImportObservation[]): ImportReport {
  const report: ImportReport = { id: newId(), rootId, createdAt: new Date().toISOString(), scanned: observations.length, images: 0, videos: 0, audio: 0, other: 0, imported: 0, reused: 0, paired: 0, incomplete: 0, issues: [], cancelled: false };
  for (const observation of observations) {
    const kind = observationKind(observation); report[kind]++;
    if (kind === 'images' && !supportedImage(observation.relativePath)) report.issues.push({ code: 'UNSUPPORTED_IMAGE', message: '此图片格式暂不支持，请转换为 JPEG 或 PNG。', paths: [observation.relativePath] });
  }
  return report;
}

export function reconcileComparisons(project: ProjectRecord, rootId: string, observations: ImportObservation[], report: ImportReport): void {
  const root = project.importRoots.find(item => item.id === rootId);
  if (!root) return;
  const temporaryIssues = new Set(['PAIR_CONFLICT', 'PAIR_INCOMPLETE', 'UNRECOGNIZED_IMAGE', 'IMAGE_NOT_IMPORTED']);
  report.issues = report.issues.filter(item => !temporaryIssues.has(item.code));
  const assets = new Map(project.assets.filter(asset => asset.rootId === rootId).map(asset => [asset.relativePath.toLowerCase(), asset]));
  const groups = new Map<string, { label: string; before: string[]; after: string[] }>();
  const excluded = new Set(project.excludedSourceKeys);
  for (const observation of observations) {
    if (!supportedImage(observation.relativePath)) continue;
    const match = recognizePath(rootId, observation.relativePath, root.rule);
    if (!match) {
      if (root.rule !== 'manual') report.issues.push({ code: 'UNRECOGNIZED_IMAGE', message: '无法按当前规则识别前后关系，可手工拖图配对。', paths: [observation.relativePath] });
      continue;
    }
    if (excluded.has(match.sourceKey) || excluded.has(`file:${rootId}:${observation.relativePath.toLowerCase()}`)) continue;
    const group = groups.get(match.sourceKey) ?? { label: match.label, before: [], after: [] };
    group[match.role].push(observation.relativePath);
    groups.set(match.sourceKey, group);
  }
  const comparisons = project.document.blocks.flatMap(block => block.type === 'comparisons' ? block.comparisons : []);
  const bySourceKey = new Map(comparisons.filter(item => item.sourceKey).map(item => [item.sourceKey!, item]));
  const manuallyUsedAssets = new Set(comparisons.filter(item => item.locked).flatMap(item => [item.before?.assetId, item.after?.assetId]).filter((id): id is string => !!id));
  report.paired = 0; report.incomplete = 0;
  for (const [sourceKey, group] of groups) {
    let current = bySourceKey.get(sourceKey);
    if (current?.locked) {
      if (current.before && current.after) report.paired++;
      else { report.incomplete++; report.issues.push({ code: 'PAIR_INCOMPLETE', message: '保留了人工配对；这组仍缺少一侧图片，可继续手工补齐。', paths: [...group.before, ...group.after], sourceKey }); }
      continue;
    }
    if (group.before.length > 1 || group.after.length > 1) {
      report.issues.push({ code: 'PAIR_CONFLICT', message: '同一组存在多个 Before 或 After 候选，请人工选择。', paths: [...group.before, ...group.after], sourceKey });
      report.incomplete++;
      continue;
    }
    const before = group.before[0] ? assets.get(group.before[0].toLowerCase()) : undefined;
    const after = group.after[0] ? assets.get(group.after[0].toLowerCase()) : undefined;
    // Do not resurrect a group when its assets already belong to a manual pairing.
    const usedManually = (before && manuallyUsedAssets.has(before.id)) || (after && manuallyUsedAssets.has(after.id));
    if (usedManually) continue;
    if (!current && (before || after)) {
      let block = project.document.blocks.find((item): item is ComparisonBlock => item.type === 'comparisons');
      if (!block) {
        block = { id: newId(), type: 'comparisons', title: '调色前后对比', visible: true, order: project.document.blocks.length, layout: 'inherit', comparisons: [] };
        const orderedBlocks = [...project.document.blocks].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
        const signatureIndex = orderedBlocks.findIndex(item => item.type === 'signature');
        orderedBlocks.splice(signatureIndex < 0 ? orderedBlocks.length : signatureIndex, 0, block);
        orderedBlocks.forEach((item, order) => { item.order = order; });
        project.document.blocks = orderedBlocks;
      }
      current = { id: newId(), title: `Comparison ${group.label}`, order: block.comparisons.length, visible: true, before: null, after: null, sourceKey, locked: false };
      block.comparisons.push(current);
      bySourceKey.set(sourceKey, current);
    }
    const reference = (asset: Asset) => ({ assetId: asset.id, versionId: asset.latestVersionId });
    if (current) {
      if (!current.before && before) current.before = reference(before);
      if (!current.after && after) current.after = reference(after);
    }
    if (current?.before && current.after) report.paired++;
    else {
      report.incomplete++;
      const paths = [...group.before, ...group.after];
      const uploadMissing = (!!group.before[0] && !before) || (!!group.after[0] && !after);
      report.issues.push({ code: uploadMissing ? 'IMAGE_NOT_IMPORTED' : 'PAIR_INCOMPLETE', message: uploadMissing ? '发现了图片但尚未完成导入，请检查失败记录或重新导入。' : `这组缺少 ${!group.before.length ? 'Before' : 'After'} 图片。`, paths, sourceKey });
    }
  }
}

export function reorientAutomaticComparisons(project: ProjectRecord, rootId: string, previousRule: RecognitionRule, nextRule: RecognitionRule): number {
  const numeric = new Set<RecognitionRule>(['after-first', 'before-first']);
  if (previousRule === nextRule || !numeric.has(previousRule) || !numeric.has(nextRule)) return 0;
  let changed = 0;
  for (const block of project.document.blocks) if (block.type === 'comparisons') for (const comparison of block.comparisons) {
    if (comparison.locked || !comparison.sourceKey?.startsWith(`${rootId}:`)) continue;
    // Move existing references rather than re-selecting latest versions or relying on source availability.
    [comparison.before, comparison.after] = [comparison.after, comparison.before];
    changed++;
  }
  return changed;
}

export function preserveManualDecisions(previous: ProjectRecord, incoming: ProjectRecord): void {
  const old = previous.document.blocks.flatMap(block => block.type === 'comparisons' ? block.comparisons : []);
  const next = incoming.document.blocks.flatMap(block => block.type === 'comparisons' ? block.comparisons : []);
  for (const comparison of next) if (!old.some(item => item.id === comparison.id)) { delete comparison.sourceKey; comparison.locked = true; }
  const excluded = new Set(incoming.excludedSourceKeys);
  for (const comparison of old) {
    const replacement = next.find(item => item.id === comparison.id);
    if (!replacement && comparison.sourceKey) excluded.add(comparison.sourceKey);
    else if (replacement) {
      replacement.sourceKey = comparison.sourceKey;
      if (JSON.stringify(replacement.before) !== JSON.stringify(comparison.before) || JSON.stringify(replacement.after) !== JSON.stringify(comparison.after)) replacement.locked = true;
    }
  }
  incoming.excludedSourceKeys = [...excluded];
}
