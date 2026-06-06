import { BookOpen, FilePlus2, Info, Pencil, Play, Plus, Search, Trash2 } from 'lucide-react';
import { useState, type FormEvent, useMemo, useEffect } from 'react';

import type { GetEnumsOutput, GetHomeOverviewOutput, GetProjectDetailOutput, ResourceSummary, ResourceDetail } from '../../../shared/dto';
import type { CultivationRole, OpenKind, ResourceType } from '../../../shared/enums';
import { ProgressBar } from '../../components/ProgressBar';
import type { LogDraft } from '../../types';
import { getResourceRoleDisplay, getResourceStatusLabel, getResourceTypeLabel, getResourceWeightDisplay } from './resourceDisplay';

type ProjectSummary = GetHomeOverviewOutput['projects'][number];

type ResourceManagementPanelProps = {
  selectedProject: ProjectSummary | null;
  projectDetail: GetProjectDetailOutput | null;
  resourceTitle: string;
  resourceType: ResourceType;
  cultivationRole: CultivationRole;
  masteryGroup: string;
  masteryWeight: string;
  openKind: OpenKind;
  pathOrUrl: string;
  initialProgress: string;
  initialNextAction: string;
  resourceTypes: GetEnumsOutput['resource_type'];
  cultivationRoles: GetEnumsOutput['cultivation_role'];
  openKinds: GetEnumsOutput['open_kind'];
  busy: boolean;
  onResourceTitleChange: (value: string) => void;
  onResourceTypeChange: (value: ResourceType) => void;
  onCultivationRoleChange: (value: CultivationRole) => void;
  onMasteryGroupChange: (value: string) => void;
  onMasteryWeightChange: (value: string) => void;
  onOpenKindChange: (value: OpenKind) => void;
  onPathOrUrlChange: (value: string) => void;
  onInitialProgressChange: (value: string) => void;
  onInitialNextActionChange: (value: string) => void;
  onSubmitResource: (event: FormEvent) => Promise<void>;
  onPickPath: (kind: 'file' | 'folder') => Promise<void>;
  onEditProject: (project: ProjectSummary) => void;
  onDeleteProject: (projectId: string) => Promise<void>;
  onContinueResource: (resource: ResourceSummary) => Promise<void>;
  onOpenLog: (resource: ResourceSummary, source: LogDraft['source']) => void;
  onShowResourceDetail: (resource: ResourceSummary) => Promise<void>;
  onStartEditResource: (resource: ResourceSummary) => Promise<void>;
  onDeleteResource: (resource: ResourceSummary) => Promise<void>;
};

type ResourcePanelViewState = {
  projectId: string | null;
  selectedResourceId: string | null;
  isCreatingResource: boolean;
  searchQuery: string;
  statusFilter: string;
};

function createResourcePanelViewState(projectId: string | null): ResourcePanelViewState {
  return {
    projectId,
    selectedResourceId: null,
    isCreatingResource: false,
    searchQuery: '',
    statusFilter: 'all',
  };
}

