import type { ResourceSummary } from '../shared/dto';
import type { CultivationRole, OpenKind, ResourceStatus, ResourceType, StudyEvidenceType } from '../shared/enums';

export type ToastInput = { kind: 'success' | 'error'; message: string };
export type Toast = ToastInput & { id: string };

export type LogDraft = {
  resource: ResourceSummary;
  source: 'pending' | 'record_only' | 'manual';
  resource_updated_at_before: string;
  before_progress_percent: number;
  progress_text: string;
  progress_percent: string;
  status: ResourceStatus;
  statusChangedByUser: boolean;
  progressChangedByStatus: boolean;
  next_action: string;
  duration_minutes: string;
  evidence_type: '' | StudyEvidenceType;
  duration_hint?: string;
};

export type ResourceEditDraft = {
  id: string;
  title: string;
  type: ResourceType;
  open_kind: OpenKind;
  path_or_url: string;
  status: '' | Extract<ResourceStatus, 'learning' | 'review' | 'paused'>;
  cultivation_role: CultivationRole;
  mastery_group: string;
  mastery_weight: string;
};

export type ProjectEditDraft = { id: string; name: string };

export type ConfirmRequest = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  resolve: (confirmed: boolean) => void;
};
