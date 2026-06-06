import { describe, expect, it } from 'vitest';

import { GetProjectCultivationOutputSchema, SaveStudyLogInputSchema, UpdateResourceInputSchema } from './dto';

describe('DTO schemas', () => {
  it('requires resource_updated_at_before for new study logs', () => {
    expect(() =>
      SaveStudyLogInputSchema.parse({
        resource_id: 'r1',
        source: 'record_only',
        progress_percent: 20,
        resource_updated_at_before: '',
      }),
    ).toThrow();
  });

  it('rejects progress and project changes in update_resource', () => {
    expect(() =>
      UpdateResourceInputSchema.parse({
        resource_id: 'r1',
        title: 'x',
        type: 'document',
        open_kind: 'record_only',
        progress_percent: 30,
      }),
    ).toThrow();
  });

  it('parses v1.6 cultivation diagnostics fields', () => {
    expect(
      GetProjectCultivationOutputSchema.parse({
        project_id: 'p1',
        realm_rank: 0,
        realm_name: '炼气',
        realm_layer: 8,
        next_realm_name: '筑基',
        dao_foundation_score: 84,
        can_breakthrough: true,
        metrics: {
          core_mastery: 100,
          trial_mastery: 100,
          reflection_score: 75,
          stability_score: 60,
        },
        core_resource_count: 1,
        trial_resource_count: 1,
        recent_log_count: 2,
        effective_study_minutes_14d: 120,
        effective_study_minutes_target: 120,
        effective_study_minutes_remaining: 0,
        effective_study_days_14d: 2,
        missing_duration_log_count: 1,
        capped_duration_log_count: 1,
        diagnostic_warnings: ['有 1 条出关记录缺少有效学习时长，暂不阻断突破。'],
        bottlenecks: [],
      }),
    ).toMatchObject({
      effective_study_minutes_14d: 120,
      diagnostic_warnings: ['有 1 条出关记录缺少有效学习时长，暂不阻断突破。'],
    });
  });
});
