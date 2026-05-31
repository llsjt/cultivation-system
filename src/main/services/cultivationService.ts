import { randomUUID } from 'node:crypto';

import type { Database } from 'better-sqlite3';

import { calcProjectProgress } from '../../shared/calc';
import { deriveProjectStatus } from '../../shared/derive';
import type { CultivationRole, ResourceStatus, StudyEvidenceType } from '../../shared/enums';
import { AppError } from '../../shared/errors';
import { normalizeStatusAndProgress } from '../../shared/normalize';
import { evaluateProjectCultivation, getRealmName, type CultivationLogSnapshot, type CultivationResourceSnapshot, type ProjectCultivationState } from '../../shared/realm';
import { canOpenInControlledWindow, displayTarget, evaluateWarnRisk, normalizedPath, openControlledResource, openExternalResource, validateOpenTarget } from '../opener/resourceOpener';
import type {
  AttemptBreakthroughOutput,
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
  cultivation_role: CultivationRole;
  mastery_group: string | null;
  mastery_weight: number;
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
  realm_rank: number;
  realm_layer: number;
  last_breakthrough_at: string | null;
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
  closed_at: string | null;
  duration_minutes: number | null;
  close_source: PendingCloseSource | null;
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
  evidence_type: StudyEvidenceType | null;
};

type PendingCloseSource = 'viewer_closed' | 'user_ended' | 'app_recovered';

type CultivationServiceOptions = {
  onPendingSessionClosed?: (pending: PendingSessionView) => void;
};

export class CultivationService {
  private readonly db: Database;
  private continueResourceBusy = false;
  private readonly riskConfirmTokens = new Map<string, RiskConfirmToken>();
  private readonly onPendingSessionClosed?: (pending: PendingSessionView) => void;

