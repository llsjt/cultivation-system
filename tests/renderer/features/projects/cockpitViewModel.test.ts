import { describe, expect, it } from 'vitest';

import type {
  GetHomeOverviewOutput,
  GetProjectCultivationOutput,
  GetProjectDetailOutput,
  ProjectSummary,
  ResourceSummary,
  SaveStudyLogOutput,
  StudyLogView,
} from '../../../../src/shared/dto';
import { buildCockpitViewModel } from '../../../../src/renderer/features/projects/cockpitViewModel';

const now = new Date('2026-06-06T00:00:00.000Z');

describe('cockpit view model', () => {
  it('derives the recommendation from the selected project resources before global overview fallback', () => {
    const selectedProject = project({ id: 'p1', name: 'React 法门' });
    const currentProjectResource = resource({
      id: 'r-current',
      project_id: 'p1',
      title: 'Hooks 主线',
      next_action: '复习 useEffect 清理',
    });
    const overview = overviewFixture({
      recommended: resource({ id: 'r-other', project_id: 'p2', title: 'Other Project Resource' }),
    });
    const projectDetail = detailFixture({
      project: selectedProject,
      resources: [currentProjectResource],
      recent_logs: [studyLog({ resource_id: currentProjectResource.id, studied_at: '2026-06-01T00:00:00.000Z' })],
    });

    const viewModel = buildCockpitViewModel({
      overview,
      selectedProject,
      projectDetail,
      projectCultivation: cultivationFixture({ project_id: selectedProject.id }),
      lastStudyFeedback: null,
      now,
    });

    expect(viewModel.recommendation).toMatchObject({
      projectId: 'p1',
      projectName: 'React 法门',
      resourceId: 'r-current',
      resourceTitle: 'Hooks 主线',
      lastStudiedLabel: '最近出关 2026-06-01',
      recommendationReason: '已有明确下次目标，适合直接恢复现场。',
    });
  });

  it('uses global recommended only when it belongs to the selected project', () => {
    const selectedProject = project({ id: 'p1' });
    const sameProjectFallback = resource({ id: 'r-fallback', project_id: 'p1', title: '同项目推荐' });
    const otherProjectFallback = resource({ id: 'r-other', project_id: 'p2', title: '错位推荐' });

    const sameProjectViewModel = buildCockpitViewModel({
      overview: overviewFixture({ recommended: sameProjectFallback }),
      selectedProject,
      projectDetail: detailFixture({ project: selectedProject, resources: [] }),
      projectCultivation: null,
      lastStudyFeedback: null,
      now,
    });
    const otherProjectViewModel = buildCockpitViewModel({
      overview: overviewFixture({ recommended: otherProjectFallback }),
      selectedProject,
      projectDetail: detailFixture({ project: selectedProject, resources: [] }),
      projectCultivation: null,
      lastStudyFeedback: null,
      now,
    });

    expect(sameProjectViewModel.recommendation?.resourceId).toBe('r-fallback');
    expect(otherProjectViewModel.recommendation).toBeNull();
  });

  it('builds cultivation strip and breakthrough slices from the same cultivation fixture', () => {
    const selectedProject = project({ id: 'p1', name: 'TypeScript 法门', progress_percent: 64, resource_count: 5 });
    const cultivation = cultivationFixture({
      project_id: 'p1',
      core_resource_count: 2,
      trial_resource_count: 1,
      recent_log_count: 3,
      bottlenecks: ['核心功法掌握度需达到 80%。'],
    });

    const viewModel = buildCockpitViewModel({
      overview: overviewFixture(),
      selectedProject,
      projectDetail: detailFixture({ project: selectedProject, resources: [] }),
      projectCultivation: cultivation,
      lastStudyFeedback: null,
      now,
    });

    expect(viewModel.cultivationStrip).toMatchObject({
      projectName: 'TypeScript 法门',
      projectProgressLabel: '64%',
      resourceCountLabel: '5 份',
      coreResourceCountLabel: '2 份',
      trialResourceCountLabel: '1 个',
      recentLogCountLabel: '3 条',
    });
    expect(viewModel.breakthroughDiagnostic?.primaryBottleneck).toBe('核心功法掌握度需达到 80%。');
  });

  it('turns the last saved study log into a persistent cockpit feedback slice', () => {
    const savedOutput = saveOutputFixture();
    const viewModel = buildCockpitViewModel({
      overview: overviewFixture(),
      selectedProject: project({ id: 'p1' }),
      projectDetail: null,
      projectCultivation: null,
      lastStudyFeedback: {
        savedAt: '2026-06-06T08:30:00.000Z',
        output: savedOutput,
      },
      now,
    });

    expect(viewModel.lastStudyFeedback).toMatchObject({
      resourceTitle: 'Hooks 主线',
      savedAtLabel: '2026-06-06',
      progressChangeLabel: '20% → 45%',
      durationLabel: '有效学习 45 分钟',
      nextAction: '继续 useMemo',
      feedbackLabel: '本次推进了进度。',
    });
  });
});

