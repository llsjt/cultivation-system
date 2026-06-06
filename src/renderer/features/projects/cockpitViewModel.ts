import type { GetHomeOverviewOutput, GetProjectCultivationOutput, GetProjectDetailOutput, ResourceSummary, SaveStudyLogOutput } from '../../../shared/dto';
import { buildBreakthroughDiagnosticViewModel, type BreakthroughDiagnosticViewModel } from './cultivationDiagnostics';
import { getResourceRoleDisplay, getResourceStatusLabel, getResourceTypeLabel } from '../resources/resourceDisplay';

type ProjectSummary = GetHomeOverviewOutput['projects'][number];
type StudyLogSummary = GetHomeOverviewOutput['recent_logs'][number];

export type RecommendedStudyViewModel = {
  projectId: string;
  projectName: string;
  resourceId: string;
  resourceTitle: string;
  resource: ResourceSummary;
  typeLabel: string;
  roleLabel: string;
  roleDescription: string;
  statusLabel: string;
  progressPercent: number;
  progressLabel: string;
  progressDescription: string;
  lastStudiedLabel: string;
  recommendationReason: string;
  nextAction: string;
};

export type ProjectCultivationViewModel = {
  projectId: string;
  projectName: string;
  realmLabel: string;
  projectProgressLabel: string;
  resourceCountLabel: string;
  coreResourceCountLabel: string;
  trialResourceCountLabel: string;
  recentLogCountLabel: string;
  statusLabel: string;
};

export type LastStudyFeedbackInput = {
  savedAt: string;
  output: SaveStudyLogOutput;
};

export type LastStudyFeedbackViewModel = {
  resourceTitle: string;
  savedAtLabel: string;
  progressChangeLabel: string;
  durationLabel: string;
  nextAction: string;
  feedbackLabel: string;
};

export type CockpitViewModel = {
  recommendation: RecommendedStudyViewModel | null;
  cultivationStrip: ProjectCultivationViewModel | null;
  breakthroughDiagnostic: BreakthroughDiagnosticViewModel | null;
  lastStudyFeedback: LastStudyFeedbackViewModel | null;
};

export type BuildCockpitViewModelInput = {
  overview: GetHomeOverviewOutput | null;
  selectedProject: ProjectSummary | null;
  projectDetail: GetProjectDetailOutput | null;
  projectCultivation: GetProjectCultivationOutput | null;
  lastStudyFeedback: LastStudyFeedbackInput | null;
  now: Date;
};

export function buildCockpitViewModel(input: BuildCockpitViewModelInput): CockpitViewModel {
  return {
    recommendation: buildRecommendedStudyViewModel(input),
    cultivationStrip: buildProjectCultivationViewModel(input.selectedProject, input.projectCultivation),
    breakthroughDiagnostic: buildBreakthroughDiagnosticViewModel(input.projectCultivation),
    lastStudyFeedback: buildLastStudyFeedbackViewModel(input.lastStudyFeedback, input.selectedProject),
  };
}

function buildRecommendedStudyViewModel(input: BuildCockpitViewModelInput): RecommendedStudyViewModel | null {
  if (!input.selectedProject) {
    return null;
  }

  const currentProjectResources =
    input.projectDetail?.project.id === input.selectedProject.id ? input.projectDetail.resources.items : [];
  const recommendedResource =
    selectRecommendedResource(currentProjectResources) ?? selectSameProjectFallback(input.overview, input.selectedProject);

  if (!recommendedResource) {
    return null;
  }

  const role = getResourceRoleDisplay(recommendedResource.cultivation_role);
  const recentLog = findLatestResourceLog(input.projectDetail?.recent_logs ?? [], recommendedResource.id);

  return {
    projectId: input.selectedProject.id,
    projectName: input.selectedProject.name,
    resourceId: recommendedResource.id,
    resourceTitle: recommendedResource.title,
    resource: recommendedResource,
    typeLabel: getResourceTypeLabel(recommendedResource.type),
    roleLabel: role.label,
    roleDescription: role.description,
    statusLabel: getResourceStatusLabel(recommendedResource.status),
    progressPercent: recommendedResource.progress_percent,
    progressLabel: `${recommendedResource.progress_percent}%`,
    progressDescription: recommendedResource.progress_text ?? '尚未记录具体进度描述。',
    lastStudiedLabel: formatRecentStudyLabel(recentLog?.studied_at ?? recommendedResource.last_studied_at),
    recommendationReason: buildRecommendationReason(recommendedResource, input.now),
    nextAction: recommendedResource.next_action ?? '还没有设置下次学习目标。',
  };
}

