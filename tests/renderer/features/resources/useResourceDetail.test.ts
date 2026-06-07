// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { IpcResult, ResourceDetail } from '../../../../src/shared/dto';
import type { CultivationAPI } from '../../../../src/shared/types/api';
import { useResourceDetail } from '../../../../src/renderer/features/resources/useResourceDetail';

const ok = <T,>(data: T): IpcResult<T> => ({ ok: true, data });

function detail(id: string, title = id): ResourceDetail {
  return {
    id,
    project_id: 'project-1',
    title,
    type: 'document',
    open_kind: 'record_only',
    path_or_url_display: null,
    path_or_url_raw: null,
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
    recent_logs: [],
  };
}

describe('useResourceDetail', () => {
  it('clears detail when resource id is empty', () => {
    const api = {
      get_resource_detail: vi.fn(),
    } satisfies Partial<CultivationAPI>;
    Object.defineProperty(window, 'api', { configurable: true, value: api });

    const { result } = renderHook(() => useResourceDetail(null, 0));

    expect(result.current.detail).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(api.get_resource_detail).not.toHaveBeenCalled();
  });

  it('does not let a stale request overwrite the latest resource detail', async () => {
    let resolveFirst: (value: IpcResult<ResourceDetail>) => void = () => undefined;
    let resolveSecond: (value: IpcResult<ResourceDetail>) => void = () => undefined;
    const api = {
      get_resource_detail: vi
        .fn()
        .mockReturnValueOnce(new Promise<IpcResult<ResourceDetail>>((resolve) => { resolveFirst = resolve; }))
        .mockReturnValueOnce(new Promise<IpcResult<ResourceDetail>>((resolve) => { resolveSecond = resolve; })),
    } satisfies Partial<CultivationAPI>;
    Object.defineProperty(window, 'api', { configurable: true, value: api });

    const { result, rerender } = renderHook(({ resourceId }) => useResourceDetail(resourceId, 0), {
      initialProps: { resourceId: 'old-resource' as string | null },
    });

    rerender({ resourceId: 'new-resource' });
    resolveSecond(ok(detail('new-resource', 'New Resource')));
    await waitFor(() => expect(result.current.detail?.id).toBe('new-resource'));

    resolveFirst(ok(detail('old-resource', 'Old Resource')));
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    expect(result.current.detail?.id).toBe('new-resource');
  });
});
