import type { Database, Statement } from 'better-sqlite3';

import type { CultivationRole, ProjectStatus, ResourceStatus, ResourceType, StudyEvidenceType } from '../../shared/enums';

export type RepositoryDatabase = Database;

export type PreparedStatement = Statement;

export type PageInput = { limit: number; offset: number };

export type PageRows<T> = { rows: T[]; total: number; limit: number; offset: number };

export type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  realm_rank: number;
  realm_layer: number;
  last_breakthrough_at: string | null;
  created_at: string;
  updated_at: string;
  last_studied_at: string | null;
};

export type ProjectSummaryProjectionRow = ProjectRow & {
  resource_count: number;
  progress_percent: number;
};

export type ResourceRow = {
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

export type CultivationResourceProjectionRow = {
  id: string;
  type: ResourceType;
  status: ResourceStatus;
  progress_percent: number;
  cultivation_role: CultivationRole;
  mastery_group: string | null;
  mastery_weight: number;
};

export type GlobalResourceProjectionRow = ResourceRow & {
  project_summary_id: string;
  project_name: string;
  project_status: ProjectStatus;
  project_progress_percent: number;
};

export type InsertResourceRow = {
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
  now: string;
};

export type UpdateResourceRow = {
  resource_id: string;
  title: string;
  type: string;
  open_kind: string;
  path_or_url: string | null;
  cultivation_role: CultivationRole;
  mastery_group: string | null;
  mastery_weight: number;
  status: ResourceStatus;
  progress_percent: number;
  now: string;
};

export type UpdateResourceProgressInput = {
  resource_id: string;
  progress_text: string | null;
  progress_percent: number;
  next_action: string | null;
  status: ResourceStatus;
  now: string;
};

export type StudyLogRow = {
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

export type CultivationLogProjectionRow = {
  studied_at: string;
  duration_minutes: number | null;
  content: string | null;
  progress_before_percent: number;
  progress_after_percent: number;
  evidence_type: StudyEvidenceType | null;
};

export type InsertStudyLogRow = {
  id: string;
  project_id: string;
  resource_id: string;
  resource_title_snapshot: string;
  studied_at: string;
  duration_minutes: number | null;
  content: string | null;
  progress_before_text: string | null;
  progress_before_percent: number;
  progress_after_text: string | null;
  progress_after_percent: number;
  status_before: ResourceStatus;
  status_after: ResourceStatus;
  next_action_before: string | null;
  next_action: string | null;
  evidence_type: StudyEvidenceType | null;
  resource_updated_at_before: string;
  created_at: string;
};

export type PendingCloseSource = 'viewer_closed' | 'user_ended' | 'app_recovered';

export type PendingSessionProjectionRow = {
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

export type InsertPendingSessionRow = {
  id: string;
  project_id: string;
  resource_id: string;
  resource_title_snapshot: string;
  opened_at: string;
  progress_before_text: string | null;
  progress_before_percent: number;
  status_before: ResourceStatus;
  next_action_before: string | null;
  resource_updated_at_before: string;
};

export type InsertBreakthroughAttemptRow = {
  id: string;
  project_id: string;
  from_realm_rank: number;
  from_realm_layer: number;
  target_realm_rank: number;
  dao_foundation_score: number;
  passed: number;
  bottleneck_summary: string | null;
  created_at: string;
};
