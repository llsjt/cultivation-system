// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { GetGlobalResourcesOutput, IpcResult, ResourceSummary } from '../../../../src/shared/dto';
import type { CultivationAPI } from '../../../../src/shared/types/api';
import { useGlobalLibraryResources } from '../../../../src/renderer/features/resources/useGlobalLibraryResources';

const ok = <T,>(data: T): IpcResult<T> => ({ ok: true, data });

const resource: ResourceSummary = {
  id: 'resource-1',
  project_id: 'project-1',
  title: 'React Hooks',
  type: 'document',
  open_kind: 'record_only',
  cultivation_role: 'core',
  mastery_group: null,
  mastery_weight: 1,
  status: 'learning',
  progress_text: null,
  progress_percent: 10,
  next_action: null,
  last_opened_at: null,
  last_studied_at: null,
  updated_at: '2026-01-01T00:00:00.000Z',
  created_at: '2026-01-01T00:00:00.000Z',
};

const output: GetGlobalResourcesOutput = {
  items: [
    {
      resource,
      project: {
        id: 'project-1',
        name: '前端修炼',
        status: 'learning',
        progress_percent: 10,
      },
    },
  ],
  total: 1,
};

describe('useGlobalLibraryResources', () => {
  it('does not request while disabled', () => {
    const api = {
      get_global_resources: vi.fn(),
    } satisfies Partial<CultivationAPI>;
    Object.defineProperty(window, 'api', { configurable: true, value: api });

    const { result } = renderHook(() => useGlobalLibraryResources({ enabled: false, lastSavedAt: 'a', reloadKey: 0 }));

    expect(result.current.items).toEqual([]);
    expect(result.current.stale).toBe(true);
    expect(api.get_global_resources).not.toHaveBeenCalled();
  });

  it('loads once when enabled and preserves the user message on failure', async () => {
    const api = {
      get_global_resources: vi
        .fn()
        .mockResolvedValueOnce(ok(output))
        .mockRejectedValueOnce(new Error('资料库暂不可用')),
    } satisfies Partial<CultivationAPI>;
    Object.defineProperty(window, 'api', { configurable: true, value: api });

    const { result, rerender } = renderHook(
      ({ reloadKey }) => useGlobalLibraryResources({ enabled: true, lastSavedAt: 'a', reloadKey }),
      { initialProps: { reloadKey: 0 } },
    );

    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(api.get_global_resources).toHaveBeenCalledTimes(1);

    rerender({ reloadKey: 1 });
    await waitFor(() => expect(result.current.errorMessage).toBe('资料库暂不可用'));
    expect(result.current.items).toHaveLength(1);
  });
});
