import type { CultivationRole, ResourceStatus, ResourceType, StudyEvidenceType } from './enums';

export const realmNames = ['炼气', '筑基', '金丹', '元婴', '化神'] as const;
export const BREAKTHROUGH_TARGETS = {
  core_mastery: 80,
  core_resource_count: 1,
  dao_foundation_score: 80,
  fresh_log_count: 1,
  recent_log_count: 1,
  trial_mastery: 70,
  trial_resource_count: 1,
} as const;
export const EFFECTIVE_STUDY_MINUTES_14D_TARGET = 120;
export const EFFECTIVE_STUDY_MINUTES_PER_LOG_CAP = 180;

export type RealmRank = 0 | 1 | 2 | 3 | 4;

export type CultivationResourceSnapshot = {
  id: string;
  type: ResourceType;
  status: ResourceStatus;
  progress_percent: number;
  cultivation_role: CultivationRole;
  mastery_group: string | null;
  mastery_weight: number;
};

export type CultivationLogSnapshot = {
  studied_at: string;
  duration_minutes: number | null;
  content: string | null;
  progress_before_percent: number;
  progress_after_percent: number;
  evidence_type: StudyEvidenceType | null;
};

export type CultivationMetrics = {
  core_mastery: number;
  trial_mastery: number;
  reflection_score: number;
  stability_score: number;
};

export type ProjectCultivationState = {
  project_id: string;
  realm_rank: RealmRank;
  realm_name: string;
  realm_layer: number;
  next_realm_name: string | null;
  dao_foundation_score: number;
  can_breakthrough: boolean;
  metrics: CultivationMetrics;
  core_resource_count: number;
  trial_resource_count: number;
  recent_log_count: number;
  effective_study_minutes_14d: number;
  effective_study_minutes_target: number;
  effective_study_minutes_remaining: number;
  effective_study_days_14d: number;
  missing_duration_log_count: number;
  capped_duration_log_count: number;
  diagnostic_warnings: string[];
  bottlenecks: string[];
};

export function getRealmName(rank: number): string {
  return realmNames[clampRealmRank(rank)] ?? realmNames[0];
}

export function getNextRealmName(rank: number): string | null {
  const nextRank = clampRealmRank(rank) + 1;
  return nextRank < realmNames.length ? realmNames[nextRank] : null;
}

export function deriveRealmLayer(score: number): number {
  const normalized = Math.min(100, Math.max(0, Math.round(score)));
  return Math.min(9, Math.max(1, Math.ceil((normalized / 100) * 9)));
}

export function evaluateProjectCultivation(input: {
  project_id: string;
  realm_rank: number;
  last_breakthrough_at?: string | null;
  resources: CultivationResourceSnapshot[];
  logs: CultivationLogSnapshot[];
  now?: Date;
}): ProjectCultivationState {
  const now = input.now ?? new Date();
  const realmRank = clampRealmRank(input.realm_rank);
  const coreResources = input.resources.filter((resource) => resource.cultivation_role === 'core');
  const trialResources = input.resources.filter((resource) => resource.cultivation_role === 'trial' || (resource.cultivation_role !== 'reference' && resource.type === 'exercise'));
  const metrics: CultivationMetrics = {
    core_mastery: weightedMastery(coreResources),
    trial_mastery: weightedMastery(trialResources),
    reflection_score: reflectionScore(input.logs),
    stability_score: stabilityScore(input.logs, now),
  };
  const daoFoundationScore = Math.round(
    metrics.core_mastery * 0.4 + metrics.trial_mastery * 0.35 + metrics.reflection_score * 0.15 + metrics.stability_score * 0.1,
  );
  const recentLogCount = countRecentLogs(input.logs, now, 14);
  const effectiveStudy = calculateEffectiveStudy(input.logs, now);
  const freshLogCount = countFreshLogs(input.logs, input.last_breakthrough_at);
  const bottlenecks = getBreakthroughBottlenecks({
    realmRank,
    coreResourceCount: coreResources.length,
    trialResourceCount: trialResources.length,
    recentLogCount,
    freshLogCount,
    daoFoundationScore,
    metrics,
  });

  return {
    project_id: input.project_id,
    realm_rank: realmRank,
    realm_name: getRealmName(realmRank),
    realm_layer: deriveRealmLayer(daoFoundationScore),
    next_realm_name: getNextRealmName(realmRank),
    dao_foundation_score: daoFoundationScore,
    can_breakthrough: bottlenecks.length === 0,
    metrics,
    core_resource_count: coreResources.length,
    trial_resource_count: trialResources.length,
    recent_log_count: recentLogCount,
    effective_study_minutes_14d: effectiveStudy.minutes,
    effective_study_minutes_target: EFFECTIVE_STUDY_MINUTES_14D_TARGET,
    effective_study_minutes_remaining: Math.max(0, EFFECTIVE_STUDY_MINUTES_14D_TARGET - effectiveStudy.minutes),
    effective_study_days_14d: effectiveStudy.days,
    missing_duration_log_count: effectiveStudy.missingDurationCount,
    capped_duration_log_count: effectiveStudy.cappedDurationCount,
    diagnostic_warnings: buildDiagnosticWarnings(effectiveStudy),
    bottlenecks,
  };
}

