import { X } from 'lucide-react';

import type { GetEnumsOutput, ResourceDetail } from '../../../shared/dto';
import { ProgressBar } from '../../components/ProgressBar';
import { handleModalKeyDown } from '../../lib/focus';

type ResourceDetailModalProps = {
  detail: ResourceDetail;
  enums: GetEnumsOutput | null;
  onClose: () => void;
};

export function ResourceDetailModal({ detail, enums, onClose }: ResourceDetailModalProps) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal" onKeyDown={(event) => handleModalKeyDown(event, onClose)} role="dialog" aria-modal="true" aria-labelledby="resource-detail-title">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">资料详情</p>
            <h2 id="resource-detail-title">{detail.title}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} title="关闭" aria-label="关闭资料详情">
            <X size={18} />
          </button>
        </div>
        <ProgressBar value={detail.progress_percent} />
        <dl className="detail-list">
          <div>
            <dt>当前参悟位置</dt>
            <dd>{detail.progress_text ?? '尚未记录'}</dd>
          </div>
          <div>
            <dt>下次闭关目标</dt>
            <dd>{detail.next_action ?? '尚未设置'}</dd>
          </div>
          <div>
            <dt>类型</dt>
            <dd>{enums?.resource_type.find((type) => type.value === detail.type)?.label ?? detail.type}</dd>
          </div>
          <div>
            <dt>修炼定位</dt>
            <dd>{enums?.cultivation_role.find((role) => role.value === detail.cultivation_role)?.label ?? detail.cultivation_role}</dd>
          </div>
          <div>
            <dt>同源组 / 权重</dt>
            <dd>{detail.mastery_group ? `${detail.mastery_group} / ${detail.mastery_weight}` : `未分组 / ${detail.mastery_weight}`}</dd>
          </div>
          <div>
            <dt>打开方式</dt>
            <dd>{enums?.open_kind.find((kind) => kind.value === detail.open_kind)?.label ?? detail.open_kind}</dd>
          </div>
          <div>
            <dt>状态</dt>
            <dd>{enums?.resource_status.find((status) => status.value === detail.status)?.themed_label ?? detail.status}</dd>
          </div>
          <div>
            <dt>打开目标</dt>
            <dd>{detail.path_or_url_display ?? '仅记录进度'}</dd>
          </div>
          <div>
            <dt>最近打开</dt>
            <dd>{detail.last_opened_at ?? '暂无'}</dd>
          </div>
          <div>
            <dt>最近出关</dt>
            <dd>{detail.last_studied_at ?? '暂无'}</dd>
          </div>
        </dl>
        <h3 className="compact-heading">最近记录</h3>
        <div className="item-list">
          {detail.recent_logs.map((log) => (
            <div className="log-item" key={log.id}>
              <strong>
                {log.progress_before_percent}% {'->'} {log.progress_after_percent}%
              </strong>
              <small>{log.next_action || '未设置下次闭关目标'}</small>
            </div>
          ))}
          {detail.recent_logs.length === 0 ? <p className="empty">暂无记录。</p> : null}
        </div>
      </section>
    </div>
  );
}
