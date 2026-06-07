import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CultivationAPI } from '../../src/shared/types/api';
import '../../src/preload/api';

type IpcListener = (event: unknown, payload: unknown) => void;

const electronMocks = vi.hoisted(() => {
  const exposed = { api: undefined as CultivationAPI | undefined };
  const listeners = new Map<string, IpcListener>();

  return {
    contextBridge: {
      exposeInMainWorld: vi.fn((_key: string, api: CultivationAPI) => {
        exposed.api = api;
      }),
    },
    exposed,
    ipcRenderer: {
      invoke: vi.fn(),
      listeners,
      on: vi.fn((channel: string, listener: IpcListener) => {
        listeners.set(channel, listener);
      }),
      removeListener: vi.fn((channel: string) => {
        listeners.delete(channel);
      }),
    },
  };
});

vi.mock('electron', () => ({
  contextBridge: electronMocks.contextBridge,
  ipcRenderer: electronMocks.ipcRenderer,
}));

const pendingPayload = {
  id: 'pending-1',
  project_id: 'project-1',
  resource_id: 'resource-1',
  resource_title_snapshot: '秘卷',
  current_resource_title: '秘卷',
  opened_at: '2026-01-01T00:00:00.000Z',
  closed_at: '2026-01-01T00:20:00.000Z',
  duration_minutes: 20,
  close_source: 'viewer_closed',
  progress_before_text: null,
  progress_before_percent: 10,
  status_before: 'learning',
  next_action_before: null,
  resource_updated_at_before: '2026-01-01T00:00:00.000Z',
};

describe('preload api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    electronMocks.ipcRenderer.listeners.clear();
  });

  it('parses pending session closed events before calling renderer callbacks', () => {
    const api = electronMocks.exposed.api;
    if (!api) {
      throw new Error('preload api was not exposed');
    }

    const callback = vi.fn();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const unsubscribe = api.on_pending_session_closed(callback);
    const listener = electronMocks.ipcRenderer.listeners.get('event:pending_session_closed');
    if (!listener) {
      throw new Error('pending listener was not registered');
    }

    listener({}, pendingPayload);
    listener({}, { ...pendingPayload, close_source: 'bad_source' });
    unsubscribe();

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(pendingPayload);
    expect(warn).toHaveBeenCalledWith('Invalid pending_session_closed payload', expect.any(Array));
    expect(electronMocks.ipcRenderer.removeListener).toHaveBeenCalledWith('event:pending_session_closed', listener);
  });
});
