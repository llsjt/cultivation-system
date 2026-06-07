import type { CreateProjectInput, CreateResourceInput, SaveStudyLogInput, UpdateProjectInput, UpdateResourceInput } from '../../../shared/dto';
import { unwrapResult } from '../../lib/ipc';

type PendingCloseSource = 'viewer_closed' | 'user_ended' | 'app_recovered';

export const workbenchApi = {
  getHomeOverview: () => window.api.get_home_overview().then(unwrapResult),
  getEnums: () => window.api.get_enums().then(unwrapResult),
  getProjectDetail: (projectId: string) => window.api.get_project_detail(projectId).then(unwrapResult),
  getProjectCultivation: (projectId: string) => window.api.get_project_cultivation(projectId).then(unwrapResult),
  createProject: (input: CreateProjectInput) => window.api.create_project(input).then(unwrapResult),
  updateProject: (projectId: string, input: Omit<UpdateProjectInput, 'project_id'>) => window.api.update_project(projectId, input).then(unwrapResult),
  deleteProject: (projectId: string) => window.api.delete_project(projectId).then(unwrapResult),
  createResource: (input: CreateResourceInput) => window.api.create_resource(input).then(unwrapResult),
  updateResource: (resourceId: string, input: Omit<UpdateResourceInput, 'resource_id'>) => window.api.update_resource(resourceId, input).then(unwrapResult),
  deleteResource: (resourceId: string) => window.api.delete_resource(resourceId).then(unwrapResult),
  getResourceDetail: (resourceId: string) => window.api.get_resource_detail(resourceId).then(unwrapResult),
  continueResource: (input: Parameters<typeof window.api.continue_resource>[0]) => window.api.continue_resource(input).then(unwrapResult),
  closePendingSession: (sessionId: string, closeSource: PendingCloseSource) => window.api.close_pending_session(sessionId, closeSource).then(unwrapResult),
  abandonPendingSession: (sessionId: string) => window.api.abandon_pending_session(sessionId).then(unwrapResult),
  attemptBreakthrough: (projectId: string) => window.api.attempt_breakthrough(projectId).then(unwrapResult),
  saveStudyLog: (input: SaveStudyLogInput) => window.api.save_study_log(input),
  selectLocalFile: (input: Parameters<typeof window.api.select_local_file>[0]) => window.api.select_local_file(input),
  onPendingSessionClosed: (callback: Parameters<typeof window.api.on_pending_session_closed>[0]) => window.api.on_pending_session_closed(callback),
};
