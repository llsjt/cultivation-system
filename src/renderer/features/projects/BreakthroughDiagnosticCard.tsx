import { CircleCheck, CircleDashed, Sparkles } from 'lucide-react';

import type { BreakthroughDiagnosticViewModel } from './cultivationDiagnostics';

type BreakthroughDiagnosticCardProps = {
  diagnostic: BreakthroughDiagnosticViewModel | null;
  busy: boolean;
  onAttemptBreakthrough: () => Promise<void>;
};

export function BreakthroughDiagnosticCard({ diagnostic, busy, onAttemptBreakthrough }: BreakthroughDiagnosticCardProps) {
  if (!diagnostic) {
    return (
      <section className="detail-panel cockpit-panel breakthrough-diagnostic-card">
        <p className="empty text-center">选择修炼方向后显示突破诊断。</p>
      </section>
    );
  }

  return (
    <section className="detail-panel cockpit-panel breakthrough-diagnostic-card">
      <div className="panel-heading compact-panel-heading">
        <div>
          <p className="eyebrow">突破诊断</p>
          <h2>{diagnostic.statusLabel}</h2>
        </div>
        <span className={diagnostic.canBreakthrough ? 'status-chip success' : 'status-chip warning'}>{diagnostic.daoFoundationLabel}</span>
      </div>

      <div className="breakthrough-summary-row">
        <div>
          <span>当前境界</span>
          <strong>{diagnostic.realmLabel}</strong>
        </div>
        <div>
          <span>下个境界</span>
          <strong>{diagnostic.nextRealmLabel}</strong>
        </div>
      </div>

      <div className="breakthrough-condition-list">
        {diagnostic.conditions.map((condition) => {
          const Icon = condition.met ? CircleCheck : CircleDashed;
          return (
            <div className={`breakthrough-condition ${condition.met ? 'met' : condition.severity}`} key={condition.id} title={condition.helper}>
              <Icon aria-hidden="true" size={15} />
              <span>{condition.label}</span>
              <strong>{condition.value}</strong>
            </div>
          );
        })}
      </div>

      <div className="breakthrough-primary-bottleneck">
        <span>首要瓶颈</span>
        <p>{diagnostic.primaryBottleneck}</p>
      </div>

      <div className="actions">
        <button
          className={diagnostic.canBreakthrough ? 'primary-button' : 'secondary-button'}
          type="button"
          onClick={() => void onAttemptBreakthrough()}
          disabled={busy || !diagnostic.canBreakthrough}
          title={diagnostic.canBreakthrough ? '尝试突破境界' : diagnostic.primaryBottleneck}
        >
          <Sparkles size={16} />
          {diagnostic.actionLabel}
        </button>
      </div>
    </section>
  );
}
