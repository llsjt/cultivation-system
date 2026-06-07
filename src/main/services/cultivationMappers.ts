import type { GlobalResourceItem, PendingSessionView, ProjectSummary, ResourceSummary, StudyLogView } from '../../shared/dto';
import { getRealmName } from '../../shared/realm';
import type { GlobalResourceProjectionRow, PendingSessionProjectionRow, ProjectSummaryProjectionRow, ResourceRow, StudyLogRow } from '../repositories/types';

export function projectSummaryFromRow(row: ProjectSummaryProjectionRow): ProjectSummary {
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

export function resourceSummaryFromRow(row: ResourceRow): ResourceSummary {
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

export function pendingFromRow(row: PendingSessionProjectionRow): PendingSessionView {
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

export function studyLogFromRow(row: StudyLogRow): StudyLogView {
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

export function globalResourceItemFromRow(row: GlobalResourceProjectionRow): GlobalResourceItem {
  return {
    resource: resourceSummaryFromRow(row),
    project: {
      id: row.project_summary_id,
      name: row.project_name,
      status: row.project_status,
      progress_percent: Number(row.project_progress_percent),
    },
  };
}
