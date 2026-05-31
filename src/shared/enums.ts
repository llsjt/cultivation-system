import { z } from 'zod';

export const projectStatusValues = ['not_started', 'learning', 'paused', 'review', 'completed'] as const;
export const resourceStatusValues = projectStatusValues;
export const resourceTypeValues = ['document', 'video', 'web', 'course', 'repo', 'exercise', 'book', 'other'] as const;
export const openKindValues = ['file', 'folder', 'url', 'record_only'] as const;
export const studyLogSourceValues = ['pending', 'record_only', 'manual'] as const;

export type ProjectStatus = (typeof projectStatusValues)[number];
export type ResourceStatus = (typeof resourceStatusValues)[number];
export type ResourceType = (typeof resourceTypeValues)[number];
export type OpenKind = (typeof openKindValues)[number];
export type StudyLogSource = (typeof studyLogSourceValues)[number];

export const ProjectStatusSchema = z.enum(projectStatusValues);
export const ResourceStatusSchema = z.enum(resourceStatusValues);
export const ResourceTypeSchema = z.enum(resourceTypeValues);
export const OpenKindSchema = z.enum(openKindValues);
export const StudyLogSourceSchema = z.enum(studyLogSourceValues);

export const enumLabels = {
  project_status: [
    { value: 'not_started', plain_label: '未开始', themed_label: '未入门' },
    { value: 'learning', plain_label: '学习中', themed_label: '闭关中' },
    { value: 'paused', plain_label: '已暂停', themed_label: '暂缓修行' },
    { value: 'review', plain_label: '需复习', themed_label: '待破难点' },
    { value: 'completed', plain_label: '已完成', themed_label: '已出师' },
  ],
  resource_status: [
    { value: 'not_started', plain_label: '未开始', themed_label: '未入门' },
    { value: 'learning', plain_label: '学习中', themed_label: '闭关中' },
    { value: 'paused', plain_label: '已暂停', themed_label: '暂缓修行' },
    { value: 'review', plain_label: '需复习', themed_label: '待破难点' },
    { value: 'completed', plain_label: '已完成', themed_label: '已出师' },
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
} as const;
