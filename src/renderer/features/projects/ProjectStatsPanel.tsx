import { AlertTriangle, CheckCircle2, CircleDashed, Sparkles } from 'lucide-react';

import type { GetHomeOverviewOutput, GetProjectCultivationOutput } from '../../../shared/dto';
import { buildBreakthroughDiagnosticViewModel } from './cultivationDiagnostics';

type ProjectSummary = GetHomeOverviewOutput['projects'][number];

type ProjectStatsPanelProps = {
  overview: GetHomeOverviewOutput;
  selectedProject: ProjectSummary | null;
  cultivation: GetProjectCultivationOutput | null;
  busy: boolean;
  onAttemptBreakthrough: () => Promise<void>;
};

const projectStatusLabels: Record<ProjectSummary['status'], string> = {
  completed: '大圆满',
  learning: '闭关淬炼',
  not_started: '未开始',
  paused: '暂入红尘',
  review: '温故破障',
};

export function ProjectStatsPanel({ overview, selectedProject, cultivation, busy, onAttemptBreakthrough }: ProjectStatsPanelProps) {
  const diagnostic = buildBreakthroughDiagnosticViewModel(cultivation);
  const recentLogs = overview.recent_logs.slice(0, 3);
  const canAttempt = Boolean(selectedProject && cultivation?.can_breakthrough);

  return (
    <div className="wukong-profile-panel breakthrough-page-panel">
      <div className="wukong-profile-header">
        <h2>【 突破诊断 】</h2>
        <p className="eyebrow text-center truncate" title={selectedProject?.name ?? '未选择项目'}>
          {selectedProject?.name ?? '未选择项目'}
        </p>
      </div>

      {selectedProject && diagnostic && cultivation ? (
        <>
          <section className="wukong-stat-group breakthrough-hero-diagnostic">
            <div className="breakthrough-page-mainline">
              <div>
                <span className="eyebrow">下一步行动</span>
                <h3>{diagnostic.canBreakthrough ? `尝试突破至${diagnostic.nextRealmLabel}` : diagnostic.primaryBottleneck}</h3>
                <p className="field-hint">
                  {diagnostic.canBreakthrough ? '硬性条件已满足，仍建议确认有效学习时间和复盘质量。' : '先补齐首要瓶颈，再回来尝试突破。'}
                </p>
              </div>
              <button
                className={diagnostic.canBreakthrough ? 'primary-button' : 'secondary-button'}
                type="button"
                onClick={() => void onAttemptBreakthrough()}
                disabled={busy || !canAttempt}
                title={diagnostic.canBreakthrough ? '尝试突破境界' : diagnostic.primaryBottleneck}
              >
                <Sparkles size={16} />
                {diagnostic.actionLabel}
              </button>
            </div>
          </section>

          <section className="wukong-stat-group">
            <div className="wukong-stat-group-header">
              <span>当前境界</span>
            </div>
            <div className="breakthrough-status-grid">
              <div>
                <span>主修方向</span>
                <strong>{selectedProject.name}</strong>
              </div>
              <div>
                <span>当前境界</span>
                <strong>{diagnostic.realmLabel}</strong>
              </div>
              <div>
                <span>项目状态</span>
                <strong>{projectStatusLabels[selectedProject.status]}</strong>
              </div>
              <div>
                <span>道基评分</span>
                <strong>{diagnostic.daoFoundationLabel}</strong>
              </div>
            </div>
          </section>

          <section className="wukong-stat-group">
            <div className="wukong-stat-group-header">
              <span>突破条件</span>
            </div>
            <div className="breakthrough-condition-list full">
              {diagnostic.conditions.map((condition) => {
                const Icon = condition.met ? CheckCircle2 : CircleDashed;
                return (
                  <div className={`breakthrough-condition ${condition.met ? 'met' : condition.severity}`} key={condition.id}>
                    <Icon aria-hidden="true" size={15} />
                    <span>{condition.label}</span>
                    <strong>{condition.value}</strong>
                    <small>{condition.helper}</small>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="wukong-stat-group">
            <div className="wukong-stat-group-header">
              <span>当前瓶颈</span>
            </div>
            {diagnostic.bottlenecks.length > 0 ? (
              diagnostic.bottlenecks.map((bottleneck) => (
                <div className="wukong-log-item" key={bottleneck}>
                  <AlertTriangle aria-hidden="true" className="log-dot-icon" size={15} />
                  <div className="log-item-content">
                    <strong>{bottleneck}</strong>
                    <small>硬性突破条件</small>
                  </div>
                </div>
              ))
            ) : (
              <div className="wukong-log-item">
                <CheckCircle2 aria-hidden="true" className="log-dot-icon success" size={15} />
                <div className="log-item-content">
                  <strong>硬性瓶颈已清。</strong>
                  <small>{diagnostic.nextRealmLabel === '暂无上境' ? '当前境界已圆满。' : `可冲击${diagnostic.nextRealmLabel}。`}</small>
                </div>
              </div>
            )}
          </section>

          <section className="wukong-stat-group">
            <div className="wukong-stat-group-header">
              <span>资料结构与有效学习时间</span>
            </div>
            <div className="breakthrough-status-grid">
              <div>
                <span>核心功法</span>
                <strong>{cultivation.core_resource_count} 份 · {cultivation.metrics.core_mastery}%</strong>
              </div>
              <div>
                <span>突破试炼</span>
                <strong>{cultivation.trial_resource_count} 个 · {cultivation.metrics.trial_mastery}%</strong>
              </div>
              <div>
                <span>有效学习</span>
                <strong>{cultivation.effective_study_minutes_14d}/{cultivation.effective_study_minutes_target} 分钟</strong>
              </div>
              <div>
                <span>有效天数</span>
                <strong>{cultivation.effective_study_days_14d} 天</strong>
              </div>
            </div>
            {diagnostic.diagnosticWarnings.length > 0 ? (
              <div className="diagnostic-warning-list">
                {diagnostic.diagnosticWarnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            ) : (
              <p className="field-hint">有效学习时间已达到 v1.6 软诊断目标。</p>
            )}
          </section>

          <section className="wukong-stat-group">
            <div className="wukong-stat-group-header">
              <span>辅助复盘</span>
            </div>
            {recentLogs.length > 0 ? (
              recentLogs.map((log) => (
                <div className="wukong-log-item" key={log.id}>
                  <span className="log-dot">•</span>
                  <div className="log-item-content">
                    <strong>{log.resource_title_snapshot}</strong>
                    <small>
                      {log.progress_before_percent}% → {log.progress_after_percent}%
                    </small>
                  </div>
                </div>
              ))
            ) : (
              <p className="empty text-sm py-4 text-center">近期全局日志可在修行统计中复盘。</p>
            )}
          </section>
        </>
      ) : (
        <section className="wukong-stat-group">
          <div className="wukong-stat-group-header">
            <span>修行评估</span>
          </div>
          <p className="empty text-sm py-4 text-center">选择项目后显示道基、瓶颈和突破条件。</p>
        </section>
      )}
    </div>
  );
}
