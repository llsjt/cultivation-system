import { describe, expect, it } from 'vitest';

import {
  EFFECTIVE_STUDY_MINUTES_14D_TARGET,
  EFFECTIVE_STUDY_MINUTES_PER_LOG_CAP,
  deriveRealmLayer,
  evaluateProjectCultivation,
  type CultivationLogSnapshot,
  type CultivationResourceSnapshot,
} from '../../src/shared/realm';

describe('project cultivation evaluation', () => {
  it('requires core mastery, trial mastery, dao foundation and fresh logs before breakthrough', () => {
    const state = evaluateProjectCultivation({
      project_id: 'p1',
      realm_rank: 0,
      resources: [
        {
          id: 'core',
          type: 'document',
          status: 'completed',
          progress_percent: 100,
          cultivation_role: 'core',
          mastery_group: null,
          mastery_weight: 1,
        },
      ],
      logs: [cultivationLog({ studied_at: '2026-05-30T00:00:00.000Z', content: '复盘', evidence_type: 'note' })],
      now: new Date('2026-05-31T00:00:00.000Z'),
    });

    expect(state.can_breakthrough).toBe(false);
    expect(state.bottlenecks).toContain('至少需要 1 个突破试炼或练习类资料。');
  });

  it('allows breakthrough when core resources, trials and evidence are strong enough', () => {
    const state = evaluateProjectCultivation({
      project_id: 'p1',
      realm_rank: 0,
      resources: [
        {
          id: 'core',
          type: 'document',
          status: 'completed',
          progress_percent: 100,
          cultivation_role: 'core',
          mastery_group: null,
          mastery_weight: 1,
        },
        {
          id: 'trial',
          type: 'exercise',
          status: 'completed',
          progress_percent: 100,
          cultivation_role: 'trial',
          mastery_group: null,
          mastery_weight: 1,
        },
      ],
      logs: [
        cultivationLog({ studied_at: '2026-05-30T00:00:00.000Z', content: '完成测试', evidence_type: 'assessment' }),
        cultivationLog({ studied_at: '2026-05-31T00:00:00.000Z', content: '完成练习', evidence_type: 'practice' }),
      ],
      now: new Date('2026-05-31T12:00:00.000Z'),
    });

    expect(state.can_breakthrough).toBe(true);
    expect(state.dao_foundation_score).toBeGreaterThanOrEqual(80);
  });

  it('makes repeated same-group materials decay in an order-stable way', () => {
    const first = evaluateProjectCultivation({
      project_id: 'p1',
      realm_rank: 0,
      resources: [
        {
          id: 'a',
          type: 'document',
          status: 'completed',
          progress_percent: 100,
          cultivation_role: 'core',
          mastery_group: 'react-basic',
          mastery_weight: 1,
        },
        {
          id: 'b',
          type: 'video',
          status: 'not_started',
          progress_percent: 0,
          cultivation_role: 'core',
          mastery_group: 'react-basic',
          mastery_weight: 1,
        },
      ],
      logs: [],
      now: new Date('2026-05-31T00:00:00.000Z'),
    });
    const reversed = evaluateProjectCultivation({
      project_id: 'p1',
      realm_rank: 0,
      resources: [...firstInputResources].reverse(),
      logs: [],
      now: new Date('2026-05-31T00:00:00.000Z'),
    });

    expect(first.metrics.core_mastery).toBe(67);
    expect(reversed.metrics.core_mastery).toBe(first.metrics.core_mastery);
  });

  it('maps dao foundation to realm layer boundaries', () => {
    expect(deriveRealmLayer(0)).toBe(1);
    expect(deriveRealmLayer(80)).toBe(8);
    expect(deriveRealmLayer(100)).toBe(9);
  });

  it('keeps missing duration as a soft diagnostic instead of blocking breakthrough', () => {
    const state = evaluateProjectCultivation({
      project_id: 'p1',
      realm_rank: 0,
      resources: breakthroughReadyResources,
      logs: [cultivationLog({ studied_at: '2026-05-30T00:00:00.000Z', evidence_type: 'assessment' })],
      now: new Date('2026-05-31T12:00:00.000Z'),
    });

    expect(state.can_breakthrough).toBe(true);
    expect(state.effective_study_minutes_14d).toBe(0);
    expect(state.missing_duration_log_count).toBe(1);
    expect(state.diagnostic_warnings).toContain('近 14 天有效学习时间不足，还差 120 分钟。');
    expect(state.diagnostic_warnings).toContain('有 1 条出关记录缺少有效学习时长，暂不阻断突破。');
  });

  it('counts two 60 minute effective logs toward the 14 day target', () => {
    const state = evaluateProjectCultivation({
      project_id: 'p1',
      realm_rank: 0,
      resources: breakthroughReadyResources,
      logs: [
        cultivationLog({ studied_at: '2026-05-30T00:00:00.000Z', duration_minutes: 60, evidence_type: 'assessment' }),
        cultivationLog({ studied_at: '2026-05-31T00:00:00.000Z', duration_minutes: 60, evidence_type: 'practice' }),
      ],
      now: new Date('2026-05-31T12:00:00.000Z'),
    });

    expect(state.effective_study_minutes_14d).toBe(EFFECTIVE_STUDY_MINUTES_14D_TARGET);
    expect(state.effective_study_minutes_remaining).toBe(0);
    expect(state.effective_study_days_14d).toBe(2);
    expect(state.diagnostic_warnings).not.toContain('近 14 天有效学习时间不足，还差 120 分钟。');
  });

  it('caps a single unusually long study log at 180 effective minutes', () => {
    const state = evaluateProjectCultivation({
      project_id: 'p1',
      realm_rank: 0,
      resources: breakthroughReadyResources,
      logs: [cultivationLog({ studied_at: '2026-05-31T00:00:00.000Z', duration_minutes: 1440, evidence_type: 'assessment' })],
      now: new Date('2026-05-31T12:00:00.000Z'),
    });

    expect(state.effective_study_minutes_14d).toBe(EFFECTIVE_STUDY_MINUTES_PER_LOG_CAP);
    expect(state.capped_duration_log_count).toBe(1);
    expect(state.diagnostic_warnings).toContain('有 1 条出关记录超过 180 分钟，已按上限计入。');
  });

  it('only counts saved logs supplied to the evaluator, not pending sessions', () => {
    const state = evaluateProjectCultivation({
      project_id: 'p1',
      realm_rank: 0,
      resources: breakthroughReadyResources,
      logs: [],
      now: new Date('2026-05-31T12:00:00.000Z'),
    });

    expect(state.effective_study_minutes_14d).toBe(0);
    expect(state.recent_log_count).toBe(0);
  });

  it('uses non-reference exercise resources as trial fallback', () => {
    const supplementExerciseState = evaluateProjectCultivation({
      project_id: 'p1',
      realm_rank: 0,
      resources: [
        breakthroughReadyResources[0],
        {
          id: 'exercise-fallback',
          type: 'exercise',
          status: 'completed',
          progress_percent: 100,
          cultivation_role: 'supplement',
          mastery_group: null,
          mastery_weight: 1,
        },
      ],
      logs: [cultivationLog({ studied_at: '2026-05-31T00:00:00.000Z', duration_minutes: 120, evidence_type: 'practice' })],
      now: new Date('2026-05-31T12:00:00.000Z'),
    });
    const referenceExerciseState = evaluateProjectCultivation({
      project_id: 'p1',
      realm_rank: 0,
      resources: [
        breakthroughReadyResources[0],
        {
          id: 'reference-exercise',
          type: 'exercise',
          status: 'completed',
          progress_percent: 100,
          cultivation_role: 'reference',
          mastery_group: null,
          mastery_weight: 1,
        },
      ],
      logs: [cultivationLog({ studied_at: '2026-05-31T00:00:00.000Z', duration_minutes: 120, evidence_type: 'practice' })],
      now: new Date('2026-05-31T12:00:00.000Z'),
    });

    expect(supplementExerciseState.trial_resource_count).toBe(1);
    expect(supplementExerciseState.metrics.trial_mastery).toBe(100);
    expect(referenceExerciseState.trial_resource_count).toBe(0);
  });
});

const firstInputResources = [
  {
    id: 'a',
    type: 'document',
    status: 'completed',
    progress_percent: 100,
    cultivation_role: 'core',
    mastery_group: 'react-basic',
    mastery_weight: 1,
  },
  {
    id: 'b',
    type: 'video',
    status: 'not_started',
    progress_percent: 0,
    cultivation_role: 'core',
    mastery_group: 'react-basic',
    mastery_weight: 1,
  },
] as const;

const breakthroughReadyResources = [
  {
    id: 'core',
    type: 'document',
    status: 'completed',
    progress_percent: 100,
    cultivation_role: 'core',
    mastery_group: null,
    mastery_weight: 1,
  },
  {
    id: 'trial',
    type: 'exercise',
    status: 'completed',
    progress_percent: 100,
    cultivation_role: 'trial',
    mastery_group: null,
    mastery_weight: 1,
  },
] satisfies CultivationResourceSnapshot[];

function cultivationLog(input: Partial<CultivationLogSnapshot> & Pick<CultivationLogSnapshot, 'studied_at'>): CultivationLogSnapshot {
  return {
    duration_minutes: null,
    content: null,
    progress_before_percent: 0,
    progress_after_percent: 0,
    evidence_type: null,
    ...input,
  };
}
