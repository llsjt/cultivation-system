import { Save, X } from 'lucide-react';

import type { PendingSessionView } from '../../../shared/dto';
import { handleModalKeyDown } from '../../lib/focus';

type PendingConflictModalProps = {
  pending: PendingSessionView;
  onOpenLog: (pending: PendingSessionView) => Promise<void>;
  onAbandon: (pending: PendingSessionView) => Promise<void>;
  onClose: () => void;
};

export function PendingConflictModal({ pending, onOpenLog, onAbandon, onClose }: PendingConflictModalProps) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal compact-modal" onKeyDown={(event) => handleModalKeyDown(event, onClose)} role="dialog" aria-modal="true" aria-labelledby="pending-conflict-title">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">待出关记录</p>
            <h2 id="pending-conflict-title">先处理上一次学习</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} title="关闭" aria-label="关闭待记录冲突">
            <X size={18} />
          </button>
        </div>
        <p className="modal-message">{pending.current_resource_title ?? pending.resource_title_snapshot}</p>
        <div className="actions">
          <button className="primary-button" type="button" onClick={() => onOpenLog(pending)} autoFocus>
            <Save size={16} />
            记录本次学习
          </button>
          <button className="danger-button" type="button" onClick={() => onAbandon(pending)}>
            放弃记录
          </button>
          <button className="ghost-button" type="button" onClick={onClose}>
            取消
          </button>
        </div>
      </section>
    </div>
  );
}