function weightedMastery(resources: CultivationResourceSnapshot[]): number {
  if (resources.length === 0) {
    return 0;
  }

  const sortedResources = [...resources].sort((a, b) => {
    const aGroup = a.mastery_group?.trim() || a.id;
    const bGroup = b.mastery_group?.trim() || b.id;
    if (aGroup !== bGroup) {
      return aGroup.localeCompare(bGroup);
    }
    return b.progress_percent * b.mastery_weight - a.progress_percent * a.mastery_weight;
  });
  const groupCounts = new Map<string, number>();
  let weightedTotal = 0;
  let weightTotal = 0;

  for (const resource of sortedResources) {
    const groupKey = resource.mastery_group?.trim() || resource.id;
    const groupIndex = groupCounts.get(groupKey) ?? 0;
    groupCounts.set(groupKey, groupIndex + 1);
    const decay = groupDecay(groupIndex);
    const weight = Math.max(1, Math.min(5, resource.mastery_weight)) * decay;

    if (weight === 0) {
      continue;
    }

    weightedTotal += Math.min(100, Math.max(0, resource.progress_percent)) * weight;
    weightTotal += weight;
  }

  return weightTotal === 0 ? 0 : Math.round(weightedTotal / weightTotal);
}

function groupDecay(groupIndex: number): number {
  if (groupIndex === 0) {
    return 1;
  }

  if (groupIndex === 1) {
    return 0.5;
  }

  if (groupIndex === 2) {
    return 0.2;
  }

  return 0;
}

function reflectionScore(logs: CultivationLogSnapshot[]): number {
  const score = logs.reduce((sum, log) => {
    if (log.evidence_type === 'assessment') {
      return sum + 40;
    }
    if (log.evidence_type === 'practice') {
      return sum + 35;
    }
    if (log.evidence_type === 'note') {
      return sum + 30;
    }
    if (log.evidence_type === 'read') {
      return sum + (log.content?.trim() ? 20 : 12);
    }
    return sum + (log.content?.trim() ? 20 : 0);
  }, 0);

  return Math.min(100, score);
}

function stabilityScore(logs: CultivationLogSnapshot[], now: Date): number {
  const recentDays = new Set(
    logs
      .filter((log) => isWithinDays(log.studied_at, now, 14))
      .map((log) => new Date(log.studied_at).toISOString().slice(0, 10)),
  );
  return Math.min(100, recentDays.size * 20);
}

function countRecentLogs(logs: CultivationLogSnapshot[], now: Date, days: number): number {
  return logs.filter((log) => isWithinDays(log.studied_at, now, days)).length;
}

function countFreshLogs(logs: CultivationLogSnapshot[], lastBreakthroughAt?: string | null): number {
  if (!lastBreakthroughAt) {
    return logs.length;
  }

  const breakthroughTime = Date.parse(lastBreakthroughAt);
  if (!Number.isFinite(breakthroughTime)) {
    return logs.length;
  }

  return logs.filter((log) => Date.parse(log.studied_at) > breakthroughTime).length;
}

