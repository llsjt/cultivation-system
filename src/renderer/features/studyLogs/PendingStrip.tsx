import { Save } from 'lucide-react';

import type { PendingSessionView } from '../../../shared/dto';

type PendingStripProps = {
  pending: PendingSessionView;
  busy: boolean;
  onOpenLog: (pending: PendingSessionView) => Promise<void>;
  onAbandon: (pending: PendingSessionView) => Promise<void>;
};

export function PendingStrip({ pending, busy, onOpenLog, onAbandon }: PendingStripProps) {
  return (
    <section className="pending-strip">
      <div>
        <strong>待出关记录</strong>
        <span>{pending.current_resource_title ?? pending.resource_title_snapshot}</span>
        {pending.duration_minutes !== null ? <small>{pending.duration_minutes} 分钟</small> : null}
      </div>
      <div className="actions">
        <button type="button" className="primary-button" onClick={() => onOpenLog(pending)} disabled={busy}>
          <Save size={16} />
          {pending.closed_at ? '出关记录：保存本次学习进度' : '结束闭关并记录'}
        </button>
        <button type="button" className="ghost-button" onClick={() => onAbandon(pending)} disabled={busy}>
          放弃记录
        </button>
      </div>
    </section>
  );
}
