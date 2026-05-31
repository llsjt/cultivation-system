import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { performance } from 'node:perf_hooks';
import path from 'node:path';

import Database from 'better-sqlite3';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CultivationService } from '../services/cultivationService';
import { enableForeignKeys } from '../db/connection';

const shellMocks = vi.hoisted(() => ({
  openExternal: vi.fn(),
  openPath: vi.fn(),
}));

vi.mock('electron', () => ({
  shell: shellMocks,
}));

function migrateMemoryDb() {
  const db = new Database(':memory:');
  enableForeignKeys(db);
  const migration = readFileSync(path.resolve(process.cwd(), 'drizzle/0000_mute_spirit.sql'), 'utf8').replaceAll('--> statement-breakpoint', '');
  db.exec(migration);
  return db;
}

function migrateFileDb(filePath: string) {
  const db = new Database(filePath);
  enableForeignKeys(db);
  const migration = readFileSync(path.resolve(process.cwd(), 'drizzle/0000_mute_spirit.sql'), 'utf8').replaceAll('--> statement-breakpoint', '');
  db.exec(migration);
  return db;
}

function createService() {
  const db = migrateMemoryDb();
  return { db, service: new CultivationService(db) };
}

describe('CultivationService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a project and record-only resource, recommends it, then saves a study log and updates progress', () => {
    const { db, service } = createService();

    try {
      const project = service.createProject({ name: 'TypeScript Study', description: 'Compiler notes' });
      const resource = service.createResource({
        project_id: project.id,
        title: 'Control flow analysis',
        type: 'document',
        open_kind: 'record_only',
        initial_progress_percent: 10,
        initial_progress_text: 'Read the intro',
        initial_next_action: 'Work through narrowing examples',
      });

      expect(resource).toMatchObject({
        project_id: project.id,
        title: 'Control flow analysis',
        open_kind: 'record_only',
        status: 'learning',
        progress_percent: 10,
        progress_text: 'Read the intro',
        next_action: 'Work through narrowing examples',
      });

      const overviewBeforeLog = service.getHomeOverview();
      expect(overviewBeforeLog.recommended?.id).toBe(resource.id);
      expect(overviewBeforeLog.recommended_project_name).toBe('TypeScript Study');
      expect(overviewBeforeLog.recommended_project_progress).toBe(10);
      expect(overviewBeforeLog.pending).toBeNull();
      expect(overviewBeforeLog.projects).toHaveLength(1);
      expect(overviewBeforeLog.recent_logs).toEqual([]);

      const saved = service.saveStudyLog({
        resource_id: resource.id,
        source: 'record_only',
        progress_percent: 65,
        progress_text: 'Finished narrowing and discriminated unions',
        next_action: 'Practice exhaustiveness checks',
        duration_minutes: 45,
        content: 'The flow-sensitive parts are clear now.',
        resource_updated_at_before: resource.updated_at,
      });

      expect(saved.progress_delta).toBe(55);
      expect(saved.feedback_kind).toBe('increased');
      expect(saved.project_progress_percent).toBe(65);
      expect(saved.log).toMatchObject({
        resource_id: resource.id,
        resource_title_snapshot: 'Control flow analysis',
        duration_minutes: 45,
        content: 'The flow-sensitive parts are clear now.',
        progress_before_percent: 10,
        progress_after_percent: 65,
        status_before: 'learning',
        status_after: 'learning',
        next_action: 'Practice exhaustiveness checks',
      });
      expect(saved.resource).toMatchObject({
        id: resource.id,
        status: 'learning',
        progress_percent: 65,
        progress_text: 'Finished narrowing and discriminated unions',
        next_action: 'Practice exhaustiveness checks',
      });
      expect(saved.resource.last_studied_at).toBeTruthy();
      expect(saved.resource.updated_at).not.toBe(resource.updated_at);

      const detail = service.getProjectDetail({ project_id: project.id });
      expect(detail.project).toMatchObject({
        id: project.id,
        status: 'learning',
        progress_percent: 65,
        resource_count: 1,
      });
      expect(detail.recent_logs).toHaveLength(1);
      expect(detail.recent_logs[0]?.id).toBe(saved.log.id);

      const overviewAfterLog = service.getHomeOverview();
      expect(overviewAfterLog.recommended?.id).toBe(resource.id);
      expect(overviewAfterLog.recommended_project_progress).toBe(65);
      expect(overviewAfterLog.recent_logs[0]?.id).toBe(saved.log.id);
    } finally {
      db.close();
    }
  });

  it('restores the home recommendation and recent log after closing and reopening the database', () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), 'cultivation-persist-'));
    const dbPath = path.join(tempDir, 'cultivation_system.sqlite3');
    let db = migrateFileDb(dbPath);

    try {
      let service = new CultivationService(db);
      const project = service.createProject({ name: '算法闭关', description: null });
      const resource = service.createResource({
        project_id: project.id,
        title: '动态规划题单',
        type: 'exercise',
        open_kind: 'record_only',
        initial_progress_percent: 0,
        initial_next_action: '完成前 3 题',
      });
      service.saveStudyLog({
        resource_id: resource.id,
        source: 'record_only',
        progress_percent: 30,
        progress_text: '做完基础状态转移',
        next_action: '补边界条件题',
        resource_updated_at_before: resource.updated_at,
      });
      db.close();

      db = new Database(dbPath);
      enableForeignKeys(db);
      service = new CultivationService(db);

      const overview = service.getHomeOverview();
      expect(overview.recommended?.title).toBe('动态规划题单');
      expect(overview.recommended?.progress_percent).toBe(30);
      expect(overview.recommended?.next_action).toBe('补边界条件题');
      expect(overview.recent_logs[0]?.resource_title_snapshot).toBe('动态规划题单');
      expect(service.getProjectDetail({ project_id: project.id }).project.progress_percent).toBe(30);
    } finally {
      db.close();
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('creates, exposes and abandons a pending session for an opened file resource', async () => {
    const { db, service } = createService();
    const tempDir = mkdtempSync(path.join(tmpdir(), 'cultivation-service-'));
    const tempFile = path.join(tempDir, 'lesson.txt');
    writeFileSync(tempFile, 'lesson');
    shellMocks.openPath.mockResolvedValue('');

    try {
      const project = service.createProject({ name: 'Pending Study' });
      const resource = service.createResource({
        project_id: project.id,
        title: 'Local lesson',
        type: 'document',
        open_kind: 'file',
        path_or_url: tempFile,
        initial_progress_percent: 25,
        initial_progress_text: 'Started',
        initial_next_action: 'Continue locally',
      });

      expect(service.getPendingSession()).toBeNull();

      const opened = await service.continueResource({ resource_id: resource.id });
      expect(opened.result).toBe('opened');
      expect(shellMocks.openPath).toHaveBeenCalledWith(tempFile);
      expect(opened.pending).toMatchObject({
        project_id: project.id,
        resource_id: resource.id,
        resource_title_snapshot: 'Local lesson',
        current_resource_title: 'Local lesson',
        progress_before_text: 'Started',
        progress_before_percent: 25,
        status_before: 'learning',
        next_action_before: 'Continue locally',
        resource_updated_at_before: resource.updated_at,
      });

      const pending = service.getPendingSession();
      expect(pending?.id).toBe(opened.pending?.id);
      expect(service.getResourceDetail(resource.id).last_opened_at).toBeTruthy();

      const abandoned = service.abandonPendingSession(pending?.id ?? '');
      expect(abandoned).toEqual({ abandoned: true });
      expect(service.getPendingSession()).toBeNull();
    } finally {
      db.close();
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('uses the pending snapshot as the before state when saving after another resource changed', async () => {
    const { db, service } = createService();
    const tempDir = mkdtempSync(path.join(tmpdir(), 'cultivation-service-'));
    const tempFile = path.join(tempDir, 'lesson.txt');
    writeFileSync(tempFile, 'lesson');
    shellMocks.openPath.mockResolvedValue('');

    try {
      const project = service.createProject({ name: 'Snapshot Study' });
      const resource = service.createResource({
        project_id: project.id,
        title: 'Snapshot lesson',
        type: 'document',
        open_kind: 'file',
        path_or_url: tempFile,
        initial_progress_percent: 20,
        initial_progress_text: 'Before opening',
        initial_next_action: 'Open the file',
      });
      const opened = await service.continueResource({ resource_id: resource.id });
      expect(opened.result).toBe('opened');

      const manualResource = service.createResource({
        project_id: project.id,
        title: 'Manual side note',
        type: 'document',
        open_kind: 'record_only',
        initial_progress_percent: 5,
      });

      const manualSaved = service.saveStudyLog({
        resource_id: manualResource.id,
        source: 'manual',
        progress_percent: 45,
        progress_text: 'Manual note while pending exists',
        next_action: 'Still pending',
        resource_updated_at_before: manualResource.updated_at,
      });
      expect(manualSaved.log.resource_id).toBe(manualResource.id);
      expect(service.getPendingSession()?.resource_id).toBe(resource.id);

      const saved = service.saveStudyLog({
        resource_id: resource.id,
        source: 'pending',
        progress_percent: 70,
        progress_text: 'Saved from pending',
        next_action: 'Continue from snapshot',
        resource_updated_at_before: opened.pending?.resource_updated_at_before ?? '',
        confirm_overwrite: true,
      });

      expect(saved.log).toMatchObject({
        progress_before_percent: 20,
        progress_after_percent: 70,
        status_before: 'learning',
      });
      expect(saved.progress_delta).toBe(50);
      expect(service.getPendingSession()).toBeNull();
    } finally {
      db.close();
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('rejects bypassing an active pending session for the same resource', async () => {
    const { db, service } = createService();
    const tempDir = mkdtempSync(path.join(tmpdir(), 'cultivation-service-'));
    const tempFile = path.join(tempDir, 'lesson.txt');
    writeFileSync(tempFile, 'lesson');
    shellMocks.openPath.mockResolvedValue('');

    try {
      const project = service.createProject({ name: 'Pending Guard' });
      const resource = service.createResource({
        project_id: project.id,
        title: 'Guarded lesson',
        type: 'document',
        open_kind: 'file',
        path_or_url: tempFile,
        initial_progress_percent: 20,
      });
      await service.continueResource({ resource_id: resource.id });

      expect(() =>
        service.saveStudyLog({
          resource_id: resource.id,
          source: 'manual',
          progress_percent: 30,
          progress_text: 'Wrong entry',
          resource_updated_at_before: resource.updated_at,
        }),
      ).toThrow();
    } finally {
      db.close();
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('blocks dangerous local paths and URLs with credentials', () => {
    const { db, service } = createService();

    try {
      const project = service.createProject({ name: 'Security Study' });

      expect(() =>
        service.createResource({
          project_id: project.id,
          title: 'Executable',
          type: 'other',
          open_kind: 'file',
          path_or_url: 'C:\\Windows\\System32\\cmd.exe',
        }),
      ).toThrow();

      expect(() =>
        service.createResource({
          project_id: project.id,
          title: 'Unresolved parent',
          type: 'document',
          open_kind: 'file',
          path_or_url: 'C:\\study\\..\\secret.txt',
        }),
      ).toThrow();

      expect(() =>
        service.createResource({
          project_id: project.id,
          title: 'HTA',
          type: 'other',
          open_kind: 'file',
          path_or_url: 'C:\\study\\launch.hta',
        }),
      ).toThrow();

      expect(() =>
        service.createResource({
          project_id: project.id,
          title: 'Credential URL',
          type: 'web',
          open_kind: 'url',
          path_or_url: 'https://user:pass@example.com/course',
        }),
      ).toThrow();
    } finally {
      db.close();
    }
  });

  it('requires a one-time risk token before opening an insecure http URL', async () => {
    const { db, service } = createService();
    shellMocks.openExternal.mockResolvedValue(undefined);

    try {
      const project = service.createProject({ name: 'Risk Study' });
      const resource = service.createResource({
        project_id: project.id,
        title: 'HTTP course',
        type: 'web',
        open_kind: 'url',
        path_or_url: 'http://example.com/course',
      });

      const first = await service.continueResource({ resource_id: resource.id });
      expect(first).toMatchObject({
        result: 'blocked',
        block_level: 'warn',
      });
      expect(first.risk_confirm_token).toBeTruthy();
      expect(shellMocks.openExternal).not.toHaveBeenCalled();

      const second = await service.continueResource({
        resource_id: resource.id,
        risk_confirm_token: first.risk_confirm_token,
      });
      expect(second.result).toBe('opened');
      expect(shellMocks.openExternal).toHaveBeenCalledWith('http://example.com/course');
      expect(second.pending?.resource_id).toBe(resource.id);
    } finally {
      db.close();
    }
  });

  it('requires one-time confirmation for macro files and private-network URLs', async () => {
    const { db, service } = createService();
    const tempDir = mkdtempSync(path.join(tmpdir(), 'cultivation-risk-'));
    const macroFile = path.join(tempDir, 'lesson.docm');
    writeFileSync(macroFile, 'macro');
    shellMocks.openPath.mockResolvedValue('');
    shellMocks.openExternal.mockResolvedValue(undefined);

    try {
      const project = service.createProject({ name: 'Warn Study' });
      const macro = service.createResource({
        project_id: project.id,
        title: 'Macro workbook',
        type: 'document',
        open_kind: 'file',
        path_or_url: macroFile,
      });

      const macroFirst = await service.continueResource({ resource_id: macro.id });
      expect(macroFirst).toMatchObject({ result: 'blocked', block_level: 'warn' });
      expect(shellMocks.openPath).not.toHaveBeenCalled();

      const macroSecond = await service.continueResource({ resource_id: macro.id, risk_confirm_token: macroFirst.risk_confirm_token });
      expect(macroSecond.result).toBe('opened');
      expect(shellMocks.openPath).toHaveBeenCalledWith(macroFile);
      service.abandonPendingSession(macroSecond.pending?.id ?? '');

      const intranet = service.createResource({
        project_id: project.id,
        title: 'Intranet course',
        type: 'web',
        open_kind: 'url',
        path_or_url: 'https://192.168.1.8/course',
      });
      const intranetFirst = await service.continueResource({ resource_id: intranet.id });
      expect(intranetFirst).toMatchObject({ result: 'blocked', block_level: 'warn' });

      const intranetSecond = await service.continueResource({ resource_id: intranet.id, risk_confirm_token: intranetFirst.risk_confirm_token });
      expect(intranetSecond.result).toBe('opened');
      expect(shellMocks.openExternal).toHaveBeenCalledWith('https://192.168.1.8/course');
    } finally {
      db.close();
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('keeps recommendation ordering stable and excludes paused or completed resources', () => {
    const { db, service } = createService();

    try {
      const project = service.createProject({ name: 'Recommendation Study' });
      const paused = service.createResource({
        project_id: project.id,
        title: 'Paused lesson',
        type: 'document',
        open_kind: 'record_only',
        initial_progress_percent: 50,
        initial_status: 'paused',
      });
      const completed = service.createResource({
        project_id: project.id,
        title: 'Completed lesson',
        type: 'document',
        open_kind: 'record_only',
        initial_progress_percent: 100,
        initial_status: 'completed',
      });
      const notStarted = service.createResource({
        project_id: project.id,
        title: 'Not started lesson',
        type: 'document',
        open_kind: 'record_only',
        initial_progress_percent: 0,
      });
      const review = service.createResource({
        project_id: project.id,
        title: 'Review lesson',
        type: 'document',
        open_kind: 'record_only',
        initial_progress_percent: 35,
        initial_status: 'review',
      });
      const learning = service.createResource({
        project_id: project.id,
        title: 'Learning lesson',
        type: 'document',
        open_kind: 'record_only',
        initial_progress_percent: 20,
      });

      expect(service.getHomeOverview().recommended?.id).toBe(learning.id);
      service.saveStudyLog({
        resource_id: learning.id,
        source: 'record_only',
        progress_percent: 100,
        progress_text: 'Done',
        resource_updated_at_before: learning.updated_at,
      });

      const next = service.getHomeOverview().recommended;
      expect(next?.id).toBe(review.id);
      expect([paused.id, completed.id, learning.id]).not.toContain(next?.id);
      expect(service.getProjectDetail({ project_id: project.id }).resources.items.at(-1)?.id).toBe(completed.id);
      expect(service.getResourceDetail(notStarted.id).status).toBe('not_started');
    } finally {
      db.close();
    }
  });

  it('deletes resources with pending sessions without losing historical log snapshots', async () => {
    const { db, service } = createService();
    const tempDir = mkdtempSync(path.join(tmpdir(), 'cultivation-delete-'));
    const tempFile = path.join(tempDir, 'lesson.txt');
    writeFileSync(tempFile, 'lesson');
    shellMocks.openPath.mockResolvedValue('');

    try {
      const project = service.createProject({ name: 'Delete Study' });
      const resource = service.createResource({
        project_id: project.id,
        title: 'Deletable lesson',
        type: 'document',
        open_kind: 'file',
        path_or_url: tempFile,
        initial_progress_percent: 20,
      });
      const saved = service.saveStudyLog({
        resource_id: resource.id,
        source: 'manual',
        progress_percent: 25,
        progress_text: 'Snapshot survives',
        resource_updated_at_before: resource.updated_at,
      });
      const updated = service.getResourceDetail(resource.id);
      await service.continueResource({ resource_id: resource.id });

      service.deleteResource(resource.id);

      expect(service.getPendingSession()).toBeNull();
      const log = db.prepare('SELECT resource_id, resource_title_snapshot FROM study_logs WHERE id = ?').get(saved.log.id) as {
        resource_id: string | null;
        resource_title_snapshot: string;
      };
      expect(log).toEqual({ resource_id: null, resource_title_snapshot: 'Deletable lesson' });
      expect(service.getProjectDetail({ project_id: project.id }).project.progress_percent).toBe(0);
      expect(updated.last_studied_at).toBeTruthy();
    } finally {
      db.close();
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('deletes a project with resources, logs and pending sessions without orphan data', async () => {
    const { db, service } = createService();
    const tempDir = mkdtempSync(path.join(tmpdir(), 'cultivation-delete-project-'));
    const tempFile = path.join(tempDir, 'lesson.txt');
    writeFileSync(tempFile, 'lesson');
    shellMocks.openPath.mockResolvedValue('');

    try {
      const project = service.createProject({ name: 'Project Cascade' });
      const resource = service.createResource({
        project_id: project.id,
        title: 'Cascade lesson',
        type: 'document',
        open_kind: 'file',
        path_or_url: tempFile,
        initial_progress_percent: 15,
      });
      service.saveStudyLog({
        resource_id: resource.id,
        source: 'manual',
        progress_percent: 20,
        progress_text: 'Before cascade',
        resource_updated_at_before: resource.updated_at,
      });
      await service.continueResource({ resource_id: resource.id });

      service.deleteProject(project.id);

      expect(service.getPendingSession()).toBeNull();
      expect((db.prepare('SELECT COUNT(*) AS count FROM resources WHERE project_id = ?').get(project.id) as { count: number }).count).toBe(0);
      expect((db.prepare('SELECT COUNT(*) AS count FROM study_logs WHERE project_id = ?').get(project.id) as { count: number }).count).toBe(0);
      expect((db.prepare('SELECT COUNT(*) AS count FROM pending_study_sessions WHERE project_id = ?').get(project.id) as { count: number }).count).toBe(0);
    } finally {
      db.close();
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('keeps the self-use record timing median below 30 seconds with 100 projects and 5000 resources', () => {
    const { db, service } = createService();
    const now = new Date().toISOString();

    try {
      const insertProject = db.prepare('INSERT INTO projects (id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)');
      const insertResource = db.prepare(
        `INSERT INTO resources (
          id, project_id, title, type, open_kind, status, progress_percent, next_action, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );

      db.transaction(() => {
        for (let projectIndex = 0; projectIndex < 100; projectIndex += 1) {
          insertProject.run(`p-${projectIndex}`, `Project ${projectIndex}`, 'learning', now, now);
        }
        for (let resourceIndex = 0; resourceIndex < 5000; resourceIndex += 1) {
          const progress = (resourceIndex % 98) + 1;
          insertResource.run(
            `r-${resourceIndex}`,
            `p-${resourceIndex % 100}`,
            `Resource ${resourceIndex}`,
            'document',
            'record_only',
            'learning',
            progress,
            `Next ${resourceIndex}`,
            now,
            now,
          );
        }
      })();

      const timings = Array.from({ length: 5 }, (_, runIndex) => {
        const detail = service.getResourceDetail('r-0');
        const started = performance.now();
        service.saveStudyLog({
          resource_id: detail.id,
          source: 'record_only',
          progress_percent: 20 + runIndex,
          progress_text: `Run ${runIndex}`,
          next_action: `Next run ${runIndex}`,
          resource_updated_at_before: detail.updated_at,
        });
        service.getHomeOverview();
        return performance.now() - started;
      }).sort((a, b) => a - b);

      expect(timings[2]).toBeLessThanOrEqual(30_000);
    } finally {
      db.close();
    }
  });
});
