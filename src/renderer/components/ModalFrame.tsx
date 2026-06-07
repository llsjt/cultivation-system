import { X } from 'lucide-react';
import type { FormEventHandler, KeyboardEvent, ReactNode } from 'react';

import { handleModalKeyDown } from '../lib/focus';

type ModalFrameProps = {
  titleId: string;
  title: ReactNode;
  eyebrow: ReactNode;
  onClose(): void;
  children: ReactNode;
  ariaDescribedBy?: string;
  compact?: boolean;
  role?: 'dialog' | 'alertdialog';
  onSubmit?: FormEventHandler<HTMLFormElement>;
  closeLabel?: string;
};

export function ModalFrame({
  titleId,
  title,
  eyebrow,
  onClose,
  children,
  ariaDescribedBy,
  compact = false,
  role = 'dialog',
  onSubmit,
  closeLabel = '关闭',
}: ModalFrameProps) {
  const className = compact ? 'modal compact-modal' : 'modal';
  const heading = (
    <div className="panel-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 id={titleId}>{title}</h2>
      </div>
      <button className="icon-button" type="button" onClick={onClose} title="关闭" aria-label={closeLabel}>
        <X size={18} />
      </button>
    </div>
  );
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => handleModalKeyDown(event, onClose);

  return (
    <div className="modal-backdrop" role="presentation">
      {onSubmit ? (
        <form
          className={className}
          onSubmit={onSubmit}
          onKeyDown={onKeyDown}
          role={role}
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={ariaDescribedBy}
        >
          {heading}
          {children}
        </form>
      ) : (
        <section
          className={className}
          onKeyDown={onKeyDown}
          role={role}
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={ariaDescribedBy}
        >
          {heading}
          {children}
        </section>
      )}
    </div>
  );
}
