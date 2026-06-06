import { describe, expect, it } from 'vitest';

import type { GetProjectCultivationOutput } from '../../../shared/dto';
import { BREAKTHROUGH_TARGETS, EFFECTIVE_STUDY_MINUTES_14D_TARGET } from '../../../shared/realm';
import { buildBreakthroughConditions, buildBreakthroughDiagnosticViewModel, getPrimaryBottleneck } from './cultivationDiagnostics';

describe('cultivation diagnostics view model', () => {
  it('builds breakthrough conditions from shared thresholds', () => {
    const conditions = buildBreakthroughConditions(cultivationFixture());

    expect(conditions).toContainEqual(
      expect.objectContaining({
        id: 'dao_foundation',
        value: `82/${BREAKTHROUGH_TARGETS.dao_foundation_score}`,
        met: true,
      }),
    );
    expect(conditions).toContainEqual(
      expect.objectContaining({
        id: 'effective_study',
        value: `90/${EFFECTIVE_STUDY_MINUTES_14D_TARGET} 分钟`,
        severity: 'soft',
      }),
    );
  });

  it('uses hard bottlenecks before soft diagnostic warnings', () => {
    const cultivation = cultivationFixture({
      bottlenecks: ['核心功法掌握度需达到 80%。'],
      diagnostic_warnings: ['近 14 天有效学习时间不足，还差 30 分钟。'],
    });

    expect(getPrimaryBottleneck(cultivation)).toBe('核心功法掌握度需达到 80%。');
  });

  it('falls back to diagnostic warnings when hard bottlenecks are clear', () => {
    const cultivation = cultivationFixture({
      bottlenecks: [],
      diagnostic_warnings: ['近 14 天有效学习时间不足，还差 30 分钟。'],
    });

    expect(buildBreakthroughDiagnosticViewModel(cultivation)?.primaryBottleneck).toBe('近 14 天有效学习时间不足，还差 30 分钟。');
  });

  it('returns a ready action label when breakthrough is allowed', () => {
    const diagnostic = buildBreakthroughDiagnosticViewModel(cultivationFixture({ can_breakthrough: true, bottlenecks: [] }));

    expect(diagnostic).toMatchObject({
      actionLabel: '尝试突破',
      canBreakthrough: true,
      realmLabel: '炼气8层',
      statusLabel: '道基已稳',
    });
  });
});

function cultivationFixture(overrides: Partial<GetProjectCultivationOutput> = {}): GetProjectCultivationOutput {
  return {
    project_id: 'p1',
    realm_rank: 0,
    realm_name: '炼气',
    realm_layer: 8,
    next_realm_name: '筑基',
    dao_foundation_score: 82,
    can_breakthrough: false,
    metrics: {
      core_mastery: 82,
      trial_mastery: 76,
      reflection_score: 70,
      stability_score: 60,
    },
    core_resource_count: 1,
    trial_resource_count: 1,
    recent_log_count: 1,
    effective_study_minutes_14d: 90,
    effective_study_minutes_target: 120,
    effective_study_minutes_remaining: 30,
    effective_study_days_14d: 1,
    missing_duration_log_count: 0,
    capped_duration_log_count: 0,
    diagnostic_warnings: ['近 14 天有效学习时间不足，还差 30 分钟。'],
    bottlenecks: ['近 14 天内需要至少 1 条出关记录。'],
    ...overrides,
  };
}
