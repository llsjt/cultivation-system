import type { ComponentProps } from 'react';

import type { PendingSessionView } from '../../../shared/dto';
import { PendingStrip } from '../studyLogs/PendingStrip';
import { ResourceManagementPanel } from '../resources/ResourceManagementPanel';
import { BreakthroughDiagnosticCard } from './BreakthroughDiagnosticCard';
import type { CockpitViewModel } from './cockpitViewModel';
import { ProjectCultivationStrip } from './ProjectCultivationStrip';
import { RecommendedStudyPanel } from './RecommendedStudyPanel';

type CurrentStudyCockpitProps = {
  pending: PendingSessionView | null;
  viewModel: CockpitViewModel;
  busy: boolean;
  actions: {
    onContinueRecommended: () => Promise<void>;
    onOpenRecommendedLog: () => void;
    onCreateResource: () => void;
    onAttemptBreakthrough: () => Promise<void>;
    onOpenPendingLog: (pending: PendingSessionView) => Promise<void>;
    onAbandonPending: (pending: PendingSessionView) => Promise<void>;
  };
  resourcePanelProps: ComponentProps<typeof ResourceManagementPanel>;
};

export function CurrentStudyCockpit({ pending, viewModel, busy, actions, resourcePanelProps }: CurrentStudyCockpitProps) {
  return (
    <div className="current-study-cockpit">
      {pending ? <PendingStrip pending={pending} busy={busy} onOpenLog={actions.onOpenPendingLog} onAbandon={actions.onAbandonPending} /> : null}

      {viewModel.lastStudyFeedback ? (
        <section className="detail-panel cockpit-panel last-study-feedback" aria-live="polite">
          <div>
            <p className="eyebrow">出关回显</p>
            <h2>{viewModel.lastStudyFeedback.resourceTitle}</h2>
          </div>
          <div className="last-study-feedback-grid">
            <span>{viewModel.lastStudyFeedback.feedbackLabel}</span>
            <strong>{viewModel.lastStudyFeedback.progressChangeLabel}</strong>
            <span>{viewModel.lastStudyFeedback.durationLabel}</span>
            <span>下次目标：{viewModel.lastStudyFeedback.nextAction}</span>
          </div>
        </section>
      ) : null}

      <div className="cockpit-primary-grid">
        <RecommendedStudyPanel
          viewModel={viewModel.recommendation}
          busy={busy}
          actions={{
            onContinue: actions.onContinueRecommended,
            onOpenManualLog: actions.onOpenRecommendedLog,
            onCreateResource: actions.onCreateResource,
          }}
        />
        <BreakthroughDiagnosticCard
          diagnostic={viewModel.breakthroughDiagnostic}
          busy={busy}
          onAttemptBreakthrough={actions.onAttemptBreakthrough}
        />
      </div>

      <ProjectCultivationStrip viewModel={viewModel.cultivationStrip} />

      <div className="cockpit-resource-section">
        <ResourceManagementPanel {...resourcePanelProps} />
      </div>
    </div>
  );
}
