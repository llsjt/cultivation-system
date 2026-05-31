import { describe, expect, it } from 'vitest';

import { deriveRealmLayer, evaluateProjectCultivation } from './realm';

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
      logs: [{ studied_at: '2026-05-30T00:00:00.000Z', content: '复盘', evidence_type: 'note' }],
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
        { studied_at: '2026-05-30T00:00:00.000Z', content: '完成测试', evidence_type: 'assessment' },
        { studied_at: '2026-05-31T00:00:00.000Z', content: '完成练习', evidence_type: 'practice' },
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
