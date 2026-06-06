import type { GetProjectCultivationOutput } from '../../../shared/dto';
import { BREAKTHROUGH_TARGETS, EFFECTIVE_STUDY_MINUTES_14D_TARGET } from '../../../shared/realm';

export type BreakthroughConditionViewModel = {
  id: 'dao_foundation' | 'core_mastery' | 'trial_mastery' | 'recent_logs' | 'effective_study';
  label: string;
  value: string;
  met: boolean;
  severity: 'hard' | 'soft';
  helper: string;
};

export type BreakthroughDiagnosticViewModel = {
  projectId: string;
  realmLabel: string;
  nextRealmLabel: string;
  daoFoundationLabel: string;
  canBreakthrough: boolean;
  statusLabel: string;
  actionLabel: string;
  primaryBottleneck: string;
  conditions: BreakthroughConditionViewModel[];
  bottlenecks: string[];
  diagnosticWarnings: string[];
};

export function formatRealmLabel(cultivation: Pick<GetProjectCultivationOutput, 'realm_name' | 'realm_layer'> | null): string {
  return cultivation ? `${cultivation.realm_name}${cultivation.realm_layer}层` : '未评估';
}

export function buildBreakthroughConditions(cultivation: GetProjectCultivationOutput): BreakthroughConditionViewModel[] {
  return [
    {
      id: 'dao_foundation',
      label: '道基评分',
      value: `${cultivation.dao_foundation_score}/${BREAKTHROUGH_TARGETS.dao_foundation_score}`,
      met: cultivation.dao_foundation_score >= BREAKTHROUGH_TARGETS.dao_foundation_score,
      severity: 'hard',
      helper: '综合核心功法、试炼、复盘和稳定度。',
    },
    {
      id: 'core_mastery',
      label: '核心功法',
      value: `${cultivation.core_resource_count}/${BREAKTHROUGH_TARGETS.core_resource_count} 份 · ${cultivation.metrics.core_mastery}/${BREAKTHROUGH_TARGETS.core_mastery}%`,
      met:
        cultivation.core_resource_count >= BREAKTHROUGH_TARGETS.core_resource_count &&
        cultivation.metrics.core_mastery >= BREAKTHROUGH_TARGETS.core_mastery,
      severity: 'hard',
      helper: '核心资料决定当前方向的主干掌握。',
    },
    {
      id: 'trial_mastery',
      label: '突破试炼',
      value: `${cultivation.trial_resource_count}/${BREAKTHROUGH_TARGETS.trial_resource_count} 个 · ${cultivation.metrics.trial_mastery}/${BREAKTHROUGH_TARGETS.trial_mastery}%`,
      met:
        cultivation.trial_resource_count >= BREAKTHROUGH_TARGETS.trial_resource_count &&
        cultivation.metrics.trial_mastery >= BREAKTHROUGH_TARGETS.trial_mastery,
      severity: 'hard',
      helper: '练习和试炼用来验证能否独立运用。',
    },
    {
      id: 'recent_logs',
      label: '近 14 天出关',
      value: `${cultivation.recent_log_count}/${BREAKTHROUGH_TARGETS.recent_log_count} 条`,
      met: cultivation.recent_log_count >= BREAKTHROUGH_TARGETS.recent_log_count,
      severity: 'hard',
      helper: '至少保留一条近期学习记录，避免旧状态误判。',
    },
    {
      id: 'effective_study',
      label: '有效学习',
      value: `${cultivation.effective_study_minutes_14d}/${EFFECTIVE_STUDY_MINUTES_14D_TARGET} 分钟`,
      met: cultivation.effective_study_minutes_14d >= EFFECTIVE_STUDY_MINUTES_14D_TARGET,
      severity: 'soft',
      helper: 'v1.6 只做软诊断，不阻断突破。',
    },
  ];
}

export function getPrimaryBottleneck(cultivation: GetProjectCultivationOutput): string {
  if (cultivation.bottlenecks[0]) {
    return cultivation.bottlenecks[0];
  }

  if (cultivation.diagnostic_warnings[0]) {
    return cultivation.diagnostic_warnings[0];
  }

  return cultivation.next_realm_name ? `道基已稳，可尝试突破至${cultivation.next_realm_name}。` : '当前境界已圆满，继续保持复盘节奏。';
}

export function buildBreakthroughDiagnosticViewModel(cultivation: GetProjectCultivationOutput | null): BreakthroughDiagnosticViewModel | null {
  if (!cultivation) {
    return null;
  }

  return {
    projectId: cultivation.project_id,
    realmLabel: formatRealmLabel(cultivation),
    nextRealmLabel: cultivation.next_realm_name ?? '暂无上境',
    daoFoundationLabel: `${cultivation.dao_foundation_score}/100`,
    canBreakthrough: cultivation.can_breakthrough,
    statusLabel: cultivation.can_breakthrough ? '道基已稳' : '瓶颈待破',
    actionLabel: cultivation.can_breakthrough ? '尝试突破' : '道基未稳',
    primaryBottleneck: getPrimaryBottleneck(cultivation),
    conditions: buildBreakthroughConditions(cultivation),
    bottlenecks: cultivation.bottlenecks,
    diagnosticWarnings: cultivation.diagnostic_warnings,
  };
}
