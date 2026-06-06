import { Activity, BookMarked, Flame, ScrollText } from 'lucide-react';

import type { ProjectCultivationViewModel } from './cockpitViewModel';

type ProjectCultivationStripProps = {
  viewModel: ProjectCultivationViewModel | null;
};

export function ProjectCultivationStrip({ viewModel }: ProjectCultivationStripProps) {
  if (!viewModel) {
    return (
      <section className="detail-panel cockpit-panel cultivation-strip">
        <p className="empty text-center">选择或创建修炼方向后显示法门概览。</p>
      </section>
    );
  }

  const items = [
    { label: '当前境界', value: viewModel.realmLabel, Icon: Flame },
    { label: '项目进度', value: viewModel.projectProgressLabel, Icon: Activity },
    { label: '资料总数', value: viewModel.resourceCountLabel, Icon: BookMarked },
    { label: '核心功法', value: viewModel.coreResourceCountLabel, Icon: ScrollText },
    { label: '突破试炼', value: viewModel.trialResourceCountLabel, Icon: ScrollText },
    { label: '近 14 天出关', value: viewModel.recentLogCountLabel, Icon: Activity },
  ];

  return (
    <section className="detail-panel cockpit-panel cultivation-strip">
      <div className="cultivation-strip-title">
        <div>
          <p className="eyebrow">法门概览</p>
          <h2>{viewModel.projectName}</h2>
        </div>
        <span className="status-chip">{viewModel.statusLabel}</span>
      </div>
      <div className="cultivation-strip-grid">
        {items.map(({ label, value, Icon }) => (
          <div className="cultivation-strip-item" key={label}>
            <Icon aria-hidden="true" size={15} />
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
