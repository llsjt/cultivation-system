import { FilePlus2, MoreVertical, Pencil, Play, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import type { GetEnumsOutput, GetHomeOverviewOutput, GetProjectDetailOutput, ResourceSummary } from '../../../shared/dto';
import type { CultivationRole, OpenKind, ResourceType } from '../../../shared/enums';
import { ProgressBar } from '../../components/ProgressBar';
import type { LogDraft } from '../../types';

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
  const [showForm, setShowForm] = useState(false);
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);

  return (
    <section className="detail-panel side-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">法门内景</p>
          <h2>{selectedProject?.name ?? '暂无选定法门'}</h2>
        </div>
        {selectedProject ? (
          <div className="actions">
            <button className="ghost-button" type="button" onClick={() => onEditProject(selectedProject)} disabled={busy} title="编辑方向">
              <Pencil size={16} />
            </button>
            <button className="danger-button" type="button" onClick={() => onDeleteProject(selectedProject.id)} disabled={busy} title="删除方向">
              <Trash2 size={16} />
            </button>
          </div>
        ) : null}
      </div>

      {selectedProject ? (
        <>
          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'flex-start' }}>
            <button
              className={`primary-button compact-btn resource-add-toggle ${showForm ? 'active' : ''}`}
              type="button"
              onClick={() => setShowForm(!showForm)}
              style={{
                gap: '6px',
                fontSize: '14px',
                padding: '6px 14px',
                minHeight: '34px',
                width: '100%',
                justifyContent: 'center',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <FilePlus2 size={15} />
              {showForm ? '收起法卷表单' : '迎请新修仙秘籍'}
            </button>
          </div>

          {showForm ? (
            <form
              className="resource-form"
              onSubmit={async (event) => {
                await onSubmitResource(event);
                setShowForm(false);
              }}
            >
              <input value={resourceTitle} onChange={(event) => onResourceTitleChange(event.target.value)} placeholder="资料名" required maxLength={200} />
              <select value={resourceType} onChange={(event) => onResourceTypeChange(event.target.value as ResourceType)}>
                {resourceTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              <select value={cultivationRole} onChange={(event) => onCultivationRoleChange(event.target.value as CultivationRole)}>
                {cultivationRoles.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
              <select value={openKind} onChange={(event) => onOpenKindChange(event.target.value as OpenKind)}>
                {openKinds.map((kind) => (
                  <option key={kind.value} value={kind.value}>
                    {kind.label}
                  </option>
                ))}
              </select>
              {openKind !== 'record_only' ? (
                <div className="path-input-group">
                  <input
                    value={pathOrUrl}
                    onChange={(event) => onPathOrUrlChange(event.target.value)}
                    placeholder={openKind === 'file' ? '本地文件路径' : openKind === 'folder' ? '本地文件夹路径' : '网页链接'}
                    required
                    maxLength={2048}
                  />
                  {openKind === 'file' || openKind === 'folder' ? (
                    <button className="secondary-button path-picker-btn" type="button" onClick={() => onPickPath(openKind as 'file' | 'folder')} disabled={busy}>
                      浏览
                    </button>
                  ) : null}
                </div>
              ) : null}
              <input value={initialProgress} onChange={(event) => onInitialProgressChange(event.target.value)} type="number" min={0} max={100} placeholder="初始进度" />
              <input value={masteryGroup} onChange={(event) => onMasteryGroupChange(event.target.value)} placeholder="同源组，可空" maxLength={120} />
              <input value={masteryWeight} onChange={(event) => onMasteryWeightChange(event.target.value)} type="number" min={1} max={5} placeholder="权重" />
              <input value={initialNextAction} onChange={(event) => onInitialNextActionChange(event.target.value)} placeholder="下次闭关目标" maxLength={500} />
              <button className="secondary-button" type="submit" disabled={busy}>
                <FilePlus2 size={16} />
                加入资料
              </button>
            </form>
          ) : null}

          <div className="resource-list">
            {projectDetail?.resources.items.map((resource) => (
              <article className="resource-row" key={resource.id}>
                <div className="resource-info">
                  <div className="resource-title-row">
                    <span className={`resource-badge ${resource.type}`}>{resourceTypes.find((type) => type.value === resource.type)?.label ?? resource.type}</span>
                    <span className="resource-badge">{cultivationRoles.find((role) => role.value === resource.cultivation_role)?.label ?? resource.cultivation_role}</span>
                    <h3>{resource.title}</h3>
                  </div>
                  <p>{resource.progress_text || '尚未记录进度描述。'}</p>
                  <p className="next-action">
                    <strong className="action-tag">目标：</strong>
                    {resource.next_action || '还没有设置下次闭关目标。'}
                  </p>
                  <ProgressBar value={resource.progress_percent} />
                </div>
                <div className="resource-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                  <button className="primary-button" type="button" onClick={() => onContinueResource(resource)} disabled={busy} style={{ flex: 1, minHeight: '32px' }}>
                    <Play size={14} />
                    继续闭关
                  </button>
                  <button className="ghost-button" type="button" onClick={() => onOpenLog(resource, 'manual')} disabled={busy} style={{ flex: 1, minHeight: '32px' }}>
                    出关记录
                  </button>
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <button
                      className="ghost-button icon-button"
                      type="button"
                      onClick={() => setActiveDropdownId(activeDropdownId === resource.id ? null : resource.id)}
                      title="更多操作"
                      aria-label="更多操作"
                      style={{ minHeight: '32px', width: '32px', padding: 0, justifyContent: 'center', display: 'flex', alignItems: 'center' }}
                    >
                      <MoreVertical size={16} />
                    </button>
                    {activeDropdownId === resource.id ? (
                      <>
                        <div
                          style={{
                            position: 'fixed',
                            inset: 0,
                            zIndex: 100,
                            cursor: 'default',
                          }}
                          onClick={() => setActiveDropdownId(null)}
                        />
                        <div
                          className="dropdown-menu"
                          style={{
                            position: 'absolute',
                            right: 0,
                            bottom: '100%',
                            marginBottom: '6px',
                            zIndex: 101,
                            minWidth: '120px',
                            background: 'var(--surface-strong)',
                            border: '1px solid var(--line-strong)',
                            borderRadius: '6px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                            padding: '4px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px',
                          }}
                        >
                          <button
                            className="dropdown-item ghost-button"
                            type="button"
                            onClick={() => {
                              onShowResourceDetail(resource);
                              setActiveDropdownId(null);
                            }}
                            disabled={busy}
                            style={{
                              justifyContent: 'flex-start',
                              padding: '6px 10px',
                              fontSize: '14px',
                              width: '100%',
                              minHeight: '30px',
                              border: 'none',
                              background: 'transparent'
                            }}
                          >
                            详情
                          </button>
                          <button
                            className="dropdown-item ghost-button"
                            type="button"
                            onClick={() => {
                              onStartEditResource(resource);
                              setActiveDropdownId(null);
                            }}
                            disabled={busy}
                            style={{
                              justifyContent: 'flex-start',
                              padding: '6px 10px',
                              fontSize: '14px',
                              width: '100%',
                              minHeight: '30px',
                              border: 'none',
                              background: 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            <Pencil size={12} />
                            编辑资料
                          </button>
                          <div style={{ height: '1px', background: 'var(--line)', margin: '4px 0' }} />
                          <button
                            className="dropdown-item danger-button"
                            type="button"
                            onClick={() => {
                              onDeleteResource(resource);
                              setActiveDropdownId(null);
                            }}
                            disabled={busy}
                            style={{
                              justifyContent: 'flex-start',
                              padding: '6px 10px',
                              fontSize: '14px',
                              width: '100%',
                              minHeight: '30px',
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--cinnabar)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            <Trash2 size={12} />
                            删除资料
                          </button>
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
            {projectDetail && projectDetail.resources.items.length === 0 ? <p className="empty">此方向下暂无秘籍资料，请在上方添加。</p> : null}
          </div>
        </>
      ) : (
        <p className="empty">请先在左侧选择或创建一个修炼方向以查阅和管理资料。</p>
      )}
    </section>
  );
}
