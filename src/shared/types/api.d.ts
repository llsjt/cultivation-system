import type {
  ContinueResourceInput,
  ContinueResourceOutput,
  CreateProjectInput,
  CreateResourceInput,
  GetEnumsOutput,
  GetHomeOverviewOutput,
  GetProjectDetailOutput,
  IpcResult,
  ListProjectsInput,
  Page,
  ProjectSummary,
  ResourceDetail,
  ResourceSummary,
  SaveStudyLogInput,
  SaveStudyLogOutput,
  UpdateResourceInput,
} from '../dto';

export interface CultivationAPI {
  get_home_overview(): Promise<IpcResult<GetHomeOverviewOutput>>;
  list_projects(input?: ListProjectsInput): Promise<IpcResult<Page<ProjectSummary>>>;
  get_project_detail(project_id: string, input?: { limit?: number; offset?: number }): Promise<IpcResult<GetProjectDetailOutput>>;
  create_project(input: CreateProjectInput): Promise<IpcResult<ProjectSummary>>;
  update_project(project_id: string, input: Omit<CreateProjectInput, 'project_id'>): Promise<IpcResult<ProjectSummary>>;
  delete_project(project_id: string): Promise<IpcResult<{ deleted: true }>>;
  create_resource(input: CreateResourceInput): Promise<IpcResult<ResourceSummary>>;
  update_resource(resource_id: string, input: Omit<UpdateResourceInput, 'resource_id'>): Promise<IpcResult<ResourceSummary>>;
  delete_resource(resource_id: string): Promise<IpcResult<{ deleted: true }>>;
  get_resource_detail(resource_id: string): Promise<IpcResult<ResourceDetail>>;
  continue_resource(input: ContinueResourceInput): Promise<IpcResult<ContinueResourceOutput>>;
  save_study_log(input: SaveStudyLogInput): Promise<IpcResult<SaveStudyLogOutput>>;
  get_pending_session(): Promise<IpcResult<import('../dto').PendingSessionView | null>>;
  abandon_pending_session(session_id: string): Promise<IpcResult<{ abandoned: true }>>;
  get_enums(): Promise<IpcResult<GetEnumsOutput>>;
}

declare global {
  interface Window {
    api: CultivationAPI;
  }
}

export {};
