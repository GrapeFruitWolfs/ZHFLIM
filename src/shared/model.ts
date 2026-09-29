import type { TemplateId } from './templates.js';
export type { TemplateId } from './templates.js';
export type OutputTarget = 'pdf' | 'image';
export type OutputMode = OutputTarget | 'both';
export type ComparisonLayout = 'stacked' | 'split';
export type RecognitionRule = 'after-first' | 'before-first' | 'words' | 'manual';
export interface VisibleText { value: string; visible: boolean }
export interface AssetRef { assetId: string; versionId: string }
export interface AssetVersion {
  id: string; hash: string; filename: string; width: number; height: number;
  mime: string; byteSize: number; storageKey: string; createdAt: string;
  originalStorageKey: string; derivativeHash: string;
}
export interface Asset {
  id: string; tenantId: string; projectId: string; rootId: string;
  relativePath: string; versions: AssetVersion[]; latestVersionId: string;
}
export interface Comparison {
  id: string; title: string; order: number; visible: boolean;
  description?: string;
  before: AssetRef | null; after: AssetRef | null;
  sourceKey?: string; locked: boolean;
}
export interface DeliveryItem {
  id: string; title: string; description: string; format: string;
  method: 'link' | 'attachment' | 'offline' | 'description';
  downloadUrl: string; playbackUrl: string; accessNote: string;
  visible: boolean; order: number;
}
interface BlockBase { id: string; title: string; visible: boolean; order: number }
export interface CoverSettings { emphasis: 'names' | 'photo'; headline: string; message: string; image: AssetRef | null }
export interface ProductionDetails { content: string; image: AssetRef | null; caption: string; placement: 'inline' | 'appendix' | 'hidden' }
export interface IntroBlock extends BlockBase { type: 'intro'; cover?: CoverSettings }
export interface DeliveryBlock extends BlockBase { type: 'deliveries'; items: DeliveryItem[] }
export interface TextBlock extends BlockBase { type: 'text'; content: string; sourceDefinitionId?: string; details?: ProductionDetails }
export interface ComparisonBlock extends BlockBase { type: 'comparisons'; layout: ComparisonLayout | 'inherit'; comparisons: Comparison[] }
export interface SignatureBlock extends BlockBase { type: 'signature' }
export type DocumentBlock = IntroBlock | DeliveryBlock | TextBlock | ComparisonBlock | SignatureBlock;
export interface OutputSettings {
  mode: OutputMode; imageWidth: number; segmentHeight: number;
  allowImageSegments: boolean; allowComparisonPageBreak: boolean;
}
export interface DeliveryDocument {
  id: string;
  fields: {
    salutation: VisibleText; coupleNames: VisibleText; weddingDate: VisibleText;
    studioName: VisibleText; photographerName: VisibleText; projectNo: VisibleText;
  };
  deliveryDate: { mode: 'auto' | 'manual'; manualDate: string; visible: boolean };
  brand: { tagline: string; accent: string; logo: AssetRef | null };
  templateId: TemplateId; templateVersion: number; comparisonLayout: ComparisonLayout;
  blocks: DocumentBlock[]; output: OutputSettings;
}
export interface ImportRoot { id: string; label: string; rule: RecognitionRule; createdAt: string }
export interface ImportObservation { relativePath: string; size: number; type: string; lastModified: number }
export interface ImportIssue { code: string; message: string; paths: string[]; sourceKey?: string }
export interface ImportReport {
  id: string; rootId: string; createdAt: string; scanned: number; images: number;
  videos: number; audio: number; other: number; imported: number; reused: number;
  paired: number; incomplete: number; issues: ImportIssue[]; cancelled: boolean;
}
export interface ProjectRecord {
  schemaVersion: 1; id: string; tenantId: string; clientId: string;
  title: string; projectNo: string; internalNotes: string;
  draftRevision: number; archived: boolean; deletedAt?: string; createdAt: string; updatedAt: string;
  document: DeliveryDocument; assets: Asset[]; importRoots: ImportRoot[];
  excludedSourceKeys: string[]; importReports: ImportReport[];
}
export interface ProjectSummary {
  id: string; title: string; projectNo: string; coupleNames: string; weddingDate: string;
  templateId: TemplateId; comparisons: number; updatedAt: string; archived: boolean;
  draftRevision: number; deletedAt?: string; purgePending?: boolean;
}
export interface StudioSettings {
  tenantId: string; studioName: string; photographerName: string;
  tagline: string; accent: string; timezone: string;
}
export interface Preset {
  id: string; version: number; name: string; description: string; builtin: boolean;
  blocks: DocumentBlock[]; templateId: TemplateId; comparisonLayout: ComparisonLayout;
}
export interface Issue {
  id: string; code: string; severity: 'error' | 'warning' | 'info';
  scope: 'all' | OutputTarget; message: string;
  blockId?: string; comparisonId?: string; assetId?: string;
}
export interface Artifact {
  id: string; target: OutputTarget; filename: string; mime: string; byteSize: number;
  hash: string; width?: number; height?: number; pages?: number; url: string;
}
export interface TargetResult {
  target: OutputTarget; status: 'ready' | 'blocked' | 'running' | 'success' | 'failed';
  error?: string; artifacts: Artifact[];
}
export interface PreviewCandidate {
  id: string; projectId: string; draftRevision: number; createdAt: string;
  resolvedDate: string; timezone: string; targets: OutputTarget[];
  issues: Issue[]; results: TargetResult[]; previewUrls: Partial<Record<OutputTarget, string>>;
}
export interface ExportRecord {
  id: string; projectId: string; candidateId: string; draftRevision: number;
  createdAt: string; resolvedDate: string; status: 'running' | 'success' | 'partial' | 'failed';
  results: TargetResult[];
}
export const outputTargets = (mode: OutputMode): OutputTarget[] => mode === 'both' ? ['pdf', 'image'] : [mode];
export const newId = () => globalThis.crypto.randomUUID();