export function ResourceManagementPanel({
  selectedProject,
  projectDetail,
  resourceTitle,
  resourceType,
  cultivationRole,
  masteryGroup,
  masteryWeight,
  openKind,
  pathOrUrl,
  initialProgress,
  initialNextAction,
  resourceTypes,
  cultivationRoles,
  openKinds,
  busy,
  onResourceTitleChange,
  onResourceTypeChange,
  onCultivationRoleChange,
  onMasteryGroupChange,
  onMasteryWeightChange,
  onOpenKindChange,
  onPathOrUrlChange,
  onInitialProgressChange,
  onInitialNextActionChange,
  onSubmitResource,
  onPickPath,
  onEditProject,
  onDeleteProject,
  onContinueResource,
  onOpenLog,
  onShowResourceDetail,
  onStartEditResource,
  onDeleteResource,
}: ResourceManagementPanelProps) {
  const currentProjectId = selectedProject?.id ?? null;
  const [viewState, setViewState] = useState<ResourcePanelViewState>(() => createResourcePanelViewState(currentProjectId));
  const [resourceDetail, setResourceDetail] = useState<ResourceDetail | null>(null);
  const activeViewState = viewState.projectId === currentProjectId ? viewState : createResourcePanelViewState(currentProjectId);
  const { selectedResourceId, isCreatingResource, searchQuery, statusFilter } = activeViewState;
  const updateViewState = (patch: Partial<Omit<ResourcePanelViewState, 'projectId'>>) => {
    setViewState((state) => ({
      ...(state.projectId === currentProjectId ? state : createResourcePanelViewState(currentProjectId)),
      ...patch,
      projectId: currentProjectId,
    }));
  };

  const preferredResourceId = useMemo(() => {
    const resources = projectDetail?.resources.items ?? [];
    return resources.find((resource) => resource.status !== 'completed')?.id ?? resources[0]?.id ?? null;
  }, [projectDetail]);

  const effectiveSelectedResourceId = isCreatingResource ? null : (selectedResourceId ?? preferredResourceId);

  // Fetch local resource detail logs reactively when selection or log database updates
  useEffect(() => {
    if (!effectiveSelectedResourceId) {
      return;
    }
    let active = true;
    void window.api
      .get_resource_detail(effectiveSelectedResourceId)
      .then((res) => {
        if (!active) {
          return;
        }
        setResourceDetail(res.ok ? res.data : null);
      })
      .catch((err: unknown) => {
        if (active) {
          console.error('Failed to load resource detail:', err);
          setResourceDetail(null);
        }
      });
    return () => {
      active = false;
    };
  }, [effectiveSelectedResourceId, projectDetail?.resources.items]);
  const selectedResourceDetail = resourceDetail?.id === effectiveSelectedResourceId ? resourceDetail : null;

  // Filter resources locally for master list
  const filteredResources = useMemo(() => {
    if (!projectDetail) return [];
    return projectDetail.resources.items.filter((res) => {
      const matchesSearch = res.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || res.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [projectDetail, searchQuery, statusFilter]);

  // Get selected resource metadata
  const activeResource = useMemo(() => {
    return projectDetail?.resources.items.find((item) => item.id === effectiveSelectedResourceId) ?? null;
  }, [effectiveSelectedResourceId, projectDetail]);

  if (!selectedProject) {
    return (
      <section className="detail-panel side-panel grid place-items-center h-80">
        <p className="empty text-center">请先在左侧选择或创建一个修炼方向以查阅和管理资料。</p>
      </section>
    );
  }

  return (
    <section className="detail-panel side-panel resource-panel">
      {/* Direction Header */}
      <div className="panel-heading resource-panel-header">
        <div>
          <p className="eyebrow">法门内景</p>
          <h2>{selectedProject.name}</h2>
        </div>
        <div className="actions resource-panel-actions">
          <button
            className="ghost-button"
            type="button"
            onClick={() => onEditProject(selectedProject)}
            disabled={busy}
            title="编辑当前修炼方向"
          >
            <Pencil size={14} />
            <span>编辑方向</span>
          </button>
          <button
            className="danger-button"
            type="button"
            onClick={() => void onDeleteProject(selectedProject.id)}
            disabled={busy}
            title="废弃此法门"
          >
            <Trash2 size={14} />
            <span>删除方向</span>
          </button>
        </div>
      </div>

      <div className="resource-double-column">
        {/* ==================== LEFT COLUMN: MASTER LIST ==================== */}
        <div className="resource-master-list">
          <div className="resource-master-list-header">
            <div className="resource-master-list-title-row">
              <span className="resource-master-list-title">秘卷名录</span>
              <button
                className="primary-button compact-btn"
                type="button"
                onClick={() => updateViewState({ selectedResourceId: null, isCreatingResource: true })}
                title="迎请新修仙秘籍"
              >
                <Plus size={14} />
                添加资料
              </button>
            </div>
            <div className="resource-search-field">
              <input
                className="resource-search-input"
                value={searchQuery}
                onChange={(e) => updateViewState({ searchQuery: e.target.value })}
                placeholder="搜索当前秘籍..."
                aria-label="搜索当前方向资料"
              />
              <Search size={14} className="muted" aria-hidden="true" />
            </div>
            <div className="resource-filter-row">
              <select
                className="resource-filter-select"
                value={statusFilter}
                onChange={(e) => updateViewState({ statusFilter: e.target.value })}
              >
                <option value="all">所有状态</option>
                <option value="not_started">尚未面世</option>
                <option value="learning">正在参悟</option>
                <option value="review">温故知新</option>
                <option value="paused">道行搁置</option>
                <option value="completed">大圆满</option>
              </select>
            </div>
          </div>

          <div className="resource-master-list-scroller" aria-label="当前方向资料列表">
            {filteredResources.map((resource) => {
                const roleDisplay = getResourceRoleDisplay(resource.cultivation_role);
                return (
              <div
                className={`compact-resource-card ${effectiveSelectedResourceId === resource.id ? 'active' : ''}`}
                key={resource.id}
              >
                <button
                  aria-current={effectiveSelectedResourceId === resource.id ? 'true' : undefined}
                  className="compact-resource-select"
                  type="button"
                  onClick={() => updateViewState({ selectedResourceId: resource.id, isCreatingResource: false })}
                >
                  <div className="compact-resource-card-main">
                    <span className="compact-resource-title">{resource.title}</span>
                    <div className="compact-resource-meta">
                      <span className={`resource-badge ${resource.type}`}>
                        {getResourceTypeLabel(resource.type)}
                      </span>
                      <span className={`resource-role-chip ${roleDisplay.tone}`} title={roleDisplay.description}>{roleDisplay.label}</span>
                      <span>{resource.progress_percent}%</span>
                    </div>
                  </div>
                </button>
                <button
                  className="compact-resource-play"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void onContinueResource(resource);
                  }}
                  disabled={busy}
                  title="一键闭关"
                  aria-label={`继续学习 ${resource.title}`}
                >
                  <Play size={14} fill="currentColor" />
                </button>
              </div>
                );
              })}
            {filteredResources.length === 0 && (
              <p className="empty text-xs py-8 text-center" style={{ fontSize: '14px' }}>
                暂无匹配秘卷
              </p>
            )}
          </div>
        </div>

        {/* ==================== RIGHT COLUMN: DETAIL PANE ==================== */}
        <div className="resource-detail-pane" aria-live="polite">
          {isCreatingResource ? (
            <div className="resource-detail-shell">
              <div>
                <p className="eyebrow">洞天引渡</p>
                <h3>添加新资料</h3>
              </div>
              <form
                className="resource-form resource-create-form"
                onSubmit={async (event) => {
                  await onSubmitResource(event);
                  updateViewState({ selectedResourceId: null, isCreatingResource: false });
                }}
              >
                <label className="form-field" htmlFor="resource-title-input">
                  <span>资料名</span>
                  <input id="resource-title-input" value={resourceTitle} onChange={(event) => onResourceTitleChange(event.target.value)} placeholder="例如：React 官方文档" required maxLength={200} />
                </label>
                <label className="form-field" htmlFor="resource-type-select">
                  <span>类型</span>
                  <select id="resource-type-select" value={resourceType} onChange={(event) => onResourceTypeChange(event.target.value as ResourceType)}>
                    {resourceTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-field" htmlFor="resource-open-kind-select">
                  <span>打开方式</span>
                  <select id="resource-open-kind-select" value={openKind} onChange={(event) => onOpenKindChange(event.target.value as OpenKind)}>
                    {openKinds.map((kind) => (
                      <option key={kind.value} value={kind.value}>
                        {kind.label}
                      </option>
                    ))}
                  </select>
                </label>
                {openKind !== 'record_only' ? (
                  <label className="form-field" htmlFor="resource-path-input">
                    <span>{openKind === 'url' ? '网页链接' : openKind === 'folder' ? '本地文件夹路径' : '本地文件路径'}</span>
                    <div className="path-input-group">
                      <input
                        id="resource-path-input"
                        value={pathOrUrl}
                        onChange={(event) => onPathOrUrlChange(event.target.value)}
                        placeholder={openKind === 'file' ? '选择或粘贴本地文件路径' : openKind === 'folder' ? '选择或粘贴本地文件夹路径' : 'https://example.com/course'}
                        required
                        maxLength={2048}
                      />
                      {openKind === 'file' || openKind === 'folder' ? (
                        <button className="secondary-button path-picker-btn" type="button" onClick={() => void onPickPath(openKind as 'file' | 'folder')} disabled={busy}>
                          浏览
                        </button>
                      ) : null}
                    </div>
                  </label>
                ) : null}
                <label className="form-field" htmlFor="resource-progress-input">
                  <span>初始进度</span>
                  <input id="resource-progress-input" value={initialProgress} onChange={(event) => onInitialProgressChange(event.target.value)} type="number" min={0} max={100} aria-describedby="resource-progress-hint" />
                  <small id="resource-progress-hint" className="field-hint">范围 0-100，之后可通过记录进度更新。</small>
                </label>
                <label className="form-field" htmlFor="resource-role-select">
                  <span>修炼定位</span>
                  <select id="resource-role-select" value={cultivationRole} onChange={(event) => onCultivationRoleChange(event.target.value as CultivationRole)}>
                    {cultivationRoles.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-field" htmlFor="resource-next-action-input">
                  <span>下次目标</span>
                  <input id="resource-next-action-input" value={initialNextAction} onChange={(event) => onInitialNextActionChange(event.target.value)} placeholder="例如：读完 Hooks 章节并做笔记" maxLength={500} />
                </label>
                <div className="advanced-fields">
                  <span className="field-label">进阶设置</span>
                  <div className="advanced-field-grid">
                    <label className="form-field" htmlFor="resource-mastery-group-input">
                      <span>分组</span>
                      <input id="resource-mastery-group-input" value={masteryGroup} onChange={(event) => onMasteryGroupChange(event.target.value)} placeholder="可选" maxLength={120} />
                    </label>
                    <label className="form-field" htmlFor="resource-mastery-weight-input">
                      <span>权重</span>
                      <input id="resource-mastery-weight-input" value={masteryWeight} onChange={(event) => onMasteryWeightChange(event.target.value)} type="number" min={1} max={5} aria-describedby="resource-mastery-weight-hint" />
                    </label>
                  </div>
                  <small id="resource-mastery-weight-hint" className="field-hint">方向代表性 1-5，用于表达这份资料对当前方向境界反馈的影响程度。</small>
                </div>
                <button className="secondary-button" type="submit" disabled={busy}>
                  <FilePlus2 size={14} />
                  加入秘籍库
                </button>
              </form>
            </div>
          ) : (
            /* Render Selected Book Details & Local Logs Timeline */
            activeResource ? (
              <div className="resource-detail-shell">
                {(() => {
                  const roleDisplay = getResourceRoleDisplay(activeResource.cultivation_role);
                  const weightDisplay = getResourceWeightDisplay(activeResource.mastery_weight);
                  return (
                    <>
                <div className="resource-detail-header">
                  <div className="resource-detail-header-left">
                    <span className={`resource-badge ${activeResource.type}`}>
                      {getResourceTypeLabel(activeResource.type)}
                    </span>
                    <span className={`resource-role-chip ${roleDisplay.tone}`} title={roleDisplay.description}>
                      {roleDisplay.label}
                    </span>
                    <h2>{activeResource.title}</h2>
                  </div>
                  <div className="resource-detail-tools">
                    <button
                      className="ghost-button icon-button"
                      type="button"
                      onClick={() => void onShowResourceDetail(activeResource)}
                      disabled={busy}
                      title="查看资料详情"
                      aria-label="查看资料详情"
                    >
                      <Info size={13} />
                    </button>
                    <button className="ghost-button icon-button" type="button" onClick={() => void onStartEditResource(activeResource)} disabled={busy} title="编辑资料" aria-label="编辑资料">
                      <Pencil size={13} />
                    </button>
                    <button
                      className="danger-button icon-button"
                      type="button"
                      onClick={() => {
                        void onDeleteResource(activeResource).then(() => {
                          updateViewState({ selectedResourceId: null, isCreatingResource: false });
                        });
                      }}
                      disabled={busy}
                      title="删除资料"
                      aria-label="删除资料"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <div className="resource-detail-body">
                  <div className="resource-progress-line">
                    <ProgressBar value={activeResource.progress_percent} />
                    <span>{activeResource.progress_percent}%</span>
                  </div>

                  <div className="resource-detail-item">
                    <span className="eyebrow" style={{ fontSize: '15px' }}>当前参悟境界</span>
                    <div className="resource-detail-desc">
                      {activeResource.progress_text || '尚未记录具体参悟境界描述。此秘典博大精深，请及时出关记录心得。'}
                    </div>
                  </div>

                  <div className="resource-detail-item">
                    <span className="eyebrow" style={{ fontSize: '15px' }}>下步参悟宏愿</span>
                    <div className="resource-detail-next-target">
                      {activeResource.next_action || '尚未许下二次修仙的宏大目标。'}
                    </div>
                  </div>

                  <div className="resource-detail-meta-grid">
                    <div className="resource-detail-meta-item" title={selectedResourceDetail?.path_or_url_raw || ''}>
                      <span>仙途媒介：</span>
                      <strong>{activeResource.open_kind === 'record_only' ? '仅记录' : activeResource.open_kind === 'file' ? '本地文件' : activeResource.open_kind === 'folder' ? '本地文件夹' : '灵网链接'}</strong>
                    </div>
                    <div className="resource-detail-meta-item">
                      <span>最近修炼：</span>
                      <strong>{activeResource.last_studied_at ? new Date(activeResource.last_studied_at).toLocaleDateString() : '尚未开坛'}</strong>
                    </div>
                    <div className="resource-detail-meta-item" title={roleDisplay.description}>
                      <span>修炼定位：</span>
                      <strong>{roleDisplay.label}</strong>
                    </div>
                    <div className="resource-detail-meta-item" title={weightDisplay.description}>
                      <span>方向代表性：</span>
                      <strong>{weightDisplay.valueLabel}</strong>
                    </div>
                    <div className="resource-detail-meta-item">
                      <span>当前状态：</span>
                      <strong>{getResourceStatusLabel(activeResource.status)}</strong>
                    </div>
                  </div>

                  {/* Local Study Logs Timeline */}
                  <div className="resource-detail-logs-title">
                    <span>本卷参悟印记 ({selectedResourceDetail?.recent_logs.length || 0})</span>
                  </div>
                  <div className="resource-detail-logs-list">
                    {selectedResourceDetail?.recent_logs.map((log) => (
                      <div className="resource-detail-log-card" key={log.id}>
                        <div className="resource-detail-log-card-header">
                          <span style={{ fontWeight: 'bold', color: 'var(--accent-strong)' }}>进度: {log.progress_before_percent}% → {log.progress_after_percent}%</span>
                          <span>{new Date(log.studied_at).toLocaleDateString()}</span>
                        </div>
                        <div style={{ margin: 0, fontSize: '14px', color: 'var(--text)' }}>
                          {log.content ? `“${log.content}”` : '打坐研读，小有心得。'}
                        </div>
                        {log.duration_minutes && (
                          <div style={{ fontSize: '14px', color: 'var(--muted)', textAlign: 'right' }}>
                            修持 {log.duration_minutes} 分钟
                          </div>
                        )}
                      </div>
                    ))}
                    {(!selectedResourceDetail?.recent_logs || selectedResourceDetail.recent_logs.length === 0) && (
                      <p className="empty text-xs py-4 text-center" style={{ fontSize: '14px' }}>
                        本卷尚未有参悟留痕。点击下方按钮开始闭关！
                      </p>
                    )}
                  </div>

                  {/* Primary Actions for selected book */}
                  <div className="resource-detail-actions">
                    <button className="primary-button" type="button" onClick={() => void onContinueResource(activeResource)} disabled={busy} aria-label={`继续学习 ${activeResource.title}`}>
                      <Play size={16} fill="currentColor" />
                      继续学习
                    </button>
                    <button className="ghost-button" type="button" onClick={() => onOpenLog(activeResource, 'manual')} disabled={busy} aria-label={`记录进度 ${activeResource.title}`}>
                      <BookOpen size={16} />
                      记录进度
                    </button>
                  </div>
                </div>
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="resource-detail-empty resource-empty-state">
                <h3>{projectDetail?.resources.items.length ? '选择一份资料' : '还没有资料'}</h3>
                <p className="text-xs muted">
                  {projectDetail?.resources.items.length ? '从左侧列表选择资料以查看进度和最近记录。' : '添加第一份资料后，就可以开始记录学习进度。'}
                </p>
                <button className="primary-button" type="button" onClick={() => updateViewState({ selectedResourceId: null, isCreatingResource: true })}>
                  <Plus size={14} />
                  添加资料
                </button>
              </div>
            )
          )}
        </div>
      </div>
    </section>
  );
}
