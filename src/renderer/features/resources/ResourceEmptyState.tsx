import { Plus } from 'lucide-react';

type ResourceEmptyStateProps = {
  hasResources: boolean;
  onCreate(): void;
};

export function ResourceEmptyState({ hasResources, onCreate }: ResourceEmptyStateProps) {
  return (
    <div className="resource-detail-empty resource-empty-state">
      <h3>{hasResources ? '选择一份资料' : '还没有资料'}</h3>
      <p className="text-xs muted">
        {hasResources ? '从左侧列表选择资料以查看进度和最近记录。' : '添加第一份资料后，就可以开始记录学习进度。'}
      </p>
      <button className="primary-button" type="button" onClick={onCreate}>
        <Plus size={14} />
        添加资料
      </button>
    </div>
  );
}
