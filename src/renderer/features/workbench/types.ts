import type { FormEvent } from 'react';

import type {
  GetEnumsOutput,
  GetHomeOverviewOutput,
  GetProjectCultivationOutput,
  GetProjectDetailOutput,
  PendingSessionView,
  ProjectSummary,
  ResourceSummary,
} from '../../../shared/dto';
import type { ConfirmRequest, LogDraft, Toast, ToastInput } from '../../types';
import type { CockpitViewModel } from '../projects/cockpitViewModel';

export type AppTab = 'meditation' | 'library' | 'analytics' | 'spirit';

export type WorkbenchDataContextValue = {
  overview: GetHomeOverviewOutput | null;
  enums: GetEnumsOutput | null;
  selectedProject: ProjectSummary | null;
  selectedProjectId: string | null;
  projectDetail: GetProjectDetailOutput | null;
  projectCultivation: GetProjectCultivationOutput | null;
  cockpitViewModel: CockpitViewModel;
  activeTab: AppTab;
};

export type WorkbenchActionsContextValue = {
  actions: {
    submitProject(event: FormEvent): Promise<void>;
    submitResource(event: FormEvent): Promise<void>;
    continueResource(resource: ResourceSummary): Promise<void>;
    openPendingLog(pending: PendingSessionView): Promise<void>;
    pickPath(kind: 'file' | 'folder', isEdit: boolean): Promise<void>;
    openLog(resource: ResourceSummary, source: LogDraft['source']): void;
    submitProjectEdit(event: FormEvent): Promise<void>;
    startEditResource(resource: ResourceSummary): Promise<void>;
    showResourceDetail(resource: ResourceSummary): Promise<void>;
    submitResourceEdit(event: FormEvent): Promise<void>;
    submitLog(event: FormEvent): Promise<void>;
    attemptBreakthrough(): Promise<void>;
    abandonPending(pending: PendingSessionView): Promise<void>;
    deleteResource(resource: ResourceSummary): Promise<void>;
    deleteProject(projectId: string): Promise<void>;
  };
  navigation: {
    setActiveTab(tab: AppTab): void;
    setSelectedProjectId(projectId: string | null): void;
    refresh(): Promise<void>;
  };
};

export type AppFeedbackContextValue = {
  busy: boolean;
  toasts: Toast[];
  confirmRequest: ConfirmRequest | null;
  showToast(input: ToastInput): void;
  dismissToast(toastId: string): void;
  askConfirm(input: Omit<ConfirmRequest, 'resolve'>): Promise<boolean>;
  settleConfirm(confirmed: boolean): void;
};
