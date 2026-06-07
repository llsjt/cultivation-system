import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { performance } from 'node:perf_hooks';
import path from 'node:path';

import Database from 'better-sqlite3';
import type { Database as BetterSqliteDatabase } from 'better-sqlite3';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { enableForeignKeys } from '../../../src/main/db/connection';
import { CultivationService } from '../../../src/main/services/cultivationService';

const shellMocks = vi.hoisted(() => ({
  openExternal: vi.fn(),
  openPath: vi.fn(),
}));

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
  shell: shellMocks,
}));

function migrateMemoryDb() {
  const db = new Database(':memory:');
  enableForeignKeys(db);
  runMigrations(db);
  return db;
}

function migrateFileDb(filePath: string) {
  const db = new Database(filePath);
  enableForeignKeys(db);
  runMigrations(db);
  return db;
}

function runMigrations(db: BetterSqliteDatabase) {
  const migrationsDir = path.resolve(process.cwd(), 'drizzle');
  for (const fileName of readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort()) {
    const migration = readFileSync(path.join(migrationsDir, fileName), 'utf8').replaceAll('--> statement-breakpoint', '');
    db.exec(migration);
  }
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

  it('returns global resource aggregation with owning project summaries', () => {
    const { db, service } = createService();

    try {
      expect(service.getGlobalResources()).toEqual({ items: [], total: 0 });

      const projectA = service.createProject({ name: 'TypeScript Study', description: null });
      const projectB = service.createProject({ name: 'SQLite Study', description: null });
      const resourceA = service.createResource({
        project_id: projectA.id,
        title: 'Control flow analysis',
        type: 'document',
        open_kind: 'record_only',
        initial_progress_percent: 30,
      });
      const resourceB = service.createResource({
        project_id: projectB.id,
        title: 'Query planner',
        type: 'book',
        open_kind: 'record_only',
        initial_progress_percent: 60,
      });

      const global = service.getGlobalResources();

      expect(global.total).toBe(2);
      expect(global.items).toEqual(
        expect.arrayContaining([
          {
            resource: expect.objectContaining({ id: resourceA.id, title: 'Control flow analysis', project_id: projectA.id }),
            project: expect.objectContaining({ id: projectA.id, name: 'TypeScript Study', progress_percent: 30 }),
          },
          {
            resource: expect.objectContaining({ id: resourceB.id, title: 'Query planner', project_id: projectB.id }),
            project: expect.objectContaining({ id: projectB.id, name: 'SQLite Study', progress_percent: 60 }),
          },
        ]),
      );
    } finally {
      db.close();
    }
  });

  it('evaluates dao foundation and records a real breakthrough attempt', () => {
    const { db, service } = createService();

    try {
      const project = service.createProject({ name: 'Frontend Dao', description: null });
      const core = service.createResource({
        project_id: project.id,
        title: 'React core',
        type: 'document',
        open_kind: 'record_only',
        cultivation_role: 'core',
        initial_progress_percent: 100,
      });
      const trial = service.createResource({
        project_id: project.id,
        title: 'React todo trial',
        type: 'exercise',
        open_kind: 'record_only',
        cultivation_role: 'trial',
        initial_progress_percent: 100,
      });

      service.saveStudyLog({
        resource_id: core.id,
        source: 'record_only',
        progress_percent: 100,
        progress_text: 'Core understood',
        next_action: 'Do trial',
        evidence_type: 'assessment',
        resource_updated_at_before: core.updated_at,
      });
      service.saveStudyLog({
        resource_id: trial.id,
        source: 'record_only',
        progress_percent: 100,
        progress_text: 'Trial completed',
        next_action: 'Review weak spots',
        evidence_type: 'practice',
        resource_updated_at_before: trial.updated_at,
      });

      const cultivation = service.getProjectCultivation(project.id);
      expect(cultivation.can_breakthrough).toBe(true);
      expect(cultivation.metrics.core_mastery).toBe(100);
      expect(cultivation.metrics.trial_mastery).toBe(100);

      const attempt = service.attemptBreakthrough(project.id);
      expect(attempt.passed).toBe(true);
      expect(attempt.project).toMatchObject({ realm_rank: 1, realm_name: '筑基', realm_layer: 1 });
      expect(attempt.cultivation.can_breakthrough).toBe(false);
      expect(attempt.cultivation.bottlenecks).toContain('上次突破后需要新的出关记录。');

      const row = db.prepare('SELECT passed, dao_foundation_score FROM breakthrough_attempts WHERE id = ?').get(attempt.attempt_id) as {
        passed: number;
        dao_foundation_score: number;
      };
      expect(row.passed).toBe(1);
      expect(row.dao_foundation_score).toBeGreaterThanOrEqual(80);
    } finally {
      db.close();
    }
  });

  it('records bottlenecks when breakthrough requirements are not met', () => {
    const { db, service } = createService();

    try {
      const project = service.createProject({ name: 'Incomplete Dao', description: null });
      service.createResource({
        project_id: project.id,
        title: 'Only core',
        type: 'document',
        open_kind: 'record_only',
        cultivation_role: 'core',
        initial_progress_percent: 80,
      });

      const attempt = service.attemptBreakthrough(project.id);
      expect(attempt.passed).toBe(false);
      expect(attempt.project.realm_rank).toBe(0);
      expect(attempt.cultivation.bottlenecks).toContain('至少需要 1 个突破试炼或练习类资料。');

      const row = db.prepare('SELECT passed, bottleneck_summary FROM breakthrough_attempts WHERE id = ?').get(attempt.attempt_id) as {
        passed: number;
        bottleneck_summary: string;
      };
      expect(row.passed).toBe(0);
      expect(row.bottleneck_summary).toContain('突破试炼');
    } finally {
      db.close();
    }
  });

  it('derives effective study minutes from saved log duration and progress changes', () => {
    const { db, service } = createService();

    try {
      const project = service.createProject({ name: 'Effective Study' });
      const core = service.createResource({
        project_id: project.id,
        title: 'Core lesson',
        type: 'document',
        open_kind: 'record_only',
        cultivation_role: 'core',
        initial_progress_percent: 90,
      });
      const trial = service.createResource({
        project_id: project.id,
        title: 'Trial lesson',
        type: 'exercise',
        open_kind: 'record_only',
        cultivation_role: 'trial',
        initial_progress_percent: 90,
      });

      service.saveStudyLog({
        resource_id: core.id,
        source: 'record_only',
        progress_percent: 100,
        duration_minutes: 60,
        resource_updated_at_before: core.updated_at,
      });
      service.saveStudyLog({
        resource_id: trial.id,
        source: 'record_only',
        progress_percent: 100,
        duration_minutes: 60,
        resource_updated_at_before: trial.updated_at,
      });

      const cultivation = service.getProjectCultivation(project.id);
      expect(cultivation.effective_study_minutes_14d).toBe(120);
      expect(cultivation.effective_study_minutes_remaining).toBe(0);
      expect(cultivation.effective_study_days_14d).toBeGreaterThanOrEqual(1);
      expect(cultivation.missing_duration_log_count).toBe(0);
    } finally {
      db.close();
    }
  });

  it('keeps old logs without duration as soft diagnostics', () => {
    const { db, service } = createService();

    try {
      const project = service.createProject({ name: 'Legacy Logs' });
      const core = service.createResource({
        project_id: project.id,
        title: 'Core legacy',
        type: 'document',
        open_kind: 'record_only',
        cultivation_role: 'core',
        initial_progress_percent: 100,
      });
      const trial = service.createResource({
        project_id: project.id,
        title: 'Trial legacy',
        type: 'exercise',
        open_kind: 'record_only',
        cultivation_role: 'trial',
        initial_progress_percent: 100,
      });

      service.saveStudyLog({
        resource_id: core.id,
        source: 'record_only',
        progress_percent: 100,
        evidence_type: 'assessment',
        resource_updated_at_before: core.updated_at,
      });
      service.saveStudyLog({
        resource_id: trial.id,
        source: 'record_only',
        progress_percent: 100,
        evidence_type: 'practice',
        resource_updated_at_before: trial.updated_at,
      });

      const cultivation = service.getProjectCultivation(project.id);
      expect(cultivation.can_breakthrough).toBe(true);
      expect(cultivation.effective_study_minutes_14d).toBe(0);
      expect(cultivation.missing_duration_log_count).toBe(2);
      expect(cultivation.diagnostic_warnings).toContain('有 2 条出关记录缺少有效学习时长，暂不阻断突破。');
    } finally {
      db.close();
    }
  });

  it('caps unusually long saved durations in cultivation diagnostics', () => {
    const { db, service } = createService();

    try {
      const project = service.createProject({ name: 'Long Session' });
      const core = service.createResource({
        project_id: project.id,
        title: 'Core long',
        type: 'document',
        open_kind: 'record_only',
        cultivation_role: 'core',
        initial_progress_percent: 100,
      });

      service.saveStudyLog({
        resource_id: core.id,
        source: 'record_only',
        progress_percent: 100,
        duration_minutes: 1440,
        evidence_type: 'assessment',
        resource_updated_at_before: core.updated_at,
      });

      const cultivation = service.getProjectCultivation(project.id);
      expect(cultivation.effective_study_minutes_14d).toBe(180);
      expect(cultivation.capped_duration_log_count).toBe(1);
      expect(cultivation.diagnostic_warnings).toContain('有 1 条出关记录超过 180 分钟，已按上限计入。');
    } finally {
      db.close();
    }
  });

  it('does not count pending duration until the pending session is saved as a study log', async () => {
    const { db, service } = createService();
    const tempDir = mkdtempSync(path.join(tmpdir(), 'cultivation-pending-duration-'));
    const tempFile = path.join(tempDir, 'lesson.txt');
    writeFileSync(tempFile, 'lesson');
    shellMocks.openPath.mockResolvedValue('');

    try {
      const project = service.createProject({ name: 'Pending Duration' });
      const resource = service.createResource({
        project_id: project.id,
        title: 'Timed pending lesson',
        type: 'document',
        open_kind: 'file',
        path_or_url: tempFile,
        initial_progress_percent: 20,
      });
      const opened = await service.continueResource({ resource_id: resource.id });
      expect(opened.result).toBe('opened');

      db.prepare('UPDATE pending_study_sessions SET closed_at = ?, duration_minutes = ?, close_source = ? WHERE id = ?').run(
        new Date().toISOString(),
        45,
        'user_ended',
        opened.pending?.id,
      );

      expect(service.getProjectCultivation(project.id).effective_study_minutes_14d).toBe(0);

      service.saveStudyLog({
        resource_id: resource.id,
        source: 'pending',
        progress_percent: 45,
        resource_updated_at_before: opened.pending?.resource_updated_at_before ?? '',
      });

      expect(service.getProjectCultivation(project.id).effective_study_minutes_14d).toBe(45);
    } finally {
      db.close();
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('uses non-reference exercise resources as trial fallback in service cultivation output', () => {
    const { db, service } = createService();

    try {
      const project = service.createProject({ name: 'Exercise Fallback' });
      service.createResource({
        project_id: project.id,
        title: 'Core',
        type: 'document',
        open_kind: 'record_only',
        cultivation_role: 'core',
        initial_progress_percent: 100,
      });
      service.createResource({
        project_id: project.id,
        title: 'Supplement exercise',
        type: 'exercise',
        open_kind: 'record_only',
        cultivation_role: 'supplement',
        initial_progress_percent: 100,
      });
      const referenceProject = service.createProject({ name: 'Reference Exercise' });
      service.createResource({
        project_id: referenceProject.id,
        title: 'Reference exercise',
        type: 'exercise',
        open_kind: 'record_only',
        cultivation_role: 'reference',
        initial_progress_percent: 100,
      });

      expect(service.getProjectCultivation(project.id).trial_resource_count).toBe(1);
      expect(service.getProjectCultivation(referenceProject.id).trial_resource_count).toBe(0);
    } finally {
      db.close();
    }
  });

  it('preserves omitted progress text and next action when saving a compact study log', () => {
    const { db, service } = createService();

    try {
      const project = service.createProject({ name: 'Compact Study' });
      const resource = service.createResource({
        project_id: project.id,
        title: 'Minimal record',
        type: 'document',
        open_kind: 'record_only',
        initial_progress_percent: 20,
        initial_progress_text: 'Keep the current marker',
        initial_next_action: 'Keep the next step',
      });

      const saved = service.saveStudyLog({
        resource_id: resource.id,
        source: 'record_only',
        progress_percent: 35,
        duration_minutes: 12,
        resource_updated_at_before: resource.updated_at,
      });

      expect(saved.log).toMatchObject({
        duration_minutes: 12,
        progress_before_percent: 20,
        progress_after_percent: 35,
        next_action: 'Keep the next step',
      });
      expect(saved.resource).toMatchObject({
        progress_percent: 35,
        progress_text: 'Keep the current marker',
        next_action: 'Keep the next step',
      });
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

  it('records pending close time and uses its duration when saving the study log', async () => {
    const { db, service } = createService();
    const tempDir = mkdtempSync(path.join(tmpdir(), 'cultivation-service-'));
    const tempFile = path.join(tempDir, 'lesson.txt');
    writeFileSync(tempFile, 'lesson');
    shellMocks.openPath.mockResolvedValue('');

    try {
      const project = service.createProject({ name: 'Close Time Study' });
      const resource = service.createResource({
        project_id: project.id,
        title: 'Timed lesson',
        type: 'document',
        open_kind: 'file',
        path_or_url: tempFile,
        initial_progress_percent: 10,
      });
      const opened = await service.continueResource({ resource_id: resource.id });
      expect(opened.result).toBe('opened');

      const closed = service.closePendingSession({ session_id: opened.pending?.id ?? '', close_source: 'user_ended' });
      expect(closed.closed_at).toBeTruthy();
      expect(closed.close_source).toBe('user_ended');
      expect(closed.duration_minutes).toBeGreaterThanOrEqual(0);

      const saved = service.saveStudyLog({
        resource_id: resource.id,
        source: 'pending',
        progress_percent: 25,
        progress_text: 'Closed and recorded',
        resource_updated_at_before: opened.pending?.resource_updated_at_before ?? '',
      });
      expect(saved.log.duration_minutes).toBe(closed.duration_minutes);
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
