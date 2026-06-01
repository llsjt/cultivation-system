import { X } from 'lucide-react';

import { handleModalKeyDown } from '../lib/focus';
import type { ConfirmRequest } from '../types';

type ConfirmDialogProps = {
  request: ConfirmRequest;
  onSettle: (confirmed: boolean) => void;
};

export function ConfirmDialog({ request, onSettle }: ConfirmDialogProps) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal compact-modal" onKeyDown={(event) => handleModalKeyDown(event, () => onSettle(false))} role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">确认操作</p>
            <h2 id="confirm-title">{request.title}</h2>
          </div>
          <button className="icon-button" type="button" onClick={() => onSettle(false)} title="关闭" aria-label="关闭确认">
            <X size={18} />
          </button>
        </div>
        <p id="confirm-message" className="modal-message">
          {request.message}
        </p>
        <div className="actions">
          <button className={request.danger ? 'danger-button' : 'primary-button'} type="button" onClick={() => onSettle(true)} autoFocus={!request.danger}>
            {request.confirmLabel}
          </button>
          <button className="ghost-button" type="button" onClick={() => onSettle(false)} autoFocus={request.danger === true}>
            {request.cancelLabel ?? '取消'}
          </button>
        </div>
      </section>
    </div>
  );
}