function calculateEffectiveStudy(logs: CultivationLogSnapshot[], now: Date): {
  minutes: number;
  days: number;
  missingDurationCount: number;
  cappedDurationCount: number;
} {
  const recentLogs = logs.filter((log) => isWithinDays(log.studied_at, now, 14));
  const effectiveDays = new Set<string>();
  let minutes = 0;
  let missingDurationCount = 0;
  let cappedDurationCount = 0;

  for (const log of recentLogs) {
    if (!hasStudyEvidence(log)) {
      continue;
    }

    if (log.duration_minutes === null) {
      missingDurationCount += 1;
      continue;
    }

    if (log.duration_minutes <= 0) {
      continue;
    }

    if (log.duration_minutes > EFFECTIVE_STUDY_MINUTES_PER_LOG_CAP) {
      cappedDurationCount += 1;
    }

    minutes += Math.min(log.duration_minutes, EFFECTIVE_STUDY_MINUTES_PER_LOG_CAP);
    effectiveDays.add(new Date(log.studied_at).toISOString().slice(0, 10));
  }

  return {
    minutes,
    days: effectiveDays.size,
    missingDurationCount,
    cappedDurationCount,
  };
}

function hasStudyEvidence(log: CultivationLogSnapshot): boolean {
  return !!log.evidence_type || !!log.content?.trim() || log.progress_before_percent !== log.progress_after_percent;
}

function buildDiagnosticWarnings(input: {
  minutes: number;
  missingDurationCount: number;
  cappedDurationCount: number;
}): string[] {
  const warnings: string[] = [];
  const remainingMinutes = Math.max(0, EFFECTIVE_STUDY_MINUTES_14D_TARGET - input.minutes);

  if (remainingMinutes > 0) {
    warnings.push(`近 14 天有效学习时间不足，还差 ${remainingMinutes} 分钟。`);
  }

  if (input.missingDurationCount > 0) {
    warnings.push(`有 ${input.missingDurationCount} 条出关记录缺少有效学习时长，暂不阻断突破。`);
  }

  if (input.cappedDurationCount > 0) {
    warnings.push(`有 ${input.cappedDurationCount} 条出关记录超过 ${EFFECTIVE_STUDY_MINUTES_PER_LOG_CAP} 分钟，已按上限计入。`);
  }

  return warnings;
}

function isWithinDays(value: string, now: Date, days: number): boolean {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) {
    return false;
  }

  const elapsed = now.getTime() - time;
  return elapsed >= 0 && elapsed <= days * 24 * 60 * 60 * 1000;
}

function getBreakthroughBottlenecks(input: {
  realmRank: RealmRank;
  coreResourceCount: number;
  trialResourceCount: number;
  recentLogCount: number;
  freshLogCount: number;
  daoFoundationScore: number;
  metrics: CultivationMetrics;
}): string[] {
  const bottlenecks: string[] = [];

  if (input.realmRank >= realmNames.length - 1) {
    bottlenecks.push('当前已到达最高境界，暂不开放继续突破。');
  }
  if (input.coreResourceCount < BREAKTHROUGH_TARGETS.core_resource_count) {
    bottlenecks.push('至少需要 1 份核心功法。');
  }
  if (input.metrics.core_mastery < BREAKTHROUGH_TARGETS.core_mastery) {
    bottlenecks.push('核心功法掌握度需达到 80%。');
  }
  if (input.trialResourceCount < BREAKTHROUGH_TARGETS.trial_resource_count) {
    bottlenecks.push('至少需要 1 个突破试炼或练习类资料。');
  }
  if (input.metrics.trial_mastery < BREAKTHROUGH_TARGETS.trial_mastery) {
    bottlenecks.push('突破试炼掌握度需达到 70%。');
  }
  if (input.daoFoundationScore < BREAKTHROUGH_TARGETS.dao_foundation_score) {
    bottlenecks.push('道基评分需达到 80。');
  }
  if (input.recentLogCount < BREAKTHROUGH_TARGETS.recent_log_count) {
    bottlenecks.push('最近 14 天内需要至少 1 条出关记录。');
  }
  if (input.freshLogCount < BREAKTHROUGH_TARGETS.fresh_log_count) {
    bottlenecks.push('上次突破后需要新的出关记录。');
  }

  return bottlenecks;
}

function clampRealmRank(rank: number): RealmRank {
  const normalized = Math.min(realmNames.length - 1, Math.max(0, Math.trunc(rank)));
  return normalized as RealmRank;
}
