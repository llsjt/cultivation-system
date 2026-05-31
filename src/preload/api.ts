import { contextBridge, ipcRenderer } from 'electron';

import type { CultivationAPI } from '../shared/types/api';

const invoke = <T>(command: string, input?: unknown): Promise<T> => ipcRenderer.invoke(`cmd:${command}`, input);

const api: CultivationAPI = {
  get_home_overview: () => invoke('get_home_overview'),
  list_projects: (input) => invoke('list_projects', input ?? {}),
  get_project_detail: (project_id, input) => invoke('get_project_detail', { project_id, ...(input ?? {}) }),
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
  get_enums: () => invoke('get_enums'),
};

contextBridge.exposeInMainWorld('api', api);
