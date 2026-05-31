import { z } from 'zod';

import {
  OpenKindSchema,
  ProjectStatusSchema,
  ResourceStatusSchema,
  ResourceTypeSchema,
  StudyLogSourceSchema,
} from './enums';
import type { AppErrorPayload } from './errors';

const idSchema = z.string().min(1);
const isoStringSchema = z.string().min(1);
const nullableText = (max: number) => z.string().trim().max(max).optional().nullable();
const pageInputSchema = z.object({
  limit: z.number().int().min(1).max(100).default(50).optional(),
  offset: z.number().int().min(0).default(0).optional(),
});

export const ProjectSummarySchema = z.object({
  id: idSchema,
  name: z.string(),
  status: ProjectStatusSchema,
  progress_percent: z.number().int().min(0).max(100),
  resource_count: z.number().int().min(0),
  last_studied_at: z.string().nullable(),
  updated_at: isoStringSchema,
  created_at: isoStringSchema,
});

export const ResourceSummarySchema = z.object({
  id: idSchema,
  project_id: idSchema,
  title: z.string(),
  type: ResourceTypeSchema,
  open_kind: OpenKindSchema,
  status: ResourceStatusSchema,
  progress_text: z.string().nullable(),
  progress_percent: z.number().int().min(0).max(100),
  next_action: z.string().nullable(),
  last_opened_at: z.string().nullable(),
  last_studied_at: z.string().nullable(),
  updated_at: isoStringSchema,
  created_at: isoStringSchema,
});

export const StudyLogViewSchema = z.object({
  id: idSchema,
  resource_id: z.string().nullable(),
  resource_title_snapshot: z.string(),
  studied_at: isoStringSchema,
  duration_minutes: z.number().int().min(0).max(1440).nullable(),
  content: z.string().nullable(),
  progress_before_percent: z.number().int().min(0).max(100),
  progress_after_percent: z.number().int().min(0).max(100),
  status_before: ResourceStatusSchema,
  status_after: ResourceStatusSchema,
  next_action: z.string().nullable(),
});

export const PendingSessionViewSchema = z.object({
  id: idSchema,
  project_id: idSchema,
  resource_id: idSchema,
  resource_title_snapshot: z.string(),
  current_resource_title: z.string().nullable(),
  opened_at: isoStringSchema,
  progress_before_text: z.string().nullable(),
  progress_before_percent: z.number().int().min(0).max(100),
  status_before: ResourceStatusSchema,
  next_action_before: z.string().nullable(),
  resource_updated_at_before: isoStringSchema,
});

export const ResourceDetailSchema = ResourceSummarySchema.extend({
  path_or_url_display: z.string().nullable(),
  path_or_url_raw: z.string().nullable().optional(),
  recent_logs: z.array(StudyLogViewSchema),
});

export const GetHomeOverviewInputSchema = z.undefined().optional();
export const GetHomeOverviewOutputSchema = z.object({
  recommended: ResourceSummarySchema.nullable(),
  recommended_project_name: z.string().nullable(),
  recommended_project_progress: z.number().int().min(0).max(100).nullable(),
  pending: PendingSessionViewSchema.nullable(),
  projects: z.array(ProjectSummarySchema),
  recent_logs: z.array(StudyLogViewSchema),
  last_saved_at: z.string().nullable(),
});

export const ListProjectsInputSchema = pageInputSchema.default({});
export const ListProjectsOutputSchema = pageOf(ProjectSummarySchema);

export const GetProjectDetailInputSchema = z.object({
  project_id: idSchema,
  limit: z.number().int().min(1).max(100).default(100).optional(),
  offset: z.number().int().min(0).default(0).optional(),
});
export const GetProjectDetailOutputSchema = z.object({
  project: ProjectSummarySchema,
  resources: pageOf(ResourceSummarySchema),
  recent_logs: z.array(StudyLogViewSchema),
});

export const CreateProjectInputSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: nullableText(1000),
  })
  .strict();
export const UpdateProjectInputSchema = CreateProjectInputSchema.extend({ project_id: idSchema }).strict();

export const DeleteProjectInputSchema = z.object({ project_id: idSchema }).strict();
export const DeleteProjectOutputSchema = z.object({ deleted: z.literal(true) });

export const CreateResourceInputSchema = z
  .object({
    project_id: idSchema,
    title: z.string().trim().min(1).max(200),
    type: ResourceTypeSchema,
    open_kind: OpenKindSchema,
    path_or_url: nullableText(2048),
    initial_progress_percent: z.number().int().min(0).max(100).default(0).optional(),
    initial_progress_text: nullableText(500),
    initial_next_action: nullableText(500),
    initial_status: ResourceStatusSchema.optional(),
  })
  .strict();

