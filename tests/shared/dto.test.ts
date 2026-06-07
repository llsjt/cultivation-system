import { describe, expect, it } from 'vitest';

import {
  GetProjectCultivationOutputSchema,
  GetProjectDetailInputSchema,
  ListProjectsInputSchema,
  PendingSessionClosedEventSchema,
  SaveStudyLogInputSchema,
  SelectLocalFileInputSchema,
  SelectLocalFileOutputSchema,
  UpdateResourceInputSchema,
} from '../../src/shared/dto';

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

  it('rejects extra fields in page and project detail inputs', () => {
    expect(() => ListProjectsInputSchema.parse({ limit: 20, extra: true })).toThrow();
    expect(() => GetProjectDetailInputSchema.parse({ project_id: 'p1', extra: true })).toThrow();
  });

  it('parses select local file input and output contracts', () => {
    expect(SelectLocalFileInputSchema.parse(undefined)).toEqual({});
    expect(SelectLocalFileInputSchema.parse({ properties: ['openFile'] })).toEqual({ properties: ['openFile'] });
    expect(SelectLocalFileOutputSchema.parse(null)).toBeNull();
    expect(SelectLocalFileOutputSchema.parse('D:/notes.md')).toBe('D:/notes.md');
    expect(() => SelectLocalFileInputSchema.parse({ properties: ['createDirectory'] })).toThrow();
    expect(() => SelectLocalFileInputSchema.parse({ properties: ['openFile'], extra: true })).toThrow();
  });

  it('validates pending session closed event payloads', () => {
    const payload = {
      id: 'pending-1',
      project_id: 'project-1',
      resource_id: 'resource-1',
      resource_title_snapshot: '秘卷',
      current_resource_title: '秘卷',
      opened_at: '2026-01-01T00:00:00.000Z',
      closed_at: '2026-01-01T00:20:00.000Z',
      duration_minutes: 20,
      close_source: 'viewer_closed',
      progress_before_text: null,
      progress_before_percent: 10,
      status_before: 'learning',
      next_action_before: null,
      resource_updated_at_before: '2026-01-01T00:00:00.000Z',
    };

    expect(PendingSessionClosedEventSchema.parse(payload)).toMatchObject({ id: 'pending-1' });
    expect(() => PendingSessionClosedEventSchema.parse({ ...payload, close_source: 'bad_source' })).toThrow();
  });
});
