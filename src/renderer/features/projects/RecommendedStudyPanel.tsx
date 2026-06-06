import { BookOpen, FilePlus2, Play } from 'lucide-react';

import { ProgressBar } from '../../components/ProgressBar';
import type { RecommendedStudyViewModel } from './cockpitViewModel';

type RecommendedStudyPanelProps = {
  viewModel: RecommendedStudyViewModel | null;
  busy: boolean;
  actions: {
    onContinue: () => Promise<void>;
    onOpenManualLog: () => void;
    onCreateResource: () => void;
  };
};

export function RecommendedStudyPanel({ viewModel, busy, actions }: RecommendedStudyPanelProps) {
  if (!viewModel) {
    return (
      <section className="hero-panel cockpit-panel recommended-study-panel">
        <div className="panel-heading compact-panel-heading">
          <div>
            <p className="eyebrow">恢复学习现场</p>
            <h2>暂无可推荐资料</h2>
          </div>
        </div>
        <p className="empty">先添加资料，或在下方资料列表中选择一份开始记录。</p>
        <div className="actions">
          <button className="primary-button" type="button" onClick={actions.onCreateResource} disabled={busy}>
            <FilePlus2 size={16} />
            添加资料
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="hero-panel cockpit-panel recommended-study-panel">
      <div className="panel-heading compact-panel-heading">
        <div>
          <p className="eyebrow">恢复学习现场</p>
          <h2>{viewModel.resourceTitle}</h2>
        </div>
        <span className="resource-role-chip" title={viewModel.roleDescription}>
          {viewModel.roleLabel}
        </span>
      </div>

      <div className="cockpit-meta-grid">
        <div>
          <span>所属法门</span>
          <strong>{viewModel.projectName}</strong>
        </div>
        <div>
          <span>资料类型</span>
          <strong>{viewModel.typeLabel}</strong>
        </div>
        <div>
          <span>当前状态</span>
          <strong>{viewModel.statusLabel}</strong>
        </div>
        <div>
          <span>最近出关</span>
          <strong>{viewModel.lastStudiedLabel}</strong>
        </div>
      </div>

      <div className="recommended-progress-block">
        <div className="recommended-progress-header">
          <span>当前进度</span>
          <strong>{viewModel.progressLabel}</strong>
        </div>
        <ProgressBar value={viewModel.progressPercent} />
        <p>{viewModel.progressDescription}</p>
      </div>

      <div className="cockpit-note-grid">
        <div>
          <span>推荐理由</span>
          <p>{viewModel.recommendationReason}</p>
        </div>
        <div>
          <span>下次目标</span>
          <p>{viewModel.nextAction}</p>
        </div>
      </div>

      <div className="actions">
        <button className="primary-button" type="button" onClick={() => void actions.onContinue()} disabled={busy} aria-label={`继续学习 ${viewModel.resourceTitle}`}>
          <Play size={16} />
          继续学习
        </button>
        <button className="ghost-button" type="button" onClick={actions.onOpenManualLog} disabled={busy} aria-label={`记录进度 ${viewModel.resourceTitle}`}>
          <BookOpen size={16} />
          记录进度
        </button>
      </div>
    </section>
  );
}
