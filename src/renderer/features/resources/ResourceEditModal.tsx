import { Save, X } from 'lucide-react';
import type { FormEvent } from 'react';

import type { GetEnumsOutput } from '../../../shared/dto';
import type { CultivationRole, OpenKind, ResourceType } from '../../../shared/enums';
import { handleModalKeyDown } from '../../lib/focus';
import type { ResourceEditDraft } from '../../types';
import { getResourceWeightDisplay } from './resourceDisplay';

type ResourceEditModalProps = {
  draft: ResourceEditDraft;
  resourceTypes: GetEnumsOutput['resource_type'];
  cultivationRoles: GetEnumsOutput['cultivation_role'];
  openKinds: GetEnumsOutput['open_kind'];
  resourceStatuses: GetEnumsOutput['resource_status'];
  busy: boolean;
  onChange: (draft: ResourceEditDraft) => void;
  onSubmit: (event: FormEvent) => Promise<void>;
  onPickPath: (kind: 'file' | 'folder') => Promise<void>;
  onClose: () => void;
};

export function ResourceEditModal({ draft, resourceTypes, cultivationRoles, openKinds, resourceStatuses, busy, onChange, onSubmit, onPickPath, onClose }: ResourceEditModalProps) {
  const weightDisplay = getResourceWeightDisplay(Number(draft.mastery_weight));

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="modal" onSubmit={onSubmit} onKeyDown={(event) => handleModalKeyDown(event, onClose)} role="dialog" aria-modal="true" aria-labelledby="resource-edit-title">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">资料编辑</p>
            <h2 id="resource-edit-title">{draft.title}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} title="关闭" aria-label="关闭资料编辑">
            <X size={18} />
          </button>
        </div>
        <label>
          资料名
          <input value={draft.title} onChange={(event) => onChange({ ...draft, title: event.target.value })} required maxLength={200} autoFocus />
        </label>
        <label>
          类型
          <select value={draft.type} onChange={(event) => onChange({ ...draft, type: event.target.value as ResourceType })}>
            {resourceTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          修炼定位
          <select value={draft.cultivation_role} onChange={(event) => onChange({ ...draft, cultivation_role: event.target.value as CultivationRole })}>
            {cultivationRoles.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          同源组
          <input value={draft.mastery_group} onChange={(event) => onChange({ ...draft, mastery_group: event.target.value })} maxLength={120} placeholder="可空" />
        </label>
        <label>
          方向代表性
          <input
            value={draft.mastery_weight}
            onChange={(event) => onChange({ ...draft, mastery_weight: event.target.value })}
            type="number"
            min={1}
            max={5}
            aria-describedby="resource-edit-weight-hint"
          />
        </label>
        <p id="resource-edit-weight-hint" className="field-hint">{weightDisplay.description}</p>
        <label>
          打开方式
          <select value={draft.open_kind} onChange={(event) => onChange({ ...draft, open_kind: event.target.value as OpenKind })}>
            {openKinds.map((kind) => (
              <option key={kind.value} value={kind.value}>
                {kind.label}
              </option>
            ))}
          </select>
        </label>
        {draft.open_kind !== 'record_only' ? (
          <label>
            路径或链接
            <div className="path-input-group">
              <input
                value={draft.path_or_url}
                onChange={(event) => onChange({ ...draft, path_or_url: event.target.value })}
                placeholder={draft.open_kind === 'file' ? '本地文件路径' : draft.open_kind === 'folder' ? '本地文件夹路径' : '网页链接'}
                required
                maxLength={2048}
              />
              {draft.open_kind === 'file' || draft.open_kind === 'folder' ? (
                <button className="secondary-button path-picker-btn" type="button" onClick={() => onPickPath(draft.open_kind as 'file' | 'folder')} disabled={busy}>
                  浏览
                </button>
              ) : null}
            </div>
          </label>
        ) : null}
        <label>
          非终态标记
          <select value={draft.status} onChange={(event) => onChange({ ...draft, status: event.target.value as ResourceEditDraft['status'] })}>
            <option value="">保持当前状态</option>
            {resourceStatuses
              .filter((status) => status.value === 'learning' || status.value === 'review' || status.value === 'paused')
              .map((status) => (
                <option key={status.value} value={status.value}>
                  {status.themed_label}
                </option>
              ))}
          </select>
        </label>
        <div className="actions">
          <button className="primary-button" type="submit" disabled={busy}>
            <Save size={16} />
            保存资料
          </button>
          <button className="ghost-button" type="button" onClick={onClose}>
            取消
          </button>
        </div>
      </form>
    </div>
  );
}
