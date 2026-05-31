import { existsSync, realpathSync, statSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

import { shell } from 'electron';
import type { Database } from 'better-sqlite3';

import { calcProjectProgress } from '../../shared/calc';
import { deriveProjectStatus } from '../../shared/derive';
import type { ResourceStatus } from '../../shared/enums';
import { AppError } from '../../shared/errors';
import { normalizeStatusAndProgress } from '../../shared/normalize';
import type {
  ContinueResourceInput,
  ContinueResourceOutput,
  CreateProjectInput,
  CreateResourceInput,
  GetHomeOverviewOutput,
  GetProjectDetailOutput,
  Page,
  PendingSessionView,
  ProjectSummary,
  ResourceDetail,
  ResourceSummary,
  SaveStudyLogInput,
  SaveStudyLogOutput,
  StudyLogView,
  UpdateProjectInput,
  UpdateResourceInput,
} from '../../shared/dto';

type ResourceRow = {
  id: string;
  project_id: string;
  title: string;
  type: string;
  open_kind: string;
  path_or_url: string | null;
  status: ResourceStatus;
  progress_text: string | null;
  progress_percent: number;
  next_action: string | null;
  created_at: string;
  updated_at: string;
  last_opened_at: string | null;
  last_studied_at: string | null;
};

type ProjectRow = {
  id: string;
  name: string;
  status: ResourceStatus;
  created_at: string;
  updated_at: string;
  last_studied_at: string | null;
};

type PendingRow = {
  id: string;
  project_id: string;
  resource_id: string;
  resource_title_snapshot: string;
  current_resource_title: string | null;
  opened_at: string;
  progress_before_text: string | null;
  progress_before_percent: number;
  status_before: ResourceStatus;
  next_action_before: string | null;
  resource_updated_at_before: string;
};

type StudyLogRow = {
  id: string;
  resource_id: string | null;
  resource_title_snapshot: string;
  studied_at: string;
  duration_minutes: number | null;
  content: string | null;
  progress_before_percent: number;
  progress_after_percent: number;
  status_before: ResourceStatus;
  status_after: ResourceStatus;
  next_action: string | null;
};

export class CultivationService {
  private readonly db: Database;
  private continueResourceBusy = false;
  private readonly riskConfirmTokens = new Map<string, RiskConfirmToken>();

  constructor(db: Database) {
    this.db = db;
  }

  getHomeOverview(): GetHomeOverviewOutput {
    const recommended = this.getRecommendedResource();
    const recommendedProjectProgress = recommended ? this.getProjectProgress(recommended.project_id) : null;
    const recommendedProjectName = recommended ? this.getProjectName(recommended.project_id) : null;

    return {
      recommended,
      recommended_project_name: recommendedProjectName,
      recommended_project_progress: recommendedProjectProgress,
      pending: this.getPendingSession(),
      projects: this.listProjects({ limit: 50, offset: 0 }).items,
      recent_logs: this.listRecentLogs(5),
      last_saved_at: this.getLastSavedAt(),
    };
  }

  listProjects(input: { limit?: number; offset?: number } = {}): Page<ProjectSummary> {
    const limit = input.limit ?? 50;
    const offset = input.offset ?? 0;
    const rows = this.db
      .prepare(
        `SELECT p.*,
                COUNT(r.id) AS resource_count,
                COALESCE(ROUND(AVG(r.progress_percent)), 0) AS progress_percent
           FROM projects p
           LEFT JOIN resources r ON r.project_id = p.id
          GROUP BY p.id
          ORDER BY COALESCE(p.last_studied_at, p.updated_at) DESC, p.created_at DESC, p.id ASC
          LIMIT ? OFFSET ?`,
      )
      .all(limit, offset) as (ProjectRow & { resource_count: number; progress_percent: number })[];
    const total = this.db.prepare('SELECT COUNT(*) AS count FROM projects').get() as { count: number };

    return {
      items: rows.map((row) => this.projectSummaryFromRow(row)),
      total: total.count,
      limit,
      offset,
    };
  }

  getProjectDetail(input: { project_id: string; limit?: number; offset?: number }): GetProjectDetailOutput {
    const project = this.getProjectSummary(input.project_id);
    const limit = input.limit ?? 100;
    const offset = input.offset ?? 0;
    const rows = this.db
      .prepare(
        `SELECT * FROM resources
          WHERE project_id = ?
          ORDER BY
            CASE status WHEN 'learning' THEN 0 WHEN 'review' THEN 1 WHEN 'not_started' THEN 2 WHEN 'paused' THEN 3 ELSE 4 END,
            COALESCE(last_studied_at, updated_at) DESC,
            created_at DESC,
            id ASC
          LIMIT ? OFFSET ?`,
      )
      .all(input.project_id, limit, offset) as ResourceRow[];
    const total = this.db.prepare('SELECT COUNT(*) AS count FROM resources WHERE project_id = ?').get(input.project_id) as { count: number };

    return {
      project,
      resources: {
        items: rows.map(resourceSummaryFromRow),
        total: total.count,
        limit,
        offset,
      },
      recent_logs: this.listRecentLogs(5, input.project_id),
    };
  }

  createProject(input: CreateProjectInput): ProjectSummary {
    const now = timestamp();
    const id = randomUUID();

    this.guardWrite(() => {
      this.db
        .prepare('INSERT INTO projects (id, name, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(id, input.name.trim(), trimNullable(input.description), 'not_started', now, now);
    });

    return this.getProjectSummary(id);
  }

  updateProject(input: UpdateProjectInput): ProjectSummary {
    const current = this.getProjectRow(input.project_id);
    const now = timestamp();
    const description = input.description === undefined ? current.description : trimNullable(input.description);

    this.guardWrite(() => {
      const result = this.db
        .prepare('UPDATE projects SET name = ?, description = ?, updated_at = ? WHERE id = ?')
        .run(input.name.trim(), description, now, input.project_id);
      assertChanged(result.changes);
    });

    return this.getProjectSummary(input.project_id);
  }

  deleteProject(projectId: string): { deleted: true } {
    this.guardWrite(() => {
      const result = this.db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);
      assertChanged(result.changes);
    });
    return { deleted: true };
  }

  createResource(input: CreateResourceInput): ResourceSummary {
    this.assertProjectExists(input.project_id);
    validateOpenTarget(input.open_kind, input.path_or_url);
    const normalized = normalizeStatusAndProgress({
      status: input.initial_status,
      progress_percent: input.initial_progress_percent ?? 0,
    });
    const now = timestamp();
    const id = randomUUID();

    this.guardWrite(() => {
      this.db
        .prepare(
          `INSERT INTO resources (
            id, project_id, title, type, open_kind, path_or_url, status, progress_text,
            progress_percent, next_action, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          input.project_id,
          input.title.trim(),
          input.type,
          input.open_kind,
          normalizedPath(input.open_kind, input.path_or_url),
          normalized.status,
          trimNullable(input.initial_progress_text),
          normalized.progress_percent,
          trimNullable(input.initial_next_action),
          now,
          now,
        );
      this.rederiveProject(input.project_id, now);
    });

    return this.getResourceSummary(id);
  }

  updateResource(input: UpdateResourceInput): ResourceSummary {
    const current = this.getResourceRow(input.resource_id);
    validateOpenTarget(input.open_kind, input.path_or_url);
    const normalized = normalizeStatusAndProgress({
      status: input.status ?? current.status,
      progress_percent: current.progress_percent,
    });
    const now = timestamp();

    this.guardWrite(() => {
      this.db
        .prepare(
          `UPDATE resources
              SET title = ?, type = ?, open_kind = ?, path_or_url = ?, status = ?,
                  progress_percent = ?, updated_at = ?
            WHERE id = ?`,
        )
        .run(
          input.title.trim(),
          input.type,
          input.open_kind,
          normalizedPath(input.open_kind, input.path_or_url),
          normalized.status,
          normalized.progress_percent,
          now,
          input.resource_id,
        );
      this.rederiveProject(current.project_id, now);
    });

    return this.getResourceSummary(input.resource_id);
  }

  deleteResource(resourceId: string): { deleted: true } {
    const current = this.getResourceRow(resourceId);
    const now = timestamp();

    this.guardWrite(() => {
      const result = this.db.prepare('DELETE FROM resources WHERE id = ?').run(resourceId);
      assertChanged(result.changes);
      this.rederiveProject(current.project_id, now);
    });

    return { deleted: true };
  }

  getResourceDetail(resourceId: string): ResourceDetail {
    const row = this.getResourceRow(resourceId);
    return {
      ...resourceSummaryFromRow(row),
      path_or_url_display: displayTarget(row.path_or_url),
      path_or_url_raw: row.path_or_url,
      recent_logs: this.listRecentLogs(10, row.project_id, row.id),
    };
  }

  async continueResource(input: ContinueResourceInput): Promise<ContinueResourceOutput> {
    if (this.continueResourceBusy) {
      return { result: 'blocked', block_level: 'hard', block_reason: '正在处理上一次打开请求，请稍后再试。' };
    }

    this.continueResourceBusy = true;
    try {
      const resource = this.getResourceRow(input.resource_id);
      const existingPending = this.getPendingSession();

      if (existingPending) {
        return { result: 'pending_conflict', conflict_existing: existingPending };
      }

      if (resource.open_kind === 'record_only') {
        return { result: 'record_only' };
      }

      const target = resource.path_or_url?.trim();
      if (!target) {
        return { result: 'open_failed', open_error_code: 'PATH_NOT_FOUND' };
      }

      const risk = evaluateWarnRisk(resource.open_kind, target);
      if (risk && !this.consumeRiskToken(input.risk_confirm_token, resource, target, risk)) {
        return {
          result: 'blocked',
          block_level: 'warn',
          block_reason: risk,
          risk_confirm_token: this.createRiskToken(resource, target, risk),
        };
      }

      const openError = await openExternalResource(resource.open_kind, target);
      if (openError) {
        return { result: 'open_failed', open_error_code: openError };
      }

      const now = timestamp();
      let pending: PendingSessionView | null = null;
      this.guardWrite(() => {
        this.db.prepare('UPDATE resources SET last_opened_at = ? WHERE id = ?').run(now, resource.id);
        this.db
          .prepare(
            `INSERT INTO pending_study_sessions (
              id, project_id, resource_id, resource_title_snapshot, opened_at,
              progress_before_text, progress_before_percent, status_before,
              next_action_before, resource_updated_at_before, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            randomUUID(),
            resource.project_id,
            resource.id,
            resource.title,
            now,
            resource.progress_text,
            resource.progress_percent,
            resource.status,
            resource.next_action,
            resource.updated_at,
            now,
          );
        pending = this.getPendingSession();
      });

      return { result: 'opened', pending: pending ?? undefined };
    } finally {
      this.continueResourceBusy = false;
    }
  }

  saveStudyLog(input: SaveStudyLogInput): SaveStudyLogOutput {
    const resource = this.getResourceRow(input.resource_id);
    const pending = this.getPendingSession();

    if (input.source === 'pending' && (!pending || pending.resource_id !== input.resource_id)) {
      throw new AppError({ code: 'VALIDATION_FAILED', details: { source: 'pending_without_matching_session' } });
    }

    if (input.source !== 'pending' && pending?.resource_id === input.resource_id) {
      throw new AppError({ code: 'VALIDATION_FAILED', details: { source: 'use_pending_for_active_session' } });
    }

    if (resource.updated_at !== input.resource_updated_at_before && !input.confirm_overwrite) {
      throw new AppError({ code: 'VALIDATION_FAILED', details: { conflict: true } });
    }

    const beforeProgressText = input.source === 'pending' && pending ? pending.progress_before_text : resource.progress_text;
    const beforeProgressPercent = input.source === 'pending' && pending ? pending.progress_before_percent : resource.progress_percent;
    const beforeStatus = input.source === 'pending' && pending ? pending.status_before : resource.status;
    const beforeNextAction = input.source === 'pending' && pending ? pending.next_action_before : resource.next_action;
    const normalized = normalizeStatusAndProgress({
      status: input.status,
      progress_percent: input.progress_percent,
    });
    const now = timestamp();
    const progressDelta = normalized.progress_percent - beforeProgressPercent;
    const logId = randomUUID();

    this.guardWrite(() => {
      this.db
        .prepare(
          `INSERT INTO study_logs (
            id, project_id, resource_id, resource_title_snapshot, studied_at, duration_minutes, content,
            progress_before_text, progress_before_percent, progress_after_text, progress_after_percent,
            status_before, status_after, next_action_before, next_action, resource_updated_at_before, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          logId,
          resource.project_id,
          resource.id,
          resource.title,
          now,
          input.duration_minutes ?? null,
          trimNullable(input.content),
          beforeProgressText,
          beforeProgressPercent,
          trimNullable(input.progress_text),
          normalized.progress_percent,
          beforeStatus,
          normalized.status,
          beforeNextAction,
          trimNullable(input.next_action),
          input.resource_updated_at_before,
          now,
        );

      this.db
        .prepare(
          `UPDATE resources
              SET progress_text = ?, progress_percent = ?, next_action = ?, status = ?,
                  last_studied_at = ?, updated_at = ?
            WHERE id = ?`,
        )
        .run(
          trimNullable(input.progress_text),
          normalized.progress_percent,
          trimNullable(input.next_action),
          normalized.status,
          now,
          now,
          resource.id,
        );

      if (input.source === 'pending') {
        this.db.prepare('DELETE FROM pending_study_sessions WHERE resource_id = ?').run(resource.id);
      }

      this.rederiveProject(resource.project_id, now);
    });

    return {
      log: this.getStudyLogView(logId),
      resource: this.getResourceSummary(resource.id),
      project_progress_percent: this.getProjectProgress(resource.project_id),
      progress_delta: progressDelta,
      feedback_kind: normalized.progress_percent === 100 ? 'completed' : progressDelta > 0 ? 'increased' : progressDelta < 0 ? 'decreased' : 'unchanged',
    };
  }

  getPendingSession(): PendingSessionView | null {
    const row = this.db
      .prepare(
        `SELECT ps.*, r.title AS current_resource_title
           FROM pending_study_sessions ps
           LEFT JOIN resources r ON r.id = ps.resource_id
          ORDER BY ps.created_at DESC
          LIMIT 1`,
      )
      .get() as PendingRow | undefined;
    return row ? pendingFromRow(row) : null;
  }

  abandonPendingSession(sessionId: string): { abandoned: true } {
    this.guardWrite(() => {
      const result = this.db.prepare('DELETE FROM pending_study_sessions WHERE id = ?').run(sessionId);
      assertChanged(result.changes);
    });
    return { abandoned: true };
  }

  private getProjectSummary(projectId: string): ProjectSummary {
    const row = this.db
      .prepare(
        `SELECT p.*,
                COUNT(r.id) AS resource_count,
                COALESCE(ROUND(AVG(r.progress_percent)), 0) AS progress_percent
           FROM projects p
           LEFT JOIN resources r ON r.project_id = p.id
          WHERE p.id = ?
          GROUP BY p.id`,
      )
      .get(projectId) as (ProjectRow & { resource_count: number; progress_percent: number }) | undefined;
    if (!row) {
      throw new AppError({ code: 'NOT_FOUND' });
    }
    return this.projectSummaryFromRow(row);
  }

  private getProjectRow(projectId: string): ProjectRow & { description: string | null } {
    const row = this.db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as (ProjectRow & { description: string | null }) | undefined;
    if (!row) {
      throw new AppError({ code: 'NOT_FOUND' });
    }
    return row;
  }

  private getResourceSummary(resourceId: string): ResourceSummary {
    return resourceSummaryFromRow(this.getResourceRow(resourceId));
  }

  private getResourceRow(resourceId: string): ResourceRow {
    const row = this.db.prepare('SELECT * FROM resources WHERE id = ?').get(resourceId) as ResourceRow | undefined;
    if (!row) {
      throw new AppError({ code: 'NOT_FOUND' });
    }
    return row;
  }

  private getStudyLogView(logId: string): StudyLogView {
    const row = this.db.prepare('SELECT * FROM study_logs WHERE id = ?').get(logId) as StudyLogRow | undefined;
    if (!row) {
      throw new AppError({ code: 'NOT_FOUND' });
    }
    return studyLogFromRow(row);
  }

  private listRecentLogs(limit: number, projectId?: string, resourceId?: string): StudyLogView[] {
    const clauses = [];
    const args: unknown[] = [];
    if (projectId) {
      clauses.push('project_id = ?');
      args.push(projectId);
    }
    if (resourceId) {
      clauses.push('resource_id = ?');
      args.push(resourceId);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = this.db
      .prepare(`SELECT * FROM study_logs ${where} ORDER BY studied_at DESC, created_at DESC, id ASC LIMIT ?`)
      .all(...args, limit) as StudyLogRow[];
    return rows.map(studyLogFromRow);
  }

  private getRecommendedResource(): ResourceSummary | null {
    const rows = this.db
      .prepare(
        `SELECT * FROM resources
          WHERE status IN ('learning', 'review', 'not_started')
          ORDER BY
            CASE status WHEN 'learning' THEN 0 WHEN 'review' THEN 1 ELSE 2 END,
            CASE WHEN last_studied_at IS NULL THEN 1 ELSE 0 END,
            last_studied_at DESC,
            updated_at DESC,
            created_at ASC,
            id ASC
          LIMIT 1`,
      )
      .all() as ResourceRow[];
    return rows[0] ? resourceSummaryFromRow(rows[0]) : null;
  }

  private getProjectProgress(projectId: string): number {
    const rows = this.db.prepare('SELECT progress_percent FROM resources WHERE project_id = ?').all(projectId) as { progress_percent: number }[];
    return calcProjectProgress(rows.map((row) => row.progress_percent));
  }

  private getProjectName(projectId: string): string | null {
    const row = this.db.prepare('SELECT name FROM projects WHERE id = ?').get(projectId) as { name: string } | undefined;
    return row?.name ?? null;
  }

  private getLastSavedAt(): string | null {
    const row = this.db
      .prepare(
        `SELECT MAX(saved_at) AS saved_at
           FROM (
             SELECT updated_at AS saved_at FROM projects
             UNION ALL SELECT updated_at AS saved_at FROM resources
             UNION ALL SELECT created_at AS saved_at FROM study_logs
             UNION ALL SELECT created_at AS saved_at FROM pending_study_sessions
           )`,
      )
      .get() as { saved_at: string | null };
    return row.saved_at;
  }

  private assertProjectExists(projectId: string): void {
    const row = this.db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId);
    if (!row) {
      throw new AppError({ code: 'NOT_FOUND' });
    }
  }

  private rederiveProject(projectId: string, now: string): void {
    const rows = this.db.prepare('SELECT status FROM resources WHERE project_id = ?').all(projectId) as { status: ResourceStatus }[];
    const status = deriveProjectStatus(rows.map((row) => row.status));
    const lastStudied = this.db
      .prepare('SELECT MAX(last_studied_at) AS last_studied_at FROM resources WHERE project_id = ?')
      .get(projectId) as { last_studied_at: string | null };

    this.db.prepare('UPDATE projects SET status = ?, last_studied_at = ?, updated_at = ? WHERE id = ?').run(status, lastStudied.last_studied_at, now, projectId);
  }

  private projectSummaryFromRow(row: ProjectRow & { resource_count: number; progress_percent: number }): ProjectSummary {
    return {
      id: row.id,
      name: row.name,
      status: row.status,
      progress_percent: Number(row.progress_percent),
      resource_count: Number(row.resource_count),
      last_studied_at: row.last_studied_at,
      updated_at: row.updated_at,
      created_at: row.created_at,
    };
  }

  private guardWrite<T>(work: () => T): T {
    try {
      return this.db.transaction(work)();
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError({ code: 'TRANSACTION_FAILED', cause: error });
    }
  }

  private createRiskToken(resource: ResourceRow, target: string, reason: string): string {
    const token = randomUUID();
    this.riskConfirmTokens.set(token, {
      resource_id: resource.id,
      resource_updated_at: resource.updated_at,
      target,
      reason,
      expires_at: Date.now() + 5 * 60 * 1000,
    });
    return token;
  }

  private consumeRiskToken(token: string | undefined, resource: ResourceRow, target: string, reason: string): boolean {
    if (!token) {
      return false;
    }

    const saved = this.riskConfirmTokens.get(token);
    this.riskConfirmTokens.delete(token);

    return (
      !!saved &&
      saved.resource_id === resource.id &&
      saved.resource_updated_at === resource.updated_at &&
      saved.target === target &&
      saved.reason === reason &&
      saved.expires_at >= Date.now()
    );
  }
}

type RiskConfirmToken = {
  resource_id: string;
  resource_updated_at: string;
  target: string;
  reason: string;
  expires_at: number;
};

function resourceSummaryFromRow(row: ResourceRow): ResourceSummary {
  return {
    id: row.id,
    project_id: row.project_id,
    title: row.title,
    type: row.type as ResourceSummary['type'],
    open_kind: row.open_kind as ResourceSummary['open_kind'],
    status: row.status,
    progress_text: row.progress_text,
    progress_percent: row.progress_percent,
    next_action: row.next_action,
    last_opened_at: row.last_opened_at,
    last_studied_at: row.last_studied_at,
    updated_at: row.updated_at,
    created_at: row.created_at,
  };
}

function pendingFromRow(row: PendingRow): PendingSessionView {
  return {
    id: row.id,
    project_id: row.project_id,
    resource_id: row.resource_id,
    resource_title_snapshot: row.resource_title_snapshot,
    current_resource_title: row.current_resource_title,
    opened_at: row.opened_at,
    progress_before_text: row.progress_before_text,
    progress_before_percent: row.progress_before_percent,
    status_before: row.status_before,
    next_action_before: row.next_action_before,
    resource_updated_at_before: row.resource_updated_at_before,
  };
}

function studyLogFromRow(row: StudyLogRow): StudyLogView {
  return {
    id: row.id,
    resource_id: row.resource_id,
    resource_title_snapshot: row.resource_title_snapshot,
    studied_at: row.studied_at,
    duration_minutes: row.duration_minutes,
    content: row.content,
    progress_before_percent: row.progress_before_percent,
    progress_after_percent: row.progress_after_percent,
    status_before: row.status_before,
    status_after: row.status_after,
    next_action: row.next_action,
  };
}

function timestamp(): string {
  return new Date().toISOString();
}

function trimNullable(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function validateOpenTarget(openKind: string, target: string | null | undefined): void {
  const trimmed = target?.trim();
  if (openKind === 'record_only') {
    if (trimmed) {
      throw new AppError({ code: 'VALIDATION_FAILED', details: { field: 'path_or_url' } });
    }
    return;
  }

  if (!trimmed) {
    throw new AppError({ code: 'VALIDATION_FAILED', details: { field: 'path_or_url' } });
  }

  if (openKind === 'url') {
    validateHttpUrl(trimmed);
    return;
  }

  if (!path.isAbsolute(trimmed) || trimmed.includes('\0') || hasUnresolvedParentSegment(trimmed)) {
    throw new AppError({ code: 'PATH_BLOCKED', details: { reason: 'unsafe_path' } });
  }

  if (isBlockedLocalPath(trimmed)) {
    throw new AppError({ code: 'PATH_BLOCKED', details: { reason: 'blocked_path' } });
  }
}

function validateHttpUrl(value: string): void {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new AppError({ code: 'INVALID_URL' });
  }

  if (!parsed.hostname) {
    throw new AppError({ code: 'INVALID_URL' });
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new AppError({ code: 'UNSUPPORTED_URL_SCHEME' });
  }

  if (parsed.username || parsed.password || hasControlCharacter(value)) {
    throw new AppError({ code: 'INVALID_URL' });
  }
}

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some((char) => {
    const code = char.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}

function normalizedPath(openKind: string, target: string | null | undefined): string | null {
  return openKind === 'record_only' ? null : target?.trim() ?? null;
}

async function openExternalResource(openKind: string, target: string): Promise<string | null> {
  if (openKind === 'url') {
    try {
      validateHttpUrl(target);
      await shell.openExternal(target);
      return null;
    } catch (error) {
      if (error instanceof AppError) {
        return error.code;
      }
      return 'PERMISSION_DENIED';
    }
  }

  if (!existsSync(target)) {
    return 'PATH_NOT_FOUND';
  }

  let resolvedTarget: string;
  try {
    resolvedTarget = realpathSync(target);
  } catch {
    return 'PATH_NOT_FOUND';
  }

  if (!path.isAbsolute(resolvedTarget) || resolvedTarget.includes('\0') || hasUnresolvedParentSegment(resolvedTarget)) {
    return 'PATH_BLOCKED';
  }

  if (isBlockedLocalPath(resolvedTarget)) {
    return 'PATH_BLOCKED';
  }

  try {
    const stat = statSync(resolvedTarget);
    if ((openKind === 'file' && !stat.isFile()) || (openKind === 'folder' && !stat.isDirectory())) {
      return 'PATH_NOT_FOUND';
    }
    const result = await shell.openPath(resolvedTarget);
    return result ? 'PERMISSION_DENIED' : null;
  } catch {
    return 'PERMISSION_DENIED';
  }
}

function evaluateWarnRisk(openKind: string, target: string): string | null {
  if (openKind !== 'url') {
    return isMacroDocument(target) ? '该文件可能包含宏，打开前需要确认一次。' : null;
  }

  const parsed = new URL(target);
  if (parsed.protocol === 'http:') {
    return '该链接使用未加密的 http，需要确认后打开一次。';
  }

  if (isWarnOnlyHost(parsed.hostname)) {
    return '该链接指向本机或局域网地址，需要确认后打开一次。';
  }

  return null;
}

function isBlockedLocalPath(target: string): boolean {
  const normalized = path.normalize(target);
  const basename = path.basename(normalized);
  const extension = path.extname(basename).toLowerCase();
  const dangerousExtensions = new Set([
    '.bat',
    '.cmd',
    '.com',
    '.cpl',
    '.exe',
    '.hta',
    '.jar',
    '.js',
    '.jse',
    '.lnk',
    '.msi',
    '.ps1',
    '.reg',
    '.scf',
    '.scr',
    '.url',
    '.vbe',
    '.vbs',
    '.wsf',
  ]);

  if (normalized.startsWith('\\\\') || normalized.startsWith('\\\\?\\') || normalized.startsWith('\\\\.\\')) {
    return true;
  }

  if (dangerousExtensions.has(extension)) {
    return true;
  }

  return basename.includes(':');
}

function isMacroDocument(target: string): boolean {
  return new Set(['.docm', '.xlsm', '.pptm']).has(path.extname(target).toLowerCase());
}

function hasUnresolvedParentSegment(target: string): boolean {
  return target.split(/[\\/]+/).includes('..');
}

function isWarnOnlyHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (lower === 'localhost' || lower === '127.0.0.1' || lower === '::1' || lower.endsWith('.local')) {
    return true;
  }

  if (['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly'].includes(lower)) {
    return true;
  }

  return isPrivateIpv4(lower);
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [a, b] = parts;
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
}

function displayTarget(target: string | null): string | null {
  if (!target) {
    return null;
  }

  if (target.length <= 80) {
    return target;
  }

  return `${target.slice(0, 28)}...${target.slice(-40)}`;
}

function assertChanged(changes: number): void {
  if (changes < 1) {
    throw new AppError({ code: 'NOT_FOUND' });
  }
}