function overviewFixture(overrides: Partial<GetHomeOverviewOutput> = {}): GetHomeOverviewOutput {
  return {
    recommended: null,
    recommended_project_name: null,
    recommended_project_progress: null,
    pending: null,
    projects: [project({ id: 'p1' })],
    recent_logs: [],
    last_saved_at: null,
    ...overrides,
  };
}

function detailFixture(input: {
  project: ProjectSummary;
  resources: ResourceSummary[];
  recent_logs?: StudyLogView[];
}): GetProjectDetailOutput {
  return {
    project: input.project,
    resources: {
      items: input.resources,
      total: input.resources.length,
      limit: 100,
      offset: 0,
    },
    recent_logs: input.recent_logs ?? [],
  };
}

function project(overrides: Partial<ProjectSummary> = {}): ProjectSummary {
  return {
    id: 'p1',
    name: '默认法门',
    status: 'learning',
    progress_percent: 20,
    resource_count: 1,
    realm_rank: 0,
    realm_layer: 2,
    realm_name: '炼气',
    last_studied_at: null,
    updated_at: '2026-06-01T00:00:00.000Z',
    created_at: '2026-05-01T00:00:00.000Z',
    ...overrides,
  };
}

function resource(overrides: Partial<ResourceSummary> = {}): ResourceSummary {
  return {
    id: 'r1',
    project_id: 'p1',
    title: '默认资料',
    type: 'document',
    open_kind: 'record_only',
    cultivation_role: 'core',
    mastery_group: null,
    mastery_weight: 3,
    status: 'learning',
    progress_text: '读到副作用章节',
    progress_percent: 20,
    next_action: null,
    last_opened_at: null,
    last_studied_at: null,
    updated_at: '2026-06-01T00:00:00.000Z',
    created_at: '2026-05-01T00:00:00.000Z',
    ...overrides,
  };
}

function studyLog(overrides: Partial<StudyLogView> = {}): StudyLogView {
  return {
    id: 'log1',
    resource_id: 'r1',
    resource_title_snapshot: '默认资料',
    studied_at: '2026-06-01T00:00:00.000Z',
    duration_minutes: 45,
    content: '复盘',
    progress_before_percent: 10,
    progress_after_percent: 20,
    status_before: 'learning',
    status_after: 'learning',
    next_action: '继续',
    evidence_type: 'note',
    ...overrides,
  };
}

function cultivationFixture(overrides: Partial<GetProjectCultivationOutput> = {}): GetProjectCultivationOutput {
  return {
    project_id: 'p1',
    realm_rank: 0,
    realm_name: '炼气',
    realm_layer: 4,
    next_realm_name: '筑基',
    dao_foundation_score: 76,
    can_breakthrough: false,
    metrics: {
      core_mastery: 70,
      trial_mastery: 72,
      reflection_score: 60,
      stability_score: 40,
    },
    core_resource_count: 1,
    trial_resource_count: 1,
    recent_log_count: 1,
    effective_study_minutes_14d: 45,
    effective_study_minutes_target: 120,
    effective_study_minutes_remaining: 75,
    effective_study_days_14d: 1,
    missing_duration_log_count: 0,
    capped_duration_log_count: 0,
    diagnostic_warnings: ['近 14 天有效学习时间不足，还差 75 分钟。'],
    bottlenecks: [],
    ...overrides,
  };
}

function saveOutputFixture(): SaveStudyLogOutput {
  const savedResource = resource({
    id: 'r1',
    title: 'Hooks 主线',
    progress_percent: 45,
    next_action: '继续 useMemo',
  });

  return {
    log: studyLog({
      resource_id: savedResource.id,
      resource_title_snapshot: savedResource.title,
      duration_minutes: 45,
      progress_before_percent: 20,
      progress_after_percent: 45,
      next_action: savedResource.next_action,
    }),
    resource: savedResource,
    project_progress_percent: 45,
    progress_delta: 25,
    feedback_kind: 'increased',
  };
}
