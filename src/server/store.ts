import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { lstat, rm } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { newId, type AssetVersion, type Preset, type ProjectRecord, type ProjectSummary, type StudioSettings } from '../shared/model.js';
import { BUILTIN_PRESETS } from '../shared/defaults.js';
import { parseSettings, validateProject } from '../domain/validation.js';
import { StudioError } from '../domain/errors.js';
import { ensureChapterAnchors } from '../shared/chapters.js';
import type { StudioStore } from './contracts.js';

export class SqliteStudioStore implements StudioStore {
  readonly dataDir: string;
  private db: DatabaseSync;
  private settings: StudioSettings;
  constructor(dataDir: string) {
    this.dataDir = resolve(dataDir);
    mkdirSync(this.dataDir, { recursive: true });
    this.db = new DatabaseSync(resolve(this.dataDir, 'workspace.sqlite'));
    const schemaVersion = (this.db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
    if (schemaVersion > 3) {
      this.db.close();
      throw new StudioError('SCHEMA_TOO_NEW', '这些项目资料由较新版本的 Wedding Delivery Studio 保存，请使用新版应用打开；资料未被修改。', 409);
    }
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS studio_settings (singleton INTEGER PRIMARY KEY CHECK(singleton=1), data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, revision INTEGER NOT NULL, data TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS projects_tenant ON projects(tenant_id);
      CREATE TABLE IF NOT EXISTS records (tenant_id TEXT NOT NULL, kind TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY(tenant_id, kind, id));`);
    if (schemaVersion < 3) this.db.exec('PRAGMA user_version=3');
    const row = this.db.prepare('SELECT data FROM studio_settings WHERE singleton=1').get() as { data: string } | undefined;
    this.settings = row ? parseSettings(JSON.parse(row.data)) : { tenantId: newId(), studioName: '我的工作室', photographerName: '', tagline: 'A STORY IN MOTION', accent: '#a78964', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' };
    if (!row) this.db.prepare('INSERT INTO studio_settings(singleton,data) VALUES(1,?)').run(JSON.stringify(this.settings));
  }
  close() { this.db.close(); }
  private decodeProject(serialized: string): ProjectRecord {
    const value = JSON.parse(serialized) as ProjectRecord;
    if (value.document?.fields && !value.document.fields.projectNo) value.document.fields.projectNo = { value: value.projectNo, visible: false };
    value.document.blocks = ensureChapterAnchors(value.document.blocks, value.document.id);
    return validateProject(value, this.settings.tenantId);
  }
  getSettings() { return structuredClone(this.settings); }
  saveSettings(value: StudioSettings) {
    const settings = parseSettings(value);
    if (settings.tenantId !== this.settings.tenantId) throw new StudioError('TENANT_MISMATCH', '不能修改工作区身份。', 403);
    this.db.prepare('UPDATE studio_settings SET data=? WHERE singleton=1').run(JSON.stringify(settings));
    this.settings = settings;
    return this.getSettings();
  }
  getProject(id: string, includeDeleted = false): ProjectRecord {
    const row = this.db.prepare('SELECT data FROM projects WHERE id=? AND tenant_id=?').get(id, this.settings.tenantId) as { data: string } | undefined;
    if (!row) throw new StudioError('PROJECT_NOT_FOUND', '项目不存在或不属于当前工作区。', 404);
    const project = this.decodeProject(row.data);
    if (!includeDeleted && project.deletedAt) throw new StudioError('PROJECT_TRASHED', '项目已移入回收站，请先恢复后再打开。', 410);
    return project;
  }
  listProjects(): ProjectSummary[] {
    return (this.db.prepare('SELECT data FROM projects WHERE tenant_id=?').all(this.settings.tenantId) as { data: string }[])
      .map(row => this.decodeProject(row.data))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(project => ({ id: project.id, title: project.title, projectNo: project.projectNo, coupleNames: project.document.fields.coupleNames.value, weddingDate: project.document.fields.weddingDate.value, templateId: project.document.templateId, comparisons: project.document.blocks.reduce((count, block) => count + (block.type === 'comparisons' ? block.comparisons.length : 0), 0), updatedAt: project.updatedAt, archived: project.archived, draftRevision: project.draftRevision, deletedAt: project.deletedAt, purgePending: !!this.getRecord('project-purge', project.id) }));
  }
  saveProject(value: ProjectRecord, expectedRevision: number): ProjectRecord {
    return this.persistProject(value, expectedRevision);
  }
  private persistProject(value: ProjectRecord, expectedRevision: number, lifecycle = false): ProjectRecord {
    if (!Number.isInteger(expectedRevision) || expectedRevision < 0) throw new StudioError('INVALID_REVISION', '项目版本无效。');
    const project = validateProject(structuredClone(value), this.settings.tenantId);
    const old = this.db.prepare('SELECT tenant_id,revision,data FROM projects WHERE id=?').get(project.id) as { tenant_id: string; revision: number; data: string } | undefined;
    if (old && old.tenant_id !== this.settings.tenantId) throw new StudioError('TENANT_MISMATCH', '项目不属于当前工作区。', 403);
    if ((!old && expectedRevision !== 0) || (old && old.revision !== expectedRevision)) throw new StudioError('REVISION_CONFLICT', '项目已有更新，请重新载入后再保存，避免覆盖其他修改。', 409);
    if (!lifecycle && (project.deletedAt || (old && JSON.parse(old.data).deletedAt))) throw new StudioError('PROJECT_TRASHED', '回收站中的项目不能编辑，请先恢复。', 410);
    project.draftRevision = expectedRevision + 1;
    project.updatedAt = new Date().toISOString();
    if (!old) this.db.prepare('INSERT INTO projects(id,tenant_id,revision,data) VALUES(?,?,?,?)').run(project.id, project.tenantId, project.draftRevision, JSON.stringify(project));
    else {
      const result = this.db.prepare('UPDATE projects SET revision=?,data=? WHERE id=? AND tenant_id=? AND revision=?').run(project.draftRevision, JSON.stringify(project), project.id, project.tenantId, expectedRevision);
      if (result.changes !== 1) throw new StudioError('REVISION_CONFLICT', '项目版本已改变，请重新载入。', 409);
    }
    return project;
  }
  trashProject(id: string, revision: number): ProjectRecord {
    const project = this.getProject(id);
    project.deletedAt = new Date().toISOString();
    return this.persistProject(project, revision, true);
  }
  restoreProject(id: string, revision: number): ProjectRecord {
    const project = this.getProject(id, true);
    if (!project.deletedAt) throw new StudioError('PROJECT_NOT_TRASHED', '项目不在回收站。', 409);
    if (this.getRecord('project-purge', id)) throw new StudioError('PURGE_PENDING', '此项目已开始彻底删除，请重试完成清理，无法恢复。', 409);
    delete project.deletedAt;
    return this.persistProject(project, revision, true);
  }
  async purgeProject(id: string, revision: number): Promise<void> {
    const project = this.getProject(id, true);
    if (!project.deletedAt) throw new StudioError('PROJECT_NOT_TRASHED', '请先将项目移入回收站。', 409);
    if (project.draftRevision !== revision) throw new StudioError('REVISION_CONFLICT', '项目状态已改变，请刷新列表后重试。', 409);
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new StudioError('INVALID_ID', '项目标识无效。');
    // Persist intent first. A crash or locked file must never permit restoring partial data.
    this.putRecord('project-purge', id, { projectId: id });
    try {
      for (const folder of ['assets', 'exports']) {
        const parent = resolve(this.dataDir, folder);
        const info = await lstat(parent).catch((error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return null; throw error; });
        if (!info) continue;
        if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Unmanaged storage directory');
        await rm(resolve(parent, id), { recursive: true, force: true });
      }
      this.db.exec('BEGIN IMMEDIATE');
      try {
        this.db.prepare(`DELETE FROM records WHERE tenant_id=? AND kind IN ('candidate','export','artifact','import-run','project-purge') AND
          (json_extract(data,'$.projectId')=? OR json_extract(data,'$.candidate.projectId')=? OR json_extract(data,'$.record.projectId')=?)`).run(project.tenantId, id, id, id);
        this.db.prepare('DELETE FROM projects WHERE id=? AND tenant_id=? AND revision=?').run(id, project.tenantId, revision);
        this.db.exec('COMMIT');
      } catch (error) { this.db.exec('ROLLBACK'); throw error; }
    } catch {
      throw new StudioError('PURGE_INCOMPLETE', '清理未完成，请关闭占用项目文件的程序并检查磁盘权限，再点击“重试彻底删除”。项目保持待删除状态。', 500);
    }
  }
  saveProjectWithRecord<T>(project: ProjectRecord, expectedRevision: number, kind: string, id: string, record: T): ProjectRecord {
    // The project report and its durable run cursor describe one operation. Persist both or neither.
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const saved = this.saveProject(project, expectedRevision);
      this.putRecord(kind, id, record);
      this.db.exec('COMMIT');
      return saved;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  listPresets(): Preset[] { return [...structuredClone(BUILTIN_PRESETS), ...this.listRecords<Preset>('preset')]; }
  assetPath(projectId: string, versionId: string): { path: string; version: AssetVersion } {
    const project = this.getProject(projectId);
    const version = project.assets.flatMap(asset => asset.versions).find(item => item.id === versionId);
    if (!version) throw new StudioError('ASSET_NOT_FOUND', '图片版本不存在或不属于本项目。', 404);
    return { path: this.storagePath(version.storageKey), version };
  }
  storagePath(key: string): string {
    if (!/^assets\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\.(png|original)$/.test(key)) throw new StudioError('INVALID_STORAGE_KEY', '素材存储标识无效。');
    const path = resolve(this.dataDir, key);
    if (!path.startsWith(this.dataDir + sep)) throw new StudioError('INVALID_STORAGE_KEY', '素材存储范围无效。');
    return path;
  }
  putRecord<T>(kind: string, id: string, value: T) { this.db.prepare('INSERT INTO records(tenant_id,kind,id,data) VALUES(?,?,?,?) ON CONFLICT(tenant_id,kind,id) DO UPDATE SET data=excluded.data').run(this.settings.tenantId, kind, id, JSON.stringify(value)); }
  getRecord<T>(kind: string, id: string): T | undefined {
    const row = this.db.prepare('SELECT data FROM records WHERE tenant_id=? AND kind=? AND id=?').get(this.settings.tenantId, kind, id) as { data: string } | undefined;
    return row ? JSON.parse(row.data) as T : undefined;
  }
  listRecords<T>(kind: string): T[] { return (this.db.prepare('SELECT data FROM records WHERE tenant_id=? AND kind=?').all(this.settings.tenantId, kind) as { data: string }[]).map(row => JSON.parse(row.data) as T); }
}
