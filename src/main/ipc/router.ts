import { BrowserWindow, app, dialog, ipcMain } from 'electron';
import { ZodError, type ZodTypeAny, type z } from 'zod';

import {
  AbandonPendingSessionInputSchema,
  AttemptBreakthroughInputSchema,
  ClosePendingSessionInputSchema,
  ContinueResourceInputSchema,
  CreateProjectInputSchema,
  CreateResourceInputSchema,
  DeleteProjectInputSchema,
  DeleteResourceInputSchema,
  GetEnumsInputSchema,
  GetGlobalResourcesInputSchema,
  GetGlobalResourcesOutputSchema,
  GetHomeOverviewInputSchema,
  GetHomeOverviewOutputSchema,
  GetProjectCultivationOutputSchema,
  GetProjectCultivationInputSchema,
  GetPendingSessionInputSchema,
  GetProjectDetailInputSchema,
  GetProjectDetailOutputSchema,
  GetResourceDetailInputSchema,
  ListProjectsInputSchema,
  SaveStudyLogInputSchema,
  SaveStudyLogOutputSchema,
  SelectLocalFileInputSchema,
  SelectLocalFileOutputSchema,
  UpdateProjectInputSchema,
  UpdateResourceInputSchema,
  type IpcResult,
} from '../../shared/dto';
import { enumLabels } from '../../shared/enums';
import { AppError, toAppErrorPayload } from '../../shared/errors';
import { logger } from '../logger';
import type { CultivationService } from '../services/cultivationService';

type Handler<TInput, TOutput> = (input: TInput) => Promise<TOutput> | TOutput;

export function registerIpcHandlers(service: CultivationService): void {
  register('get_home_overview', GetHomeOverviewInputSchema, () => service.getHomeOverview(), GetHomeOverviewOutputSchema);
  register('get_global_resources', GetGlobalResourcesInputSchema, () => service.getGlobalResources(), GetGlobalResourcesOutputSchema);
  register('list_projects', ListProjectsInputSchema, (input) => service.listProjects(input));
  register('get_project_detail', GetProjectDetailInputSchema, (input) => service.getProjectDetail(input), GetProjectDetailOutputSchema);
  register('get_project_cultivation', GetProjectCultivationInputSchema, (input) => service.getProjectCultivation(input.project_id), GetProjectCultivationOutputSchema);
  register('attempt_breakthrough', AttemptBreakthroughInputSchema, (input) => service.attemptBreakthrough(input.project_id));
  register('create_project', CreateProjectInputSchema, (input) => service.createProject(input));
  register('update_project', UpdateProjectInputSchema, (input) => service.updateProject(input));
  register('delete_project', DeleteProjectInputSchema, (input) => service.deleteProject(input.project_id));
  register('create_resource', CreateResourceInputSchema, (input) => service.createResource(input));
  register('update_resource', UpdateResourceInputSchema, (input) => service.updateResource(input));
  register('delete_resource', DeleteResourceInputSchema, (input) => service.deleteResource(input.resource_id));
  register('get_resource_detail', GetResourceDetailInputSchema, (input) => service.getResourceDetail(input.resource_id));
  register('continue_resource', ContinueResourceInputSchema, (input) => service.continueResource(input));
  register('save_study_log', SaveStudyLogInputSchema, (input) => service.saveStudyLog(input), SaveStudyLogOutputSchema);
  register('get_pending_session', GetPendingSessionInputSchema, () => service.getPendingSession());
  register('abandon_pending_session', AbandonPendingSessionInputSchema, (input) => service.abandonPendingSession(input.session_id));
  register('close_pending_session', ClosePendingSessionInputSchema, (input) => service.closePendingSession(input));
  register('get_enums', GetEnumsInputSchema, () => enumLabels);
  register(
    'select_local_file',
    SelectLocalFileInputSchema,
    async (input) => {
      const properties = input.properties ?? ['openFile'];
      const focusedWindow = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
      const result = await dialog.showOpenDialog(focusedWindow, {
        properties,
        title: properties.includes('openDirectory') ? '选择本地修炼目录/文件夹' : '选择本地修炼秘卷文件',
      });
      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }

      return result.filePaths[0] ?? null;
    },
    SelectLocalFileOutputSchema,
  );
}

function register<TInputSchema extends ZodTypeAny, TOutputSchema extends ZodTypeAny>(
  command: string,
  schema: TInputSchema,
  handler: Handler<z.infer<TInputSchema>, z.infer<TOutputSchema>>,
  outputSchema: TOutputSchema,
): void;
function register<TInputSchema extends ZodTypeAny, TOutput>(command: string, schema: TInputSchema, handler: Handler<z.infer<TInputSchema>, TOutput>): void;
function register(command: string, schema: ZodTypeAny, handler: Handler<unknown, unknown>, outputSchema?: ZodTypeAny): void {
  ipcMain.handle(`cmd:${command}`, async (_event, input): Promise<IpcResult<unknown>> => {
    try {
      const parsedInput = await schema.parseAsync(input);
      const data = await handler(parsedInput);
      const parsedOutput = await parseOutput(command, data, outputSchema);
      return { ok: true, data: parsedOutput };
    } catch (error) {
      if (error instanceof ZodError) {
        return {
          ok: false,
          error: new AppError({
            code: 'VALIDATION_FAILED',
            details: { fields: error.issues.map((issue) => issue.path.join('.')).filter(Boolean) },
          }).toPayload(),
        };
      }

      return { ok: false, error: toAppErrorPayload(error) };
    }
  });
}

async function parseOutput(command: string, data: unknown, outputSchema?: ZodTypeAny): Promise<unknown> {
  if (!outputSchema) {
    return data;
  }

  const parsed = await outputSchema.safeParseAsync(data);
  if (parsed.success) {
    return parsed.data;
  }

  if (shouldBlockOutputContractFailure()) {
    throw new AppError({
      code: 'IPC_CONTRACT_FAILED',
      details: { command, fields: parsed.error.issues.map((issue) => issue.path.join('.')).filter(Boolean) },
    });
  }

  logger.warn({ command, issues: parsed.error.issues, data_summary: summarizeData(data) }, 'ipc output contract failed');
  return data;
}

function shouldBlockOutputContractFailure(): boolean {
  return process.env.NODE_ENV === 'test' || !app.isPackaged;
}

function summarizeData(data: unknown): Record<string, unknown> {
  if (Array.isArray(data)) {
    return { type: 'array', length: data.length };
  }

  if (!data || typeof data !== 'object') {
    return { type: data === null ? 'null' : typeof data };
  }

  const fields = Object.entries(data)
    .filter(([key]) => !isSensitiveFieldName(key))
    .map(([key, value]) => [key, summarizeValue(value)] as const);

  return {
    type: 'object',
    keys: fields.map(([key]) => key),
    fields: Object.fromEntries(fields),
  };
}

function summarizeValue(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) {
    return { type: 'array', length: value.length };
  }

  return { type: value === null ? 'null' : typeof value };
}

function isSensitiveFieldName(key: string): boolean {
  return ['path', 'url', 'path_or_url'].includes(key);
}
