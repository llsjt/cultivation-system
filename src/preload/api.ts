import { contextBridge, ipcRenderer } from 'electron';
import type { IpcRendererEvent } from 'electron';

import type { PendingSessionView } from '../shared/dto';
import type { CultivationAPI } from '../shared/types/api';

const invoke = <T>(command: string, input?: unknown): Promise<T> => ipcRenderer.invoke(`cmd:${command}`, input);

const api: CultivationAPI = {
  get_home_overview: () => invoke('get_home_overview'),
  get_global_resources: () => invoke('get_global_resources'),
  list_projects: (input) => invoke('list_projects', input ?? {}),
  get_project_detail: (project_id, input) => invoke('get_project_detail', { project_id, ...(input ?? {}) }),
  get_project_cultivation: (project_id) => invoke('get_project_cultivation', { project_id }),
  attempt_breakthrough: (project_id) => invoke('attempt_breakthrough', { project_id }),
  create_project: (input) => invoke('create_project', input),
  update_project: (project_id, input) => invoke('update_project', { project_id, ...input }),
  delete_project: (project_id) => invoke('delete_project', { project_id }),
  create_resource: (input) => invoke('create_resource', input),
  update_resource: (resource_id, input) => invoke('update_resource', { resource_id, ...input }),
  delete_resource: (resource_id) => invoke('delete_resource', { resource_id }),
  get_resource_detail: (resource_id) => invoke('get_resource_detail', { resource_id }),
  continue_resource: (input) => invoke('continue_resource', input),
  save_study_log: (input) => invoke('save_study_log', input),
  get_pending_session: () => invoke('get_pending_session'),
  abandon_pending_session: (session_id) => invoke('abandon_pending_session', { session_id }),
  close_pending_session: (session_id, close_source) => invoke('close_pending_session', { session_id, close_source }),
  on_pending_session_closed: (callback) => {
    const listener = (_event: IpcRendererEvent, pending: unknown) => {
      const parsed = parsePendingSessionClosedEvent(pending);
      if (!parsed.success) {
        console.warn('Invalid pending_session_closed payload', parsed.issues);
        return;
      }

      callback(parsed.data);
    };
    ipcRenderer.on('event:pending_session_closed', listener);
    return () => ipcRenderer.removeListener('event:pending_session_closed', listener);
  },
  get_enums: () => invoke('get_enums'),
  select_local_file: (input) => invoke('select_local_file', input),
};

contextBridge.exposeInMainWorld('api', api);

type PendingSessionParseResult = { success: true; data: PendingSessionView } | { success: false; issues: string[] };

const closeSources = new Set(['viewer_closed', 'user_ended', 'app_recovered']);
const resourceStatuses = new Set(['not_started', 'learning', 'review', 'completed', 'paused']);

function parsePendingSessionClosedEvent(value: unknown): PendingSessionParseResult {
  const issues: string[] = [];

  if (!isRecord(value)) {
    return { success: false, issues: ['payload must be an object'] };
  }

  expectString(value, 'id', issues);
  expectString(value, 'project_id', issues);
  expectString(value, 'resource_id', issues);
  expectString(value, 'resource_title_snapshot', issues);
  expectString(value, 'opened_at', issues);
  expectString(value, 'resource_updated_at_before', issues);
  expectNullableString(value, 'current_resource_title', issues);
  expectNullableString(value, 'closed_at', issues);
  expectNullableString(value, 'progress_before_text', issues);
  expectNullableString(value, 'next_action_before', issues);
  expectNullableInteger(value, 'duration_minutes', 0, 1440, issues);
  expectInteger(value, 'progress_before_percent', 0, 100, issues);
  expectNullableEnum(value, 'close_source', closeSources, issues);
  expectEnum(value, 'status_before', resourceStatuses, issues);

  if (issues.length > 0) {
    return { success: false, issues };
  }

  return { success: true, data: value as PendingSessionView };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function expectString(value: Record<string, unknown>, key: string, issues: string[]): void {
  if (typeof value[key] !== 'string' || value[key] === '') {
    issues.push(`${key} must be a non-empty string`);
  }
}

function expectNullableString(value: Record<string, unknown>, key: string, issues: string[]): void {
  if (value[key] !== null && typeof value[key] !== 'string') {
    issues.push(`${key} must be a string or null`);
  }
}

function expectInteger(value: Record<string, unknown>, key: string, min: number, max: number, issues: string[]): void {
  const item = value[key];
  if (!Number.isInteger(item) || (item as number) < min || (item as number) > max) {
    issues.push(`${key} must be an integer from ${min} to ${max}`);
  }
}

function expectNullableInteger(value: Record<string, unknown>, key: string, min: number, max: number, issues: string[]): void {
  if (value[key] === null) {
    return;
  }

  expectInteger(value, key, min, max, issues);
}

function expectEnum(value: Record<string, unknown>, key: string, options: Set<string>, issues: string[]): void {
  const item = value[key];
  if (typeof item !== 'string' || !options.has(item)) {
    issues.push(`${key} must be a known value`);
  }
}

function expectNullableEnum(value: Record<string, unknown>, key: string, options: Set<string>, issues: string[]): void {
  if (value[key] === null) {
    return;
  }

  expectEnum(value, key, options, issues);
}