  constructor(db: Database, options: CultivationServiceOptions = {}) {
    this.db = db;
    this.onPendingSessionClosed = options.onPendingSessionClosed;
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
            id, project_id, title, type, open_kind, path_or_url, cultivation_role, mastery_group,
            mastery_weight, status, progress_text,
            progress_percent, next_action, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          input.project_id,
          input.title.trim(),
          input.type,
          input.open_kind,
          normalizedPath(input.open_kind, input.path_or_url),
          input.cultivation_role ?? 'core',
          trimNullable(input.mastery_group),
          input.mastery_weight ?? 1,
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
              SET title = ?, type = ?, open_kind = ?, path_or_url = ?, cultivation_role = ?,
                  mastery_group = ?, mastery_weight = ?, status = ?, progress_percent = ?, updated_at = ?
            WHERE id = ?`,
        )
        .run(
          input.title.trim(),
          input.type,
          input.open_kind,
          normalizedPath(input.open_kind, input.path_or_url),
          input.cultivation_role,
          trimNullable(input.mastery_group),
          input.mastery_weight,
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

  getProjectCultivation(projectId: string): ProjectCultivationState {
    const project = this.getProjectRow(projectId);
    return evaluateProjectCultivation({
      project_id: project.id,
      realm_rank: project.realm_rank,
      last_breakthrough_at: project.last_breakthrough_at,
      resources: this.listCultivationResources(project.id),
      logs: this.listCultivationLogs(project.id),
    });
  }

  attemptBreakthrough(projectId: string): AttemptBreakthroughOutput {
    const project = this.getProjectRow(projectId);
    const cultivation = this.getProjectCultivation(projectId);
    const now = timestamp();
    const attemptId = randomUUID();
    const targetRealmRank = Math.min(4, project.realm_rank + 1);
    const bottleneckSummary = cultivation.bottlenecks.length > 0 ? cultivation.bottlenecks.join('\n') : null;

    this.guardWrite(() => {
      this.db
        .prepare(
          `INSERT INTO breakthrough_attempts (
            id, project_id, from_realm_rank, from_realm_layer, target_realm_rank,
            dao_foundation_score, passed, bottleneck_summary, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          attemptId,
          project.id,
          project.realm_rank,
          project.realm_layer,
          targetRealmRank,
          cultivation.dao_foundation_score,
          cultivation.can_breakthrough ? 1 : 0,
          bottleneckSummary,
          now,
        );

      if (cultivation.can_breakthrough) {
        this.db
          .prepare('UPDATE projects SET realm_rank = ?, realm_layer = ?, last_breakthrough_at = ?, updated_at = ? WHERE id = ?')
          .run(targetRealmRank, 1, now, now, project.id);
      }
    });

    const nextProject = this.getProjectSummary(project.id);
    const nextCultivation = this.getProjectCultivation(project.id);
    return {
      passed: cultivation.can_breakthrough,
      attempt_id: attemptId,
      message: cultivation.can_breakthrough ? `成功突破至${nextProject.realm_name}。` : nextCultivation.bottlenecks[0] ?? '暂未满足突破条件。',
      project: nextProject,
      cultivation: nextCultivation,
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

      const now = timestamp();
      let pending: PendingSessionView | null = null;

      if (canOpenInControlledWindow(resource.open_kind, target)) {
        pending = this.createPendingSession(resource, now);
        const openError = await openControlledResource(resource.open_kind, target, () => {
          try {
            const closed = this.closePendingSession({ session_id: pending?.id ?? '', close_source: 'viewer_closed' });
            this.onPendingSessionClosed?.(closed);
          } catch {
            // Closing a viewer after the pending session was saved or abandoned is harmless.
          }
        });
        if (openError) {
          this.guardWrite(() => {
            this.db.prepare('DELETE FROM pending_study_sessions WHERE id = ?').run(pending?.id);
            this.db.prepare('UPDATE resources SET last_opened_at = ? WHERE id = ?').run(resource.last_opened_at, resource.id);
          });
          return { result: 'open_failed', open_error_code: openError };
        }
      } else {
        const openError = await openExternalResource(resource.open_kind, target);
        if (openError) {
          return { result: 'open_failed', open_error_code: openError };
        }

        pending = this.createPendingSession(resource, now);
      }

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
    const afterProgressText = input.progress_text === undefined ? resource.progress_text : trimNullable(input.progress_text);
    const afterNextAction = input.next_action === undefined ? resource.next_action : trimNullable(input.next_action);
    const now = timestamp();
    const progressDelta = normalized.progress_percent - beforeProgressPercent;
    const logId = randomUUID();

    this.guardWrite(() => {
      this.db
        .prepare(
          `INSERT INTO study_logs (
            id, project_id, resource_id, resource_title_snapshot, studied_at, duration_minutes, content,
            progress_before_text, progress_before_percent, progress_after_text, progress_after_percent,
            status_before, status_after, next_action_before, next_action, evidence_type,
            resource_updated_at_before, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          logId,
          resource.project_id,
          resource.id,
          resource.title,
          now,
          input.duration_minutes ?? (input.source === 'pending' && pending ? pending.duration_minutes : null),
          trimNullable(input.content),
          beforeProgressText,
          beforeProgressPercent,
          afterProgressText,
          normalized.progress_percent,
          beforeStatus,
          normalized.status,
          beforeNextAction,
          afterNextAction,
          input.evidence_type ?? null,
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
          afterProgressText,
          normalized.progress_percent,
          afterNextAction,
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

  closePendingSession(input: { session_id: string; close_source: PendingCloseSource }): PendingSessionView {
    const pending = this.getPendingSession();
    if (!pending || pending.id !== input.session_id) {
      throw new AppError({ code: 'NOT_FOUND' });
    }

    if (pending.closed_at) {
      return pending;
    }

    const closedAt = timestamp();
    const durationMinutes = calculateDurationMinutes(pending.opened_at, closedAt);
    this.guardWrite(() => {
      const result = this.db
        .prepare('UPDATE pending_study_sessions SET closed_at = ?, duration_minutes = ?, close_source = ? WHERE id = ? AND closed_at IS NULL')
        .run(closedAt, durationMinutes, input.close_source, input.session_id);
      assertChanged(result.changes);
    });

    return this.getPendingSession() ?? pending;
  }

  private createPendingSession(resource: ResourceRow, openedAt: string): PendingSessionView {
    let pending: PendingSessionView | null = null;
    this.guardWrite(() => {
      this.db.prepare('UPDATE resources SET last_opened_at = ? WHERE id = ?').run(openedAt, resource.id);
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
          openedAt,
          resource.progress_text,
          resource.progress_percent,
          resource.status,
          resource.next_action,
          resource.updated_at,
          openedAt,
        );
      pending = this.getPendingSession();
    });

    if (!pending) {
      throw new AppError({ code: 'VALIDATION_FAILED', details: { pending: 'not_created' } });
    }
    return pending;
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

  private listCultivationResources(projectId: string): CultivationResourceSnapshot[] {
    return this.db
      .prepare(
        `SELECT id, type, status, progress_percent, cultivation_role, mastery_group, mastery_weight
           FROM resources
          WHERE project_id = ? AND cultivation_role <> 'reference'`,
      )
      .all(projectId) as CultivationResourceSnapshot[];
  }

  private listCultivationLogs(projectId: string): CultivationLogSnapshot[] {
    return this.db
      .prepare(
        `SELECT studied_at, content, evidence_type
           FROM study_logs
          WHERE project_id = ?
          ORDER BY studied_at DESC, created_at DESC`,
      )
      .all(projectId) as CultivationLogSnapshot[];
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
      realm_rank: row.realm_rank,
      realm_layer: row.realm_layer,
      realm_name: getRealmName(row.realm_rank),
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
    cultivation_role: row.cultivation_role,
    mastery_group: row.mastery_group,
    mastery_weight: row.mastery_weight,
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
    closed_at: row.closed_at,
    duration_minutes: row.duration_minutes,
    close_source: row.close_source,
    progress_before_text: row.progress_before_text,
    progress_before_percent: row.progress_before_percent,
    status_before: row.status_before,
    next_action_before: row.next_action_before,
    resource_updated_at_before: row.resource_updated_at_before,
  };
}

function calculateDurationMinutes(openedAt: string, closedAt: string): number {
  const opened = Date.parse(openedAt);
  const closed = Date.parse(closedAt);
  if (!Number.isFinite(opened) || !Number.isFinite(closed)) {
    return 0;
  }

  const minutes = Math.round((closed - opened) / 60_000);
  return Math.max(0, Math.min(1440, minutes));
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
    evidence_type: row.evidence_type,
  };
}

function timestamp(): string {
  return new Date().toISOString();
}

function trimNullable(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function assertChanged(changes: number): void {
  if (changes < 1) {
    throw new AppError({ code: 'NOT_FOUND' });
  }
}
