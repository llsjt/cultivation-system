import { Save } from 'lucide-react';
import type { FormEvent } from 'react';

import type { GetEnumsOutput } from '../../../shared/dto';
import type { ResourceStatus } from '../../../shared/enums';
import { ModalActions } from '../../components/ModalActions';
import { ModalFrame } from '../../components/ModalFrame';
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
    <ModalFrame titleId="study-log-title" title={draft.resource.title} eyebrow="出关记录：保存本次学习进度" onClose={onClose} onSubmit={onSubmit} closeLabel="关闭出关记录">
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
        <ModalActions>
          <button className="primary-button" type="submit" disabled={busy}>
            <Save size={16} />
            保存记录
          </button>
          <button className="ghost-button" type="button" onClick={onClose}>
            取消
          </button>
        </ModalActions>
    </ModalFrame>
  );
}
