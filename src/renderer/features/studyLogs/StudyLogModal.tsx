import { Save, X } from 'lucide-react';
import type { FormEvent } from 'react';

import type { GetEnumsOutput } from '../../../shared/dto';
import type { ResourceStatus } from '../../../shared/enums';
import { handleModalKeyDown } from '../../lib/focus';
import type { LogDraft } from '../../types';

type StudyLogModalProps = {
  draft: LogDraft;
  resourceStatuses: GetEnumsOutput['resource_status'];
  evidenceTypes: GetEnumsOutput['study_evidence_type'];
  busy: boolean;
  onChange: (draft: LogDraft) => void;
  onStatusChange: (status: ResourceStatus) => void;
  onSubmit: (event: FormEvent) => Promise<void>;
  onClose: () => void;
};

export function StudyLogModal({ draft, resourceStatuses, evidenceTypes, busy, onChange, onStatusChange, onSubmit, onClose }: StudyLogModalProps) {
  return (
    <div className="modal-backdrop" role="presentation">
      <form className="modal" onSubmit={onSubmit} onKeyDown={(event) => handleModalKeyDown(event, onClose)} role="dialog" aria-modal="true" aria-labelledby="study-log-title">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">出关记录：保存本次学习进度</p>
            <h2 id="study-log-title">{draft.resource.title}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} title="关闭" aria-label="关闭出关记录">
            <X size={18} />
          </button>
        </div>
        <label>
          出关进度
          <textarea value={draft.progress_text} onChange={(event) => onChange({ ...draft, progress_text: event.target.value })} maxLength={500} required autoFocus />
        </label>
        <label>
          参悟进度
          <input
            value={draft.progress_percent}
            onChange={(event) => onChange({ ...draft, progress_percent: event.target.value, progressChangedByStatus: false })}
            type="number"
            min={0}
            max={100}
            required
          />
        </label>
        <label>
          状态
          <select value={draft.status} onChange={(event) => onStatusChange(event.target.value as ResourceStatus)}>
            {resourceStatuses.map((status) => (
              <option key={status.value} value={status.value}>
                {status.themed_label}
              </option>
            ))}
          </select>
        </label>
        {draft.status === 'completed' || draft.status === 'not_started' ? (
          <p className="field-hint">{draft.status === 'completed' ? '进度将设为 100%。' : '进度将设为 0%。'}</p>
        ) : null}
        <label>
          证据类型
          <select value={draft.evidence_type} onChange={(event) => onChange({ ...draft, evidence_type: event.target.value as LogDraft['evidence_type'] })}>
            <option value="">未选择</option>
            {evidenceTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          下次闭关目标
          <textarea value={draft.next_action} onChange={(event) => onChange({ ...draft, next_action: event.target.value })} maxLength={500} />
        </label>
        <label>
          有效学习时长（分钟）
          <input
            value={draft.duration_minutes}
            onChange={(event) => onChange({ ...draft, duration_minutes: event.target.value })}
            type="number"
            min={0}
            max={1440}
            aria-describedby="study-duration-hint"
          />
        </label>
        <p id="study-duration-hint" className="field-hint">
          {draft.duration_hint ?? '可留空；留空时仍能保存，但突破诊断会提示缺少有效学习时长。'}
        </p>
        <div className="actions">
          <button className="primary-button" type="submit" disabled={busy}>
            <Save size={16} />
            保存记录
          </button>
          <button className="ghost-button" type="button" onClick={onClose}>
            取消
          </button>
        </div>
      </form>
    </div>
  );
}
