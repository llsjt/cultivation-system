import { FolderPlus } from 'lucide-react';
import type { FormEvent } from 'react';

import type { GetHomeOverviewOutput } from '../../../shared/dto';

type ProjectSummary = GetHomeOverviewOutput['projects'][number];

type ProjectSidebarProps = {
  overview: GetHomeOverviewOutput;
  selectedProject: ProjectSummary | null;
  showNewProject: boolean;
  projectName: string;
  projectDescription: string;
  busy: boolean;
  onToggleNewProject: () => void;
  onCloseNewProject: () => void;
  onProjectNameChange: (value: string) => void;
  onProjectDescriptionChange: (value: string) => void;
  onSubmitProject: (event: FormEvent) => Promise<void>;
  onSelectProject: (projectId: string) => void;
};

function formatSavedAt(dateStr: string | null): string {
  if (!dateStr) return '等待首次本地保存';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const date = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${year}年${month}月${date}日 ${hours}:${minutes}:${seconds}`;
  } catch {
    return dateStr;
  }
}

export function ProjectSidebar({
  overview,
  selectedProject,
  showNewProject,
  projectName,
  projectDescription,
  busy,
  onToggleNewProject,
  onCloseNewProject,
  onProjectNameChange,
  onProjectDescriptionChange,
  onSubmitProject,
  onSelectProject,
}: ProjectSidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo-wrap">
          <span className="logo-icon">☯</span>
          <div>
            <p className="eyebrow">修真道统</p>
            <h1>修仙参悟系统</h1>
          </div>
        </div>
        <p className="save-status">{formatSavedAt(overview.last_saved_at)}</p>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section-header">
          <h2>修炼方向</h2>
          <button
            className={`icon-button new-project-toggle ${showNewProject ? 'active' : ''}`}
            type="button"
            onClick={onToggleNewProject}
            title="新建方向"
            aria-label="新建修炼方向"
          >
            <FolderPlus size={16} />
          </button>
        </div>

        {showNewProject ? (
          <div className="sidebar-new-project-panel">
            <form
              className="stack-form"
              onSubmit={async (event) => {
                await onSubmitProject(event);
                onCloseNewProject();
              }}
            >
              <input value={projectName} onChange={(event) => onProjectNameChange(event.target.value)} placeholder="方向名称" required maxLength={120} />
              <textarea value={projectDescription} onChange={(event) => onProjectDescriptionChange(event.target.value)} placeholder="描述..." maxLength={1000} />
              <div className="form-actions">
                <button className="secondary-button" type="submit" disabled={busy}>
                  保存方向
                </button>
                <button className="ghost-button compact-btn" type="button" onClick={onCloseNewProject}>
                  取消
                </button>
              </div>
            </form>
          </div>
        ) : null}

        <div className="item-list sidebar-project-list">
          {overview.projects.map((project) => (
            <button className={`list-item ${project.id === selectedProject?.id ? 'active' : ''}`} key={project.id} type="button" onClick={() => onSelectProject(project.id)}>
              <div className="list-item-main">
                <span className="project-dot">●</span>
                <span className="project-name">{project.name}</span>
              </div>
              <small className="project-meta">
                {project.progress_percent}% · {project.resource_count} 份资料
              </small>
            </button>
          ))}
          {overview.projects.length === 0 ? <p className="empty">暂无方向</p> : null}
          <button
            className="secondary-button dashed-btn project-add-btn"
            style={{
              marginTop: '8px',
              borderStyle: 'dashed',
              justifyContent: 'center',
              display: 'flex',
              gap: '6px',
              alignItems: 'center',
              minHeight: '36px',
              fontSize: '14px',
              borderColor: 'var(--accent)',
              background: 'rgba(34, 211, 238, 0.05)',
              width: '100%'
            }}
            type="button"
            onClick={onToggleNewProject}
          >
            <FolderPlus size={14} />
            开启新法门
          </button>
        </div>
      </nav>
    </aside>
  );
}
