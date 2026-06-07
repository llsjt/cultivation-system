import { useCallback, useEffect, useState } from 'react';

import type { ResourceDetail } from '../../../shared/dto';
import { unwrapResult } from '../../lib/ipc';

export function useResourceDetail(resourceId: string | null, refreshSeed: unknown) {
  const [detail, setDetail] = useState<ResourceDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => {
    setReloadKey((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!resourceId) {
      void Promise.resolve().then(() => {
        setDetail(null);
        setError(null);
        setLoading(false);
      });
      return;
    }

    let active = true;
    void Promise.resolve()
      .then(() => {
        if (active) {
          setLoading(true);
          setError(null);
        }
      });
    window.api
      .get_resource_detail(resourceId)
      .then(unwrapResult)
      .then((nextDetail) => {
        if (active) {
          setDetail(nextDetail);
        }
      })
      .catch((nextError: unknown) => {
        if (active) {
          setError(nextError);
          setDetail(null);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [resourceId, refreshSeed, reloadKey]);

  return { detail, loading, error, reload };
}
