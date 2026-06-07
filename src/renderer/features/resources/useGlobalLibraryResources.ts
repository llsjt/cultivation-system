import { useCallback, useEffect, useState } from 'react';

import type { GlobalResourceItem } from '../../../shared/dto';
import { unwrapResult } from '../../lib/ipc';

type UseGlobalLibraryResourcesInput = {
  enabled: boolean;
  lastSavedAt: string | null;
  reloadKey: number;
};

type UseGlobalLibraryResourcesState = {
  items: GlobalResourceItem[];
  loading: boolean;
  errorMessage: string | null;
  stale: boolean;
  reload(): void;
};

export function useGlobalLibraryResources({ enabled, lastSavedAt, reloadKey }: UseGlobalLibraryResourcesInput): UseGlobalLibraryResourcesState {
  const [items, setItems] = useState<GlobalResourceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadedSavedAt, setLoadedSavedAt] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [manualReloadKey, setManualReloadKey] = useState(0);
  const stale = loadedSavedAt !== lastSavedAt;

  const reload = useCallback(() => {
    setManualReloadKey((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (hasLoaded && !stale && reloadKey === 0 && manualReloadKey === 0) {
      return;
    }

    let active = true;
    void Promise.resolve().then(() => {
      if (active) {
        setLoading(true);
        setErrorMessage(null);
      }
    });
    window.api
      .get_global_resources()
      .then(unwrapResult)
      .then((output) => {
        if (!active) {
          return;
        }
        setItems(output.items);
        setLoadedSavedAt(lastSavedAt);
        setHasLoaded(true);
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }
        setErrorMessage(error instanceof Error && error.message ? error.message : '全局资料库加载失败，请稍后重试。');
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [enabled, hasLoaded, lastSavedAt, manualReloadKey, reloadKey, stale]);

  return { items, loading, errorMessage, stale, reload };
}
