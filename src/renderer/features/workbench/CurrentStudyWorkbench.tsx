import type { ResourceManagementPanelProps } from '../resources/ResourceManagementPanel';
import { CurrentStudyCockpit } from './CurrentStudyCockpit';
import { useAppFeedbackContext } from './useAppFeedbackContext';
import { useWorkbenchActionsContext } from './useWorkbenchActionsContext';
import { useWorkbenchDataContext } from './useWorkbenchDataContext';

type CurrentStudyWorkbenchProps = {
  resourcePanelProps: ResourceManagementPanelProps;
};

export function CurrentStudyWorkbench({ resourcePanelProps }: CurrentStudyWorkbenchProps) {
  const { overview, cockpitViewModel } = useWorkbenchDataContext();
  const { actions } = useWorkbenchActionsContext();
  const { busy } = useAppFeedbackContext();

  return (
    <CurrentStudyCockpit
      pending={overview?.pending ?? null}
      viewModel={cockpitViewModel}
      busy={busy}
      actions={{
        onContinueRecommended: async () => {
          if (cockpitViewModel.recommendation) {
            await actions.continueResource(cockpitViewModel.recommendation.resource);
          }
        },
        onOpenRecommendedLog: () => {
          if (cockpitViewModel.recommendation) {
            actions.openLog(cockpitViewModel.recommendation.resource, 'manual');
          }
        },
        onCreateResource: () => {
          document.getElementById('resource-title-input')?.focus();
        },
        onAttemptBreakthrough: actions.attemptBreakthrough,
        onOpenPendingLog: actions.openPendingLog,
        onAbandonPending: actions.abandonPending,
      }}
      resourcePanelProps={resourcePanelProps}
    />
  );
}
