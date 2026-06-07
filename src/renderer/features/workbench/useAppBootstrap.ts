import { useEffect, useState } from 'react';

import type { GetEnumsOutput, GetHomeOverviewOutput } from '../../../shared/dto';
import { showError } from '../../lib/actionRunner';
import { unwrapResult } from '../../lib/ipc';
import type { ToastInput } from '../../types';

type UseAppBootstrapInput = {
  showToast(input: ToastInput): void;
};

export function useAppBootstrap({ showToast }: UseAppBootstrapInput) {
  const [overview, setOverview] = useState<GetHomeOverviewOutput | null>(null);
  const [enums, setEnums] = useState<GetEnumsOutput | null>(null);

  const refreshOverview = async () => {
    const data = await window.api.get_home_overview().then(unwrapResult);
    setOverview(data);
    return data;
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      window.api.get_home_overview().then(unwrapResult),
      window.api.get_enums().then(unwrapResult),
    ])
      .then(([data, enumData]) => {
        if (cancelled) {
          return;
        }
        setOverview(data);
        setEnums(enumData);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          showError(showToast, error);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  return {
    overview,
    enums,
    refreshOverview,
  };
}
