import type {
  ContinueResourceInput,
  ContinueResourceOutput,
  CreateProjectInput,
  CreateResourceInput,
  AttemptBreakthroughOutput,
  GetEnumsOutput,
  GetHomeOverviewOutput,
  GetProjectCultivationOutput,
  GetProjectDetailOutput,
  IpcResult,
  ListProjectsInput,
  Page,
  PendingSessionView,
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
  get_project_cultivation(project_id: string): Promise<IpcResult<GetProjectCultivationOutput>>;
  attempt_breakthrough(project_id: string): Promise<IpcResult<AttemptBreakthroughOutput>>;
  create_project(input: CreateProjectInput): Promise<IpcResult<ProjectSummary>>;
  update_project(project_id: string, input: Omit<CreateProjectInput, 'project_id'>): Promise<IpcResult<ProjectSummary>>;
  delete_project(project_id: string): Promise<IpcResult<{ deleted: true }>>;
  create_resource(input: CreateResourceInput): Promise<IpcResult<ResourceSummary>>;
  update_resource(resource_id: string, input: Omit<UpdateResourceInput, 'resource_id'>): Promise<IpcResult<ResourceSummary>>;
  delete_resource(resource_id: string): Promise<IpcResult<{ deleted: true }>>;
  get_resource_detail(resource_id: string): Promise<IpcResult<ResourceDetail>>;
  continue_resource(input: ContinueResourceInput): Promise<IpcResult<ContinueResourceOutput>>;
  save_study_log(input: SaveStudyLogInput): Promise<IpcResult<SaveStudyLogOutput>>;
  get_pending_session(): Promise<IpcResult<PendingSessionView | null>>;
  abandon_pending_session(session_id: string): Promise<IpcResult<{ abandoned: true }>>;
  close_pending_session(session_id: string, close_source: 'viewer_closed' | 'user_ended' | 'app_recovered'): Promise<IpcResult<PendingSessionView>>;
  on_pending_session_closed(callback: (pending: PendingSessionView) => void): () => void;
  get_enums(): Promise<IpcResult<GetEnumsOutput>>;
  select_local_file(input?: { properties?: Array<'openFile' | 'openDirectory'> }): Promise<IpcResult<string | null>>;
}

declare global {
  interface Window {
    api: CultivationAPI;
  }
}

export {};