export const UpdateResourceInputSchema = z
  .object({
    resource_id: idSchema,
    title: z.string().trim().min(1).max(200),
    type: ResourceTypeSchema,
    open_kind: OpenKindSchema,
    path_or_url: nullableText(2048),
    status: z.enum(['learning', 'review', 'paused']).optional(),
  })
  .strict();

export const DeleteResourceInputSchema = z.object({ resource_id: idSchema }).strict();
export const DeleteResourceOutputSchema = z.object({ deleted: z.literal(true) });
export const GetResourceDetailInputSchema = z.object({ resource_id: idSchema }).strict();

export const ContinueResourceInputSchema = z
  .object({
    resource_id: idSchema,
    risk_confirm_token: z.string().min(1).optional(),
  })
  .strict();
export const ContinueResourceOutputSchema = z.object({
  result: z.enum(['opened', 'record_only', 'pending_conflict', 'blocked', 'open_failed']),
  pending: PendingSessionViewSchema.optional(),
  conflict_existing: PendingSessionViewSchema.optional(),
  block_reason: z.string().optional(),
  block_level: z.enum(['hard', 'warn']).optional(),
  risk_confirm_token: z.string().optional(),
  open_error_code: z.string().optional(),
});

export const SaveStudyLogInputSchema = z
  .object({
    resource_id: idSchema,
    source: StudyLogSourceSchema,
    progress_percent: z.number().int().min(0).max(100),
    progress_text: nullableText(500),
    next_action: nullableText(500),
    status: ResourceStatusSchema.optional(),
    duration_minutes: z.number().int().min(0).max(1440).optional().nullable(),
    content: nullableText(2000),
    resource_updated_at_before: z.string().min(1),
    confirm_overwrite: z.boolean().default(false).optional(),
  })
  .strict();
export const SaveStudyLogOutputSchema = z.object({
  log: StudyLogViewSchema,
  resource: ResourceSummarySchema,
  project_progress_percent: z.number().int().min(0).max(100),
  progress_delta: z.number().int(),
  feedback_kind: z.enum(['increased', 'decreased', 'unchanged', 'completed']),
});

export const GetPendingSessionInputSchema = z.undefined().optional();
export const GetPendingSessionOutputSchema = PendingSessionViewSchema.nullable();
export const AbandonPendingSessionInputSchema = z.object({ session_id: idSchema }).strict();
export const AbandonPendingSessionOutputSchema = z.object({ abandoned: z.literal(true) });

export const GetEnumsInputSchema = z.undefined().optional();

export interface IpcOk<T> {
  ok: true;
  data: T;
}

export interface IpcFailure {
  ok: false;
  error: AppErrorPayload;
}

export type IpcResult<T> = IpcOk<T> | IpcFailure;

export type ProjectSummary = z.infer<typeof ProjectSummarySchema>;
export type ResourceSummary = z.infer<typeof ResourceSummarySchema>;
export type ResourceDetail = z.infer<typeof ResourceDetailSchema>;
export type StudyLogView = z.infer<typeof StudyLogViewSchema>;
export type PendingSessionView = z.infer<typeof PendingSessionViewSchema>;
export type GetHomeOverviewOutput = z.infer<typeof GetHomeOverviewOutputSchema>;
export type ListProjectsInput = z.input<typeof ListProjectsInputSchema>;
export type GetProjectDetailOutput = z.infer<typeof GetProjectDetailOutputSchema>;
export type CreateProjectInput = z.infer<typeof CreateProjectInputSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectInputSchema>;
export type CreateResourceInput = z.infer<typeof CreateResourceInputSchema>;
export type UpdateResourceInput = z.infer<typeof UpdateResourceInputSchema>;
export type ContinueResourceInput = z.infer<typeof ContinueResourceInputSchema>;
export type ContinueResourceOutput = z.infer<typeof ContinueResourceOutputSchema>;
export type SaveStudyLogInput = z.infer<typeof SaveStudyLogInputSchema>;
export type SaveStudyLogOutput = z.infer<typeof SaveStudyLogOutputSchema>;
export type GetEnumsOutput = {
  project_status: { value: z.infer<typeof ProjectStatusSchema>; plain_label: string; themed_label: string }[];
  resource_status: { value: z.infer<typeof ResourceStatusSchema>; plain_label: string; themed_label: string }[];
  resource_type: { value: z.infer<typeof ResourceTypeSchema>; label: string }[];
  open_kind: { value: z.infer<typeof OpenKindSchema>; label: string }[];
};

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

function pageOf<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    total: z.number().int().min(0),
    limit: z.number().int().min(1),
    offset: z.number().int().min(0),
  });
}
