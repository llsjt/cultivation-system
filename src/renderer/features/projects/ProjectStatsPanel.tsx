import type { GetHomeOverviewOutput, GetProjectCultivationOutput } from '../../../shared/dto';

type ProjectSummary = GetHomeOverviewOutput['projects'][number];

type ProjectStatsPanelProps = {
  overview: GetHomeOverviewOutput;
  selectedProject: ProjectSummary | null;
  cultivation: GetProjectCultivationOutput | null;
};

export function ProjectStatsPanel({ overview, selectedProject, cultivation }: ProjectStatsPanelProps) {
  const totalProjects = overview.projects.length;
  const totalResources = overview.projects.reduce((sum, project) => sum + project.resource_count, 0);
  const averageProgress = overview.projects.length
    ? Math.round(overview.projects.reduce((sum, project) => sum + project.progress_percent, 0) / overview.projects.length)
    : 0;
  const totalRecentLogs = overview.recent_logs.length;

  return (
    <div className="wukong-profile-panel">
      <div className="wukong-profile-header">
        <h2>【 元神法相 】</h2>
        <p className="eyebrow text-center">元神根骨</p>
      </div>

      <div className="wukong-stat-group">
        <div className="wukong-stat-group-header">
          <span>元神根基</span>
        </div>
        <div className="wukong-stat-item">
          <span className="stat-label">参悟法门</span>
          <span className="stat-divider"></span>
          <span className="stat-value">{totalProjects} 门</span>
        </div>
        <div className="wukong-stat-item">
          <span className="stat-label">研读法宝</span>
          <span className="stat-divider"></span>
          <span className="stat-value">{totalResources} 册</span>
        </div>
        <div className="wukong-stat-item">
          <span className="stat-label">修行时日</span>
          <span className="stat-divider"></span>
          <span className="stat-value text-sm">{overview.last_saved_at ? '已保存' : '新参悟'}</span>
        </div>
      </div>

      <div className="wukong-stat-group">
        <div className="wukong-stat-group-header">
          <span>大乘参悟</span>
        </div>
        <div className="wukong-stat-item">
          <span className="stat-label">总参悟度</span>
          <span className="stat-divider"></span>
          <span className="stat-value">{averageProgress}%</span>
        </div>
        <div className="wukong-stat-item">
          <span className="stat-label">主修大道</span>
          <span className="stat-divider"></span>
          <span className="stat-value truncate max-w-[80px]" title={selectedProject?.name ?? '暂无'}>
            {selectedProject?.name ?? '无'}
          </span>
        </div>
        <div className="wukong-stat-item">
          <span className="stat-label">当前境界</span>
          <span className="stat-divider"></span>
          <span className="stat-value">{selectedProject ? `${selectedProject.realm_name}${cultivation?.realm_layer ?? selectedProject.realm_layer}层` : '无'}</span>
        </div>
      </div>

      {cultivation ? (
        <div className="wukong-stat-group">
          <div className="wukong-stat-group-header">
            <span>破境道基</span>
          </div>
          <div className="wukong-stat-item">
            <span className="stat-label">道基评分</span>
            <span className="stat-divider"></span>
            <span className="stat-value">{cultivation.dao_foundation_score}</span>
          </div>
          <div className="wukong-stat-item">
            <span className="stat-label">核心/试炼</span>
            <span className="stat-divider"></span>
            <span className="stat-value">
              {cultivation.metrics.core_mastery}% / {cultivation.metrics.trial_mastery}%
            </span>
          </div>
          <div className="wukong-stat-item">
            <span className="stat-label">突破状态</span>
            <span className="stat-divider"></span>
            <span className={`stat-value ${cultivation.can_breakthrough ? 'success-text-glow' : 'cinnabar-text-glow'}`}>
              {cultivation.can_breakthrough ? '可破境' : '需巩固'}
            </span>
          </div>
          {!cultivation.can_breakthrough ? <p className="field-hint">{cultivation.bottlenecks[0]}</p> : null}
        </div>
      ) : null}

      <div className="wukong-stat-group">
        <div className="wukong-stat-group-header">
          <span>历练劫难</span>
        </div>
        <div className="wukong-stat-item">
          <span className="stat-label">红尘心魔</span>
          <span className="stat-divider"></span>
          <span className={`stat-value ${overview.pending ? 'cinnabar-text-glow' : 'success-text-glow'}`}>{overview.pending ? '心魔滋生' : '灵台清明'}</span>
        </div>
        <div className="wukong-stat-item">
          <span className="stat-label">历练次数</span>
          <span className="stat-divider"></span>
          <span className="stat-value">{totalRecentLogs} 回</span>
        </div>
      </div>

      <div className="wukong-logs-section">
        <div className="wukong-stat-group-header">
          <span>历练志 / 最近出关</span>
        </div>
        <div className="wukong-log-scroller">
          {overview.recent_logs.map((log) => (
            <div className="wukong-log-item" key={log.id}>
              <span className="log-dot">●</span>
              <div className="log-item-content">
                <strong>{log.resource_title_snapshot}</strong>
                <small>
                  进度提升 {log.progress_before_percent}% → {log.progress_after_percent}%
                </small>
              </div>
            </div>
          ))}
          {overview.recent_logs.length === 0 ? <p className="empty text-sm py-4 text-center">暂无历练印记</p> : null}
        </div>
      </div>
    </div>
  );
}
