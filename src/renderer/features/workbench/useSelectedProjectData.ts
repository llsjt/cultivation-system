import { useCallback, useEffect, useMemo, useState } from 'react';

import type { GetHomeOverviewOutput, GetProjectCultivationOutput, GetProjectDetailOutput } from '../../../shared/dto';
import { showError } from '../../lib/actionRunner';
import { unwrapResult } from '../../lib/ipc';
import type { ToastInput } from '../../types';

type UseSelectedProjectDataInput = {
  overview: GetHomeOverviewOutput | null;
  showToast(input: ToastInput): void;
};

export function useSelectedProjectData({ overview, showToast }: UseSelectedProjectDataInput) {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectDetail, setProjectDetail] = useState<GetProjectDetailOutput | null>(null);
  const [projectCultivation, setProjectCultivation] = useState<GetProjectCultivationOutput | null>(null);

  const selectedProject = useMemo(
    () => overview?.projects.find((project) => project.id === selectedProjectId) ?? overview?.projects[0] ?? null,
    [overview, selectedProjectId],
  );

  const loadProject = useCallback(async (projectId: string | null) => {
    if (!projectId) {
      setProjectDetail(null);
      setProjectCultivation(null);
      return;
    }
    const [detail, cultivation] = await Promise.all([
      window.api.get_project_detail(projectId).then(unwrapResult),
      window.api.get_project_cultivation(projectId).then(unwrapResult),
    ]);
    setProjectDetail(detail);
    setProjectCultivation(cultivation);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const projectId = selectedProject?.id ?? null;
    const detailPromise = projectId
      ? Promise.all([
          window.api.get_project_detail(projectId).then(unwrapResult),
          window.api.get_project_cultivation(projectId).then(unwrapResult),
        ])
      : Promise.resolve([null, null] as const);
    detailPromise
      .then(([detail, cultivation]) => {
        if (!cancelled) {
          setProjectDetail(detail);
          setProjectCultivation(cultivation);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          showError(showToast, error);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedProject?.id, showToast]);

  return {
    selectedProject,
    selectedProjectId,
    setSelectedProjectId,
    projectDetail,
    projectCultivation,
    loadProject,
  };
}
