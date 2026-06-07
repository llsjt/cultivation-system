import { randomUUID } from 'node:crypto';

import type { Database } from 'better-sqlite3';

import { deriveProjectStatus } from '../../shared/derive';
import { AppError } from '../../shared/errors';
import { normalizeStatusAndProgress } from '../../shared/normalize';
import { evaluateProjectCultivation, type CultivationLogSnapshot, type CultivationResourceSnapshot, type ProjectCultivationState } from '../../shared/realm';
import { canOpenInControlledWindow, displayTarget, evaluateWarnRisk, normalizedPath, openControlledResource, openExternalResource, validateOpenTarget } from '../opener/resourceOpener';
import { BreakthroughAttemptRepository } from '../repositories/breakthroughAttemptRepository';
import { PendingSessionRepository } from '../repositories/pendingSessionRepository';
import { ProjectRepository } from '../repositories/projectRepository';
import { ResourceRepository } from '../repositories/resourceRepository';
import { StudyLogRepository } from '../repositories/studyLogRepository';
import type { PendingCloseSource, ProjectRow, ResourceRow } from '../repositories/types';
import type {
  AttemptBreakthroughOutput,
  ContinueResourceInput,
  ContinueResourceOutput,
  CreateProjectInput,
  CreateResourceInput,
  GetGlobalResourcesOutput,
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
import { globalResourceItemFromRow, pendingFromRow, projectSummaryFromRow, resourceSummaryFromRow, studyLogFromRow } from './cultivationMappers';

type CultivationServiceOptions = {
  onPendingSessionClosed?: (pending: PendingSessionView) => void;
};

export class CultivationService {
  private readonly db: Database;
  private readonly breakthroughAttempts: BreakthroughAttemptRepository;
  private readonly pendingSessions: PendingSessionRepository;
  private readonly projects: ProjectRepository;
  private readonly resources: ResourceRepository;
  private readonly studyLogs: StudyLogRepository;
  private continueResourceBusy = false;
  private readonly riskConfirmTokens = new Map<string, RiskConfirmToken>();
  private readonly onPendingSessionClosed?: (pending: PendingSessionView) => void;

  constructor(db: Database, options: CultivationServiceOptions = {}) {
    this.db = db;
    this.breakthroughAttempts = new BreakthroughAttemptRepository(db);
    this.pendingSessions = new PendingSessionRepository(db);
    this.projects = new ProjectRepository(db);
    this.resources = new ResourceRepository(db);
    this.studyLogs = new StudyLogRepository(db);
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
    const page = this.projects.listWithProgressRows({ limit, offset });

    return {
      items: page.rows.map(projectSummaryFromRow),
      total: page.total,
      limit: page.limit,
      offset: page.offset,
    };
  }

  getProjectDetail(input: { project_id: string; limit?: number; offset?: number }): GetProjectDetailOutput {
    const project = this.getProjectSummary(input.project_id);
    const limit = input.limit ?? 100;
    const offset = input.offset ?? 0;
    const page = this.resources.listByProjectRows({ project_id: input.project_id, limit, offset });

    return {
      project,
      resources: {
        items: page.rows.map(resourceSummaryFromRow),
        total: page.total,
        limit: page.limit,
        offset: page.offset,
      },
      recent_logs: this.listRecentLogs(5, input.project_id),
    };
  }

  getGlobalResources(): GetGlobalResourcesOutput {
    const items = this.resources.listGlobalResourceRows().map(globalResourceItemFromRow);
    return { items, total: items.length };
  }

  createProject(input: CreateProjectInput): ProjectSummary {
    const now = timestamp();
    const id = randomUUID();

    this.guardWrite(() => {
      this.projects.insert({ id, name: input.name.trim(), description: trimNullable(input.description), now });
    });

    return this.getProjectSummary(id);
  }

  updateProject(input: UpdateProjectInput): ProjectSummary {
    const current = this.getProjectRow(input.project_id);
    const now = timestamp();
    const description = input.description === undefined ? current.description : trimNullable(input.description);

    this.guardWrite(() => {
      assertChanged(this.projects.update({ project_id: input.project_id, name: input.name.trim(), description, now }));
    });

    return this.getProjectSummary(input.project_id);
  }

  deleteProject(projectId: string): { deleted: true } {
    this.guardWrite(() => {
      assertChanged(this.projects.delete(projectId));
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
      this.resources.insert({
        id,
        project_id: input.project_id,
        title: input.title.trim(),
        type: input.type,
        open_kind: input.open_kind,
        path_or_url: normalizedPath(input.open_kind, input.path_or_url),
        cultivation_role: input.cultivation_role ?? 'core',
        mastery_group: trimNullable(input.mastery_group),
        mastery_weight: input.mastery_weight ?? 1,
        status: normalized.status,
        progress_text: trimNullable(input.initial_progress_text),
        progress_percent: normalized.progress_percent,
        next_action: trimNullable(input.initial_next_action),
        now,
      });
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
      assertChanged(
        this.resources.update({
          resource_id: input.resource_id,
          title: input.title.trim(),
          type: input.type,
          open_kind: input.open_kind,
          path_or_url: normalizedPath(input.open_kind, input.path_or_url),
          cultivation_role: input.cultivation_role,
          mastery_group: trimNullable(input.mastery_group),
          mastery_weight: input.mastery_weight,
          status: normalized.status,
          progress_percent: normalized.progress_percent,
          now,
        }),
      );
      this.rederiveProject(current.project_id, now);
    });

    return this.getResourceSummary(input.resource_id);
  }

  deleteResource(resourceId: string): { deleted: true } {
    const current = this.getResourceRow(resourceId);
    const now = timestamp();

    this.guardWrite(() => {
      assertChanged(this.resources.delete(resourceId));
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
      this.breakthroughAttempts.insert({
        id: attemptId,
        project_id: project.id,
        from_realm_rank: project.realm_rank,
        from_realm_layer: project.realm_layer,
        target_realm_rank: targetRealmRank,
        dao_foundation_score: cultivation.dao_foundation_score,
        passed: cultivation.can_breakthrough ? 1 : 0,
        bottleneck_summary: bottleneckSummary,
        created_at: now,
      });

      if (cultivation.can_breakthrough) {
        assertChanged(this.projects.updateRealmAfterBreakthrough({ project_id: project.id, realm_rank: targetRealmRank, realm_layer: 1, last_breakthrough_at: now, now }));
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
            if (pending) {
              this.pendingSessions.deleteById(pending.id);
            }
            this.resources.updateLastOpenedAt({ resource_id: resource.id, last_opened_at: resource.last_opened_at });
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
      this.studyLogs.insert({
        id: logId,
        project_id: resource.project_id,
        resource_id: resource.id,
        resource_title_snapshot: resource.title,
        studied_at: now,
        duration_minutes: input.duration_minutes ?? (input.source === 'pending' && pending ? pending.duration_minutes : null),
        content: trimNullable(input.content),
        progress_before_text: beforeProgressText,
        progress_before_percent: beforeProgressPercent,
        progress_after_text: afterProgressText,
        progress_after_percent: normalized.progress_percent,
        status_before: beforeStatus,
        status_after: normalized.status,
        next_action_before: beforeNextAction,
        next_action: afterNextAction,
        evidence_type: input.evidence_type ?? null,
        resource_updated_at_before: input.resource_updated_at_before,
        created_at: now,
      });

      this.resources.updateProgressAfterLog({
        resource_id: resource.id,
        progress_text: afterProgressText,
        progress_percent: normalized.progress_percent,
        next_action: afterNextAction,
        status: normalized.status,
        now,
      });

      if (input.source === 'pending') {
        this.pendingSessions.deleteByResourceId(resource.id);
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
    const row = this.pendingSessions.getLatestRow();
    return row ? pendingFromRow(row) : null;
  }

  abandonPendingSession(sessionId: string): { abandoned: true } {
    this.guardWrite(() => {
      assertChanged(this.pendingSessions.deleteById(sessionId));
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
      assertChanged(this.pendingSessions.close({ session_id: input.session_id, closed_at: closedAt, duration_minutes: durationMinutes, close_source: input.close_source }));
    });

    return this.getPendingSession() ?? pending;
  }

  private createPendingSession(resource: ResourceRow, openedAt: string): PendingSessionView {
    let pending: PendingSessionView | null = null;
    this.guardWrite(() => {
      this.resources.updateLastOpenedAt({ resource_id: resource.id, last_opened_at: openedAt });
      this.pendingSessions.insert({
        id: randomUUID(),
        project_id: resource.project_id,
        resource_id: resource.id,
        resource_title_snapshot: resource.title,
        opened_at: openedAt,
        progress_before_text: resource.progress_text,
        progress_before_percent: resource.progress_percent,
        status_before: resource.status,
        next_action_before: resource.next_action,
        resource_updated_at_before: resource.updated_at,
      });
      pending = this.getPendingSession();
    });

    if (!pending) {
      throw new AppError({ code: 'VALIDATION_FAILED', details: { pending: 'not_created' } });
    }
    return pending;
  }

  private getProjectSummary(projectId: string): ProjectSummary {
    const row = this.projects.findSummaryRowById(projectId);
    if (!row) {
      throw new AppError({ code: 'NOT_FOUND' });
    }
    return projectSummaryFromRow(row);
  }

  private getProjectRow(projectId: string): ProjectRow {
    const row = this.projects.findRowById(projectId);
    if (!row) {
      throw new AppError({ code: 'NOT_FOUND' });
    }
    return row;
  }

  private getResourceSummary(resourceId: string): ResourceSummary {
    return resourceSummaryFromRow(this.getResourceRow(resourceId));
  }

  private getResourceRow(resourceId: string): ResourceRow {
    const row = this.resources.findRowById(resourceId);
    if (!row) {
      throw new AppError({ code: 'NOT_FOUND' });
    }
    return row;
  }

  private getStudyLogView(logId: string): StudyLogView {
    const row = this.studyLogs.findRowById(logId);
    if (!row) {
      throw new AppError({ code: 'NOT_FOUND' });
    }
    return studyLogFromRow(row);
  }

  private listRecentLogs(limit: number, projectId?: string, resourceId?: string): StudyLogView[] {
    const rows = this.studyLogs.listRecentRows({ limit, project_id: projectId, resource_id: resourceId });
    return rows.map(studyLogFromRow);
  }

  private getRecommendedResource(): ResourceSummary | null {
    const row = this.resources.findRecommendedRow();
    return row ? resourceSummaryFromRow(row) : null;
  }

  private listCultivationResources(projectId: string): CultivationResourceSnapshot[] {
    return this.resources.listCultivationResourceRows(projectId);
  }

  private listCultivationLogs(projectId: string): CultivationLogSnapshot[] {
    return this.studyLogs.listCultivationLogRows(projectId);
  }

  private getProjectProgress(projectId: string): number {
    return this.projects.getProgressPercent(projectId);
  }

  private getProjectName(projectId: string): string | null {
    return this.projects.getName(projectId);
  }

  private getLastSavedAt(): string | null {
    return this.projects.getLastSavedAt();
  }

  private assertProjectExists(projectId: string): void {
    const row = this.projects.findRowById(projectId);
    if (!row) {
      throw new AppError({ code: 'NOT_FOUND' });
    }
  }

  private rederiveProject(projectId: string, now: string): void {
    const rows = this.resources.listStatusRowsByProject(projectId);
    const status = deriveProjectStatus(rows.map((row) => row.status));
    const lastStudiedAt = this.resources.getLastStudiedAtByProject(projectId);

    this.projects.updateDerivedState({ project_id: projectId, status, last_studied_at: lastStudiedAt, now });
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

function calculateDurationMinutes(openedAt: string, closedAt: string): number {
  const opened = Date.parse(openedAt);
  const closed = Date.parse(closedAt);
  if (!Number.isFinite(opened) || !Number.isFinite(closed)) {
    return 0;
  }

  const minutes = Math.round((closed - opened) / 60_000);
  return Math.max(0, Math.min(1440, minutes));
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
