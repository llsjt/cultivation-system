import { Save, X } from 'lucide-react';
import type { FormEvent } from 'react';

import { handleModalKeyDown } from '../../lib/focus';
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
    <div className="modal-backdrop" role="presentation">
      <form className="modal" onSubmit={onSubmit} onKeyDown={(event) => handleModalKeyDown(event, onClose)} role="dialog" aria-modal="true" aria-labelledby="project-edit-title">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">方向编辑</p>
            <h2 id="project-edit-title">{draft.name}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} title="关闭" aria-label="关闭方向编辑">
            <X size={18} />
          </button>
        </div>
        <label>
          方向名称
          <input value={draft.name} onChange={(event) => onChange({ ...draft, name: event.target.value })} required maxLength={120} autoFocus />
        </label>
        <div className="actions">
          <button className="primary-button" type="submit" disabled={busy}>
            <Save size={16} />
            保存方向
          </button>
          <button className="ghost-button" type="button" onClick={onClose}>
            取消
          </button>
        </div>
      </form>
    </div>
  );
}
