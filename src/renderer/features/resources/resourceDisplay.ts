import type { CultivationRole, ResourceStatus, ResourceType } from '../../../shared/enums';

export type DisplayMeta = {
  label: string;
  description: string;
  tone: 'default' | 'info' | 'success' | 'warning' | 'muted';
};

const roleDisplays: Record<CultivationRole, DisplayMeta> = {
  core: {
    label: '核心功法',
    description: '直接影响当前方向的主干掌握。',
    tone: 'success',
  },
  supplement: {
    label: '辅修典籍',
    description: '补足理解背景，辅助主干推进。',
    tone: 'info',
  },
  trial: {
    label: '突破试炼',
    description: '用于验证能否独立运用当前方向。',
    tone: 'warning',
  },
  reference: {
    label: '参考资料',
    description: '作为查阅和旁证，不作为主要境界贡献。',
    tone: 'muted',
  },
};

const typeLabels: Record<ResourceType, string> = {
  book: '书籍',
  course: '课程',
  document: '文档',
  exercise: '练习',
  other: '其他',
  repo: '仓库',
  video: '视频',
  web: '网页',
};

const statusLabels: Record<ResourceStatus, string> = {
  completed: '已完成',
  learning: '学习中',
  not_started: '未开始',
  paused: '已暂停',
  review: '需复习',
};

export function getResourceRoleDisplay(role: CultivationRole): DisplayMeta {
  return roleDisplays[role];
}

export function getResourceWeightDisplay(weight: number): DisplayMeta & { valueLabel: string } {
  const safeWeight = Number.isFinite(weight) ? weight : 1;
  const normalizedWeight = Math.min(5, Math.max(1, Math.trunc(safeWeight)));
  const highWeightHint = normalizedWeight >= 5 ? '最高代表性请谨慎使用，避免所有资料都变成主干。' : '代表这份资料对当前方向境界反馈的影响程度。';

  return {
    label: `方向代表性 ${normalizedWeight}/5`,
    valueLabel: `${normalizedWeight}/5`,
    description: highWeightHint,
    tone: normalizedWeight >= 4 ? 'warning' : 'info',
  };
}

export function getResourceTypeLabel(type: ResourceType): string {
  return typeLabels[type];
}

export function getResourceStatusLabel(status: ResourceStatus): string {
  return statusLabels[status];
}
