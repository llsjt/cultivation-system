import { Check, CircleAlert, X } from 'lucide-react';

import type { Toast } from '../types';

type ToastStackProps = {
  toasts: Toast[];
  onDismiss: (toastId: string) => void;
};

export function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.slice(0, 3).map((toast) => (
        <div className={`toast ${toast.kind}`} role={toast.kind === 'error' ? 'alert' : 'status'} key={toast.id}>
          {toast.kind === 'success' ? <Check size={18} /> : <CircleAlert size={18} />}
          <span>{toast.message}</span>
          <button type="button" onClick={() => onDismiss(toast.id)} title="关闭" aria-label="关闭提示">
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
