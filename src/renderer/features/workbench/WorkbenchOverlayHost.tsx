import type { FormEvent } from 'react';

import type { GetEnumsOutput, PendingSessionView, ResourceDetail } from '../../../shared/dto';
import type { ResourceStatus } from '../../../shared/enums';
import { BreakthroughOverlay } from '../../components/BreakthroughOverlay';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import type { ConfirmRequest, LogDraft, ProjectEditDraft, ResourceEditDraft } from '../../types';
import { ProjectEditModal } from '../projects/ProjectEditModal';
import { ResourceDetailModal } from '../resources/ResourceDetailModal';
import { ResourceEditModal } from '../resources/ResourceEditModal';
import { PendingConflictModal } from '../studyLogs/PendingConflictModal';
import { StudyLogModal } from '../studyLogs/StudyLogModal';

type WorkbenchOverlayHostProps = {
  logDraft: LogDraft | null;
  projectEdit: ProjectEditDraft | null;
  resourceEdit: ResourceEditDraft | null;
  resourceDetail: ResourceDetail | null;
  pendingConflict: PendingSessionView | null;
  confirmRequest: ConfirmRequest | null;
  breakthroughData: { resourceTitle: string; stageName: string } | null;
  enums: GetEnumsOutput | null;
  resourceStatuses: GetEnumsOutput['resource_status'];
  evidenceTypes: GetEnumsOutput['study_evidence_type'];
  resourceTypes: GetEnumsOutput['resource_type'];
  cultivationRoles: GetEnumsOutput['cultivation_role'];
  openKinds: GetEnumsOutput['open_kind'];
  busy: boolean;
  onChangeLogDraft(draft: LogDraft | null): void;
  onChangeLogStatus(status: ResourceStatus): void;
  onSubmitLog(event: FormEvent): Promise<void>;
  onChangeProjectEdit(draft: ProjectEditDraft | null): void;
  onSubmitProjectEdit(event: FormEvent): Promise<void>;
  onChangeResourceEdit(draft: ResourceEditDraft | null): void;
  onSubmitResourceEdit(event: FormEvent): Promise<void>;
  onPickEditPath(kind: 'file' | 'folder'): Promise<void>;
  onCloseResourceDetail(): void;
  onOpenPendingLog(pending: PendingSessionView): Promise<void>;
  onAbandonPending(pending: PendingSessionView): Promise<void>;
  onClosePendingConflict(): void;
  onSettleConfirm(confirmed: boolean): void;
  onCloseBreakthrough(): void;
};

export function WorkbenchOverlayHost({
  logDraft,
  projectEdit,
  resourceEdit,
  resourceDetail,
  pendingConflict,
  confirmRequest,
  breakthroughData,
  enums,
  resourceStatuses,
  evidenceTypes,
  resourceTypes,
  cultivationRoles,
  openKinds,
  busy,
  onChangeLogDraft,
  onChangeLogStatus,
  onSubmitLog,
  onChangeProjectEdit,
  onSubmitProjectEdit,
  onChangeResourceEdit,
  onSubmitResourceEdit,
  onPickEditPath,
  onCloseResourceDetail,
  onOpenPendingLog,
  onAbandonPending,
  onClosePendingConflict,
  onSettleConfirm,
  onCloseBreakthrough,
}: WorkbenchOverlayHostProps) {
  return (
    <>
      {logDraft ? (
        <StudyLogModal
          draft={logDraft}
          resourceStatuses={resourceStatuses}
          evidenceTypes={evidenceTypes}
          busy={busy}
          onChange={onChangeLogDraft}
          onStatusChange={onChangeLogStatus}
          onSubmit={onSubmitLog}
          onClose={() => onChangeLogDraft(null)}
        />
      ) : null}

      {projectEdit ? (
        <ProjectEditModal
          draft={projectEdit}
          busy={busy}
          onChange={onChangeProjectEdit}
          onSubmit={onSubmitProjectEdit}
          onClose={() => onChangeProjectEdit(null)}
        />
      ) : null}

      {resourceEdit ? (
        <ResourceEditModal
          draft={resourceEdit}
          resourceTypes={resourceTypes}
          cultivationRoles={cultivationRoles}
          openKinds={openKinds}
          resourceStatuses={resourceStatuses}
          busy={busy}
          onChange={onChangeResourceEdit}
          onSubmit={onSubmitResourceEdit}
          onPickPath={onPickEditPath}
          onClose={() => onChangeResourceEdit(null)}
        />
      ) : null}

      {resourceDetail ? <ResourceDetailModal detail={resourceDetail} enums={enums} onClose={onCloseResourceDetail} /> : null}

      {pendingConflict ? (
        <PendingConflictModal
          pending={pendingConflict}
          onOpenLog={onOpenPendingLog}
          onAbandon={onAbandonPending}
          onClose={onClosePendingConflict}
        />
      ) : null}

      {confirmRequest ? <ConfirmDialog request={confirmRequest} onSettle={onSettleConfirm} /> : null}

      {breakthroughData ? (
        <BreakthroughOverlay
          resourceTitle={breakthroughData.resourceTitle}
          stageName={breakthroughData.stageName}
          onClose={onCloseBreakthrough}
        />
      ) : null}
    </>
  );
}
