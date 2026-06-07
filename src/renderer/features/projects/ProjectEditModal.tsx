import { Save } from 'lucide-react';
import type { FormEvent } from 'react';

import { ModalActions } from '../../components/ModalActions';
import { ModalFrame } from '../../components/ModalFrame';
import type { ProjectEditDraft } from '../../types';

type ProjectEditModalProps = {
  draft: ProjectEditDraft;
  busy: boolean;
  onChange: (draft: ProjectEditDraft) => void;
  onSubmit: (event: FormEvent) => Promise<void>;
  onClose: () => void;
};

export function ProjectEditModal({ draft, busy, onChange, onSubmit, onClose }: ProjectEditModalProps) {
  return (
    <ModalFrame titleId="project-edit-title" title={draft.name} eyebrow="方向编辑" onClose={onClose} onSubmit={onSubmit} closeLabel="关闭方向编辑">
      <label>
        方向名称
        <input value={draft.name} onChange={(event) => onChange({ ...draft, name: event.target.value })} required maxLength={120} autoFocus />
      </label>
      <ModalActions>
        <button className="primary-button" type="submit" disabled={busy}>
          <Save size={16} />
          保存方向
        </button>
        <button className="ghost-button" type="button" onClick={onClose}>
          取消
        </button>
      </ModalActions>
    </ModalFrame>
  );
}
