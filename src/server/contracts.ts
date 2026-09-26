import type { ProjectRecord, ProjectSummary, StudioSettings, Preset, AssetVersion } from '../shared/model.js';

export interface StudioStore {
  dataDir: string;
  getProject(id: string): ProjectRecord;
  listProjects(): ProjectSummary[];
  saveProject(project: ProjectRecord, expectedRevision: number): ProjectRecord;
  getSettings(): StudioSettings;
  saveSettings(settings: StudioSettings): StudioSettings;
  listPresets(): Preset[];
  assetPath(projectId: string, versionId: string): { path: string; version: AssetVersion };
  putRecord<T>(kind: string, id: string, value: T): void;
  getRecord<T>(kind: string, id: string): T | undefined;
  listRecords<T>(kind: string): T[];
}
export interface ServerConfig { dataDir: string; port: number; host: string; rootDir: string; testing?: boolean }
