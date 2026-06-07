import { useState } from 'react';

export type ResourcePanelViewState = {
  projectId: string | null;
  selectedResourceId: string | null;
  isCreatingResource: boolean;
  searchQuery: string;
  statusFilter: string;
};

export function createResourcePanelViewState(projectId: string | null): ResourcePanelViewState {
  return {
    projectId,
    selectedResourceId: null,
    isCreatingResource: false,
    searchQuery: '',
    statusFilter: 'all',
  };
}

export function useResourcePanelState(projectId: string | null) {
  const [viewState, setViewState] = useState<ResourcePanelViewState>(() => createResourcePanelViewState(projectId));
  const activeViewState = viewState.projectId === projectId ? viewState : createResourcePanelViewState(projectId);

  const updateViewState = (patch: Partial<Omit<ResourcePanelViewState, 'projectId'>>) => {
    setViewState((state) => ({
      ...(state.projectId === projectId ? state : createResourcePanelViewState(projectId)),
      ...patch,
      projectId,
    }));
  };

  return {
    viewState: activeViewState,
    updateViewState,
  };
}
