import { ModalActions } from './ModalActions';
import { ModalFrame } from './ModalFrame';
import type { ConfirmRequest } from '../types';

type ConfirmDialogProps = {
  request: ConfirmRequest;
  onSettle: (confirmed: boolean) => void;
};

export function ConfirmDialog({ request, onSettle }: ConfirmDialogProps) {
  return (
    <ModalFrame
      titleId="confirm-title"
      title={request.title}
      eyebrow="确认操作"
      onClose={() => onSettle(false)}
      role="alertdialog"
      compact
      ariaDescribedBy="confirm-message"
      closeLabel="关闭确认"
    >
      <p id="confirm-message" className="modal-message">
        {request.message}
      </p>
      <ModalActions>
        <button className={request.danger ? 'danger-button' : 'primary-button'} type="button" onClick={() => onSettle(true)} autoFocus={!request.danger}>
          {request.confirmLabel}
        </button>
        <button className="ghost-button" type="button" onClick={() => onSettle(false)} autoFocus={request.danger === true}>
          {request.cancelLabel ?? '取消'}
        </button>
      </ModalActions>
    </ModalFrame>
  );
}
