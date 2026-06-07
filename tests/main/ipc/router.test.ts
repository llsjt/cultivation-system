import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IpcResult } from '../../../src/shared/dto';
import { registerIpcHandlers } from '../../../src/main/ipc/router';
import type { CultivationService } from '../../../src/main/services/cultivationService';

type IpcHandler = (event: unknown, input?: unknown) => Promise<IpcResult<unknown>>;

const electronMocks = vi.hoisted(() => {
  const handlers = new Map<string, IpcHandler>();

  return {
    app: { isPackaged: false },
    browserWindow: {
      getAllWindows: vi.fn(() => [{}]),
      getFocusedWindow: vi.fn(() => null),
    },
    dialog: {
      showOpenDialog: vi.fn(),
    },
    handlers,
    ipcMain: {
      handle: vi.fn((channel: string, handler: IpcHandler) => {
        handlers.set(channel, handler);
      }),
    },
  };
});

const loggerMock = vi.hoisted(() => ({
  warn: vi.fn(),
}));

vi.mock('electron', () => ({
  app: electronMocks.app,
  BrowserWindow: electronMocks.browserWindow,
  dialog: electronMocks.dialog,
  ipcMain: electronMocks.ipcMain,
}));

vi.mock('../../../src/main/logger', () => ({
  logger: loggerMock,
}));

function registerService(service: Record<string, unknown>) {
  electronMocks.handlers.clear();
  registerIpcHandlers(service as unknown as CultivationService);
}

async function invoke(channel: string, input?: unknown) {
  const handler = electronMocks.handlers.get(channel);
  if (!handler) {
    throw new Error(`Missing IPC handler: ${channel}`);
  }

  return handler({}, input);
}

describe('registerIpcHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    electronMocks.app.isPackaged = false;
    electronMocks.browserWindow.getAllWindows.mockReturnValue([{}]);
    electronMocks.browserWindow.getFocusedWindow.mockReturnValue(null);
  });

  it('rejects extra input fields before calling the service', async () => {
    const getProjectDetail = vi.fn();
    registerService({ getProjectDetail });

    const result = await invoke('cmd:get_project_detail', { project_id: 'project-1', extra: true });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_FAILED');
    }
    expect(getProjectDetail).not.toHaveBeenCalled();
  });

  it('blocks invalid output contracts in test and development environments', async () => {
    registerService({
      getHomeOverview: vi.fn(() => ({ projects: [] })),
    });

    const result = await invoke('cmd:get_home_overview');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('IPC_CONTRACT_FAILED');
      expect(result.error.recoverable).toBe(false);
    }
  });

  it('logs invalid output contracts without blocking packaged production responses', async () => {
    const data = { projects: [] };
    vi.stubEnv('NODE_ENV', 'production');
    electronMocks.app.isPackaged = true;
    registerService({
      getHomeOverview: vi.fn(() => data),
    });

    const result = await invoke('cmd:get_home_overview');

    expect(result).toEqual({ ok: true, data });
    expect(loggerMock.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'get_home_overview',
        data_summary: {
          type: 'object',
          keys: ['projects'],
          fields: { projects: { type: 'array', length: 0 } },
        },
      }),
      'ipc output contract failed',
    );
  });

  it('validates select_local_file input properties', async () => {
    registerService({});

    const result = await invoke('cmd:select_local_file', { properties: ['createDirectory'] });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_FAILED');
    }
    expect(electronMocks.dialog.showOpenDialog).not.toHaveBeenCalled();
  });

  it('returns null when select_local_file is canceled', async () => {
    electronMocks.dialog.showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });
    registerService({});

    const result = await invoke('cmd:select_local_file', { properties: ['openDirectory'] });

    expect(result).toEqual({ ok: true, data: null });
    expect(electronMocks.dialog.showOpenDialog).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        properties: ['openDirectory'],
        title: '选择本地修炼目录/文件夹',
      }),
    );
  });
});