function buildProjectCultivationViewModel(
  selectedProject: ProjectSummary | null,
  cultivation: GetProjectCultivationOutput | null,
): ProjectCultivationViewModel | null {
  if (!selectedProject) {
    return null;
  }

  return {
    projectId: selectedProject.id,
    projectName: selectedProject.name,
    realmLabel: `${selectedProject.realm_name}${cultivation?.realm_layer ?? selectedProject.realm_layer}层`,
    projectProgressLabel: `${selectedProject.progress_percent}%`,
    resourceCountLabel: `${selectedProject.resource_count} 份`,
    coreResourceCountLabel: cultivation ? `${cultivation.core_resource_count} 份` : '待评估',
    trialResourceCountLabel: cultivation ? `${cultivation.trial_resource_count} 个` : '待评估',
    recentLogCountLabel: cultivation ? `${cultivation.recent_log_count} 条` : '待评估',
    statusLabel: getResourceStatusLabel(selectedProject.status),
  };
}

function buildLastStudyFeedbackViewModel(input: LastStudyFeedbackInput | null, selectedProject: ProjectSummary | null): LastStudyFeedbackViewModel | null {
  if (!input) {
    return null;
  }
  if (selectedProject && input.output.resource.project_id !== selectedProject.id) {
    return null;
  }

  return {
    resourceTitle: input.output.resource.title,
    savedAtLabel: formatDateLabel(input.savedAt),
    progressChangeLabel: `${input.output.log.progress_before_percent}% → ${input.output.log.progress_after_percent}%`,
    durationLabel:
      input.output.log.duration_minutes === null ? '未记录有效学习时长' : `有效学习 ${input.output.log.duration_minutes} 分钟`,
    nextAction: input.output.resource.next_action ?? '暂无下次目标。',
    feedbackLabel: getFeedbackLabel(input.output.feedback_kind),
  };
}

function selectRecommendedResource(resources: ResourceSummary[]): ResourceSummary | null {
  return resources.find((resource) => ['learning', 'review', 'not_started'].includes(resource.status)) ?? null;
}

function selectSameProjectFallback(overview: GetHomeOverviewOutput | null, selectedProject: ProjectSummary): ResourceSummary | null {
  if (overview?.recommended?.project_id !== selectedProject.id) {
    return null;
  }

  return overview.recommended;
}

function findLatestResourceLog(logs: StudyLogSummary[], resourceId: string): StudyLogSummary | null {
  return logs.find((log) => log.resource_id === resourceId) ?? null;
}

function formatRecentStudyLabel(value: string | null): string {
  return value ? `最近出关 ${formatDateLabel(value)}` : '尚未出关';
}

function formatDateLabel(value: string): string {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) {
    return '时间未记录';
  }

  return new Date(time).toISOString().slice(0, 10);
}

function buildRecommendationReason(resource: ResourceSummary, now: Date): string {
  if (resource.next_action?.trim()) {
    return '已有明确下次目标，适合直接恢复现场。';
  }

  if (resource.cultivation_role === 'core' && resource.progress_percent < 80) {
    return '核心功法掌握度未稳，优先补主干。';
  }

  if (resource.cultivation_role === 'trial' && resource.progress_percent < 70) {
    return '突破试炼还需打磨，适合作为本轮练习。';
  }

  if (resource.last_studied_at && daysBetween(resource.last_studied_at, now) >= 7) {
    return '最近一周没有出关记录，建议回访这份资料。';
  }

  if (resource.status === 'not_started') {
    return '这份资料尚未开始，可作为本轮入口。';
  }

  return '按当前方向的资料状态推荐。';
}

function daysBetween(value: string, now: Date): number {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) {
    return 0;
  }

  return Math.floor((now.getTime() - time) / (24 * 60 * 60 * 1000));
}

function getFeedbackLabel(kind: SaveStudyLogOutput['feedback_kind']): string {
  if (kind === 'completed') {
    return '本次已完成资料。';
  }
  if (kind === 'increased') {
    return '本次推进了进度。';
  }
  if (kind === 'decreased') {
    return '本次回退了进度，请确认这是有意复盘。';
  }
  return '本次记录保持进度不变。';
}
