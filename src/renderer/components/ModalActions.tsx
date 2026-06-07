import type { ReactNode } from 'react';

type ModalActionsProps = {
  children: ReactNode;
};

export function ModalActions({ children }: ModalActionsProps) {
  return <div className="actions">{children}</div>;
}
