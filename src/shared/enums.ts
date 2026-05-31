import { z } from 'zod';

export const projectStatusValues = ['not_started', 'learning', 'paused', 'review', 'completed'] as const;
export const resourceStatusValues = projectStatusValues;
export const resourceTypeValues = ['document', 'video', 'web', 'course', 'repo', 'exercise', 'book', 'other'] as const;
export const openKindValues = ['file', 'folder', 'url', 'record_only'] as const;
export const studyLogSourceValues = ['pending', 'record_only', 'manual'] as const;
export const cultivationRoleValues = ['core', 'supplement', 'trial', 'reference'] as const;
export const studyEvidenceTypeValues = ['read', 'note', 'practice', 'assessment'] as const;

export type ProjectStatus = (typeof projectStatusValues)[number];
export type ResourceStatus = (typeof resourceStatusValues)[number];
export type ResourceType = (typeof resourceTypeValues)[number];
export type OpenKind = (typeof openKindValues)[number];
export type StudyLogSource = (typeof studyLogSourceValues)[number];
export type CultivationRole = (typeof cultivationRoleValues)[number];
export type StudyEvidenceType = (typeof studyEvidenceTypeValues)[number];

export const ProjectStatusSchema = z.enum(projectStatusValues);
export const ResourceStatusSchema = z.enum(resourceStatusValues);
export const ResourceTypeSchema = z.enum(resourceTypeValues);
export const OpenKindSchema = z.enum(openKindValues);
export const StudyLogSourceSchema = z.enum(studyLogSourceValues);
export const CultivationRoleSchema = z.enum(cultivationRoleValues);
export const StudyEvidenceTypeSchema = z.enum(studyEvidenceTypeValues);

export const enumLabels = {
  project_status: [
    { value: 'not_started', plain_label: '未开始', themed_label: '初窥门径' },
    { value: 'learning', plain_label: '学习中', themed_label: '闭关淬炼' },
    { value: 'paused', plain_label: '已暂停', themed_label: '暂入红尘' },
    { value: 'review', plain_label: '需复习', themed_label: '温故破障' },
    { value: 'completed', plain_label: '已完成', themed_label: '大圆满' },
  ],
  resource_status: [
    { value: 'not_started', plain_label: '未开始', themed_label: '初窥门径' },
    { value: 'learning', plain_label: '学习中', themed_label: '闭关淬炼' },
    { value: 'paused', plain_label: '已暂停', themed_label: '暂入红尘' },
    { value: 'review', plain_label: '需复习', themed_label: '温故破障' },
    { value: 'completed', plain_label: '已完成', themed_label: '大圆满' },
  ],
  resource_type: [
    { value: 'document', label: '文档' },
    { value: 'video', label: '视频' },
    { value: 'web', label: '网页' },
    { value: 'course', label: '课程' },
    { value: 'repo', label: '仓库' },
    { value: 'exercise', label: '练习' },
    { value: 'book', label: '书籍' },
    { value: 'other', label: '其他' },
  ],
  open_kind: [
    { value: 'file', label: '文件' },
    { value: 'folder', label: '文件夹' },
    { value: 'url', label: '网页链接' },
    { value: 'record_only', label: '仅记录' },
  ],
  cultivation_role: [
    { value: 'core', label: '核心功法' },
    { value: 'supplement', label: '辅修典籍' },
    { value: 'trial', label: '突破试炼' },
    { value: 'reference', label: '参考资料' },
  ],
  study_evidence_type: [
    { value: 'read', label: '阅读理解' },
    { value: 'note', label: '笔记复盘' },
    { value: 'practice', label: '练习实践' },
    { value: 'assessment', label: '测验通过' },
  ],
} as const;
