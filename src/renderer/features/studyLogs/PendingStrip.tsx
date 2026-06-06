import { Clock3, Save, Trash2 } from 'lucide-react';

import type { PendingSessionView } from '../../../shared/dto';

type PendingStripProps = {
  pending: PendingSessionView;
  busy: boolean;
  onOpenLog: (pending: PendingSessionView) => Promise<void>;
  onAbandon: (pending: PendingSessionView) => Promise<void>;
};

export function PendingStrip({ pending, busy, onOpenLog, onAbandon }: PendingStripProps) {
  const title = pending.current_resource_title ?? pending.resource_title_snapshot;
  const openedAt = formatDateTime(pending.opened_at);
  const durationLabel = pending.duration_minutes === null ? '待记录有效学习时长' : `已记录 ${pending.duration_minutes} 分钟`;

  return (
    <section className="pending-strip">
      <div>
        <strong>待出关记录：{title}</strong>
        <span>打开前进度 {pending.progress_before_percent}% · {durationLabel}</span>
        <small>
          <Clock3 aria-hidden="true" size={13} />
          打开时间 {openedAt}
        </small>
      </div>
      <div className="actions">
        <button type="button" className="primary-button" onClick={() => void onOpenLog(pending)} disabled={busy} aria-label={`结束闭关并记录 ${title}`}>
          <Save size={16} />
          {pending.closed_at ? '出关记录：保存本次学习进度' : '结束闭关并记录'}
        </button>
        <button type="button" className="ghost-button" onClick={() => void onAbandon(pending)} disabled={busy} aria-label={`放弃本次记录 ${title}`}>
          <Trash2 size={15} />
          放弃本次记录
        </button>
      </div>
    </section>
  );
}

function formatDateTime(value: string): string {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) {
    return '未记录';
  }

  return new Date(time).toISOString().slice(0, 16).replace('T', ' ');
}
