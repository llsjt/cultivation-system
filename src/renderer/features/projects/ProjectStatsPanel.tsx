import type { GetHomeOverviewOutput, GetProjectCultivationOutput } from '../../../shared/dto';

type ProjectSummary = GetHomeOverviewOutput['projects'][number];

type ProjectStatsPanelProps = {
  overview: GetHomeOverviewOutput;
  selectedProject: ProjectSummary | null;
  cultivation: GetProjectCultivationOutput | null;
  busy: boolean;
  onAttemptBreakthrough: () => Promise<void>;
};

const projectStatusLabels: Record<ProjectSummary['status'], string> = {
  not_started: '未开始',
  learning: '闭关淬炼',
  paused: '暂入红尘',
  review: '温故破障',
  completed: '大圆满',
};

const breakthroughTargets = {
  coreMastery: 80,
  trialMastery: 70,
  daoFoundation: 80,
  recentLogs: 1,
};

export function ProjectStatsPanel({ overview, selectedProject, cultivation, busy, onAttemptBreakthrough }: ProjectStatsPanelProps) {
  const totalProjects = overview.projects.length;
  const totalResources = overview.projects.reduce((sum, project) => sum + project.resource_count, 0);
  const averageProgress = overview.projects.length
    ? Math.round(overview.projects.reduce((sum, project) => sum + project.progress_percent, 0) / overview.projects.length)
    : 0;
  const totalRecentLogs = overview.recent_logs.length;
  const currentProjectName = selectedProject?.name ?? '未选择项目';
  const currentRealm = selectedProject ? `${selectedProject.realm_name}${cultivation?.realm_layer ?? selectedProject.realm_layer}层` : '无';
  const breakthroughStatus = cultivation
    ? cultivation.can_breakthrough
      ? cultivation.next_realm_name
        ? `可冲击${cultivation.next_realm_name}`
        : '已至圆满'
      : '瓶颈待破'
    : '未评估';
  const breakthroughConditions = cultivation
    ? [
        {
          label: '道基评分',
          value: `${cultivation.dao_foundation_score}/${breakthroughTargets.daoFoundation}`,
          met: cultivation.dao_foundation_score >= breakthroughTargets.daoFoundation,
        },
        {
          label: '核心功法',
          value: `${cultivation.core_resource_count}份 · ${cultivation.metrics.core_mastery}%/${breakthroughTargets.coreMastery}%`,
          met: cultivation.core_resource_count > 0 && cultivation.metrics.core_mastery >= breakthroughTargets.coreMastery,
        },
        {
          label: '突破试炼',
          value: `${cultivation.trial_resource_count}个 · ${cultivation.metrics.trial_mastery}%/${breakthroughTargets.trialMastery}%`,
          met: cultivation.trial_resource_count > 0 && cultivation.metrics.trial_mastery >= breakthroughTargets.trialMastery,
        },
        {
          label: '近14天出关',
          value: `${cultivation.recent_log_count}/${breakthroughTargets.recentLogs} 条`,
          met: cultivation.recent_log_count >= breakthroughTargets.recentLogs,
        },
      ]
    : [];

  return (
    <div className="wukong-profile-panel">
      <div className="wukong-profile-header">
        <h2>【 修行状态 】</h2>
        <p className="eyebrow text-center truncate" title={currentProjectName}>
          {currentProjectName}
        </p>
      </div>

      <div className="wukong-stat-group">
        <div className="wukong-stat-group-header">
          <span>当前项目</span>
        </div>
        <div className="wukong-stat-item">
          <span className="stat-label">主修大道</span>
          <span className="stat-divider"></span>
          <span className="stat-value truncate max-w-[120px]" title={currentProjectName}>
            {currentProjectName}
          </span>
        </div>
        <div className="wukong-stat-item">
          <span className="stat-label">当前境界</span>
          <span className="stat-divider"></span>
          <span className="stat-value">{currentRealm}</span>
        </div>
        <div className="wukong-stat-item">
          <span className="stat-label">项目状态</span>
          <span className="stat-divider"></span>
          <span className="stat-value">{selectedProject ? projectStatusLabels[selectedProject.status] : '无'}</span>
        </div>
        <div className="wukong-stat-item">
          <span className="stat-label">项目进度</span>
          <span className="stat-divider"></span>
          <span className="stat-value">{selectedProject ? `${selectedProject.progress_percent}%` : '无'}</span>
        </div>
      </div>

      {cultivation ? (
        <>
          <div className="wukong-stat-group">
            <div className="wukong-stat-group-header">
              <span>突破条件</span>
            </div>
            {breakthroughConditions.map((condition) => (
              <div className="wukong-stat-item" key={condition.label}>
                <span className="stat-label">{condition.label}</span>
                <span className="stat-divider"></span>
                <span className={`stat-value ${condition.met ? 'success-text-glow' : 'cinnabar-text-glow'}`}>{condition.value}</span>
              </div>
            ))}
            <div className="wukong-stat-item">
              <span className="stat-label">反思/稳定</span>
              <span className="stat-divider"></span>
              <span className="stat-value">
                {cultivation.metrics.reflection_score}% / {cultivation.metrics.stability_score}%
              </span>
            </div>
            <div className="wukong-stat-item">
              <span className="stat-label">下个境界</span>
              <span className="stat-divider"></span>
              <span className="stat-value">{cultivation.next_realm_name ?? '暂无上境'}</span>
            </div>
            <div className="wukong-stat-item">
              <span className="stat-label">突破状态</span>
              <span className="stat-divider"></span>
              <span className={`stat-value ${cultivation.can_breakthrough ? 'success-text-glow' : 'cinnabar-text-glow'}`}>{breakthroughStatus}</span>
            </div>
          </div>

          <div className="wukong-stat-group">
            <div className="wukong-stat-group-header">
              <span>当前瓶颈</span>
            </div>
            {cultivation.can_breakthrough ? (
              <div className="wukong-log-item">
                <span className="log-dot">●</span>
                <div className="log-item-content">
                  <strong>道基已稳，瓶颈已清。</strong>
                  <small>{cultivation.next_realm_name ? `可冲击${cultivation.next_realm_name}` : '当前境界已圆满'}</small>
                </div>
              </div>
            ) : (
              cultivation.bottlenecks.map((bottleneck) => (
                <div className="wukong-log-item" key={bottleneck}>
                  <span className="log-dot">●</span>
                  <div className="log-item-content">
                    <strong>{bottleneck}</strong>
                    <small>突破条件尚未满足</small>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="wukong-stat-group breakthrough-action-group">
            <button
              className={cultivation.can_breakthrough ? 'primary-button' : 'secondary-button'}
              type="button"
              onClick={() => void onAttemptBreakthrough()}
              disabled={busy || !selectedProject}
              title={cultivation.can_breakthrough ? '尝试突破境界' : cultivation.bottlenecks[0] ?? '突破条件尚未满足'}
            >
              {cultivation.can_breakthrough ? '尝试突破' : '道基未稳'}
            </button>
            <p className="field-hint">
              {cultivation.can_breakthrough ? '条件已满足，可在此发起突破。' : '补齐上方瓶颈后再尝试突破。'}
            </p>
          </div>
        </>
      ) : (
        <div className="wukong-stat-group">
          <div className="wukong-stat-group-header">
            <span>修行评估</span>
          </div>
          <p className="empty text-sm py-4 text-center">选择项目后显示道基、瓶颈和突破条件</p>
        </div>
      )}

      <div className="wukong-stat-group">
        <div className="wukong-stat-group-header">
          <span>全局统计</span>
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
          <span className="stat-label">总参悟度</span>
          <span className="stat-divider"></span>
          <span className="stat-value">{averageProgress}%</span>
        </div>
        <div className="wukong-stat-item">
          <span className="stat-label">修行时日</span>
          <span className="stat-divider"></span>
          <span className="stat-value text-sm">{overview.last_saved_at ? '已保存' : '新参悟'}</span>
        </div>
        <div className="wukong-stat-item">
          <span className="stat-label">历练次数</span>
          <span className="stat-divider"></span>
          <span className="stat-value">{totalRecentLogs} 回</span>
        </div>
        <div className="wukong-stat-item">
          <span className="stat-label">红尘心魔</span>
          <span className="stat-divider"></span>
          <span className={`stat-value ${overview.pending ? 'cinnabar-text-glow' : 'success-text-glow'}`}>{overview.pending ? '心魔滋生' : '灵台清明'}</span>
        </div>
      </div>

      <div className="wukong-logs-section">
        <div className="wukong-stat-group-header">
          <span>全局历练志 / 最近出关</span>
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
