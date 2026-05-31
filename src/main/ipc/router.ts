import { ipcMain, dialog, BrowserWindow } from 'electron';
import { ZodError, type ZodTypeAny } from 'zod';

import {
  AbandonPendingSessionInputSchema,
  ClosePendingSessionInputSchema,
  ContinueResourceInputSchema,
  CreateProjectInputSchema,
  CreateResourceInputSchema,
  DeleteProjectInputSchema,
  DeleteResourceInputSchema,
  GetHomeOverviewInputSchema,
  GetProjectCultivationInputSchema,
  GetPendingSessionInputSchema,
  GetProjectDetailInputSchema,
  GetResourceDetailInputSchema,
  AttemptBreakthroughInputSchema,
  GetEnumsInputSchema,
  ListProjectsInputSchema,
  SaveStudyLogInputSchema,
  UpdateProjectInputSchema,
  UpdateResourceInputSchema,
  type IpcResult,
} from '../../shared/dto';
import { enumLabels } from '../../shared/enums';
import { AppError, toAppErrorPayload } from '../../shared/errors';
import type { CultivationService } from '../services/cultivationService';

type Handler = (input: unknown) => Promise<unknown> | unknown;

export function registerIpcHandlers(service: CultivationService): void {
  register('get_home_overview', GetHomeOverviewInputSchema, () => service.getHomeOverview());
  register('list_projects', ListProjectsInputSchema, (input) => service.listProjects(input as { limit?: number; offset?: number }));
  register('get_project_detail', GetProjectDetailInputSchema, (input) => service.getProjectDetail(input as { project_id: string; limit?: number; offset?: number }));
  register('get_project_cultivation', GetProjectCultivationInputSchema, (input) => service.getProjectCultivation((input as { project_id: string }).project_id));
  register('attempt_breakthrough', AttemptBreakthroughInputSchema, (input) => service.attemptBreakthrough((input as { project_id: string }).project_id));
  register('create_project', CreateProjectInputSchema, (input) => service.createProject(input as never));
  register('update_project', UpdateProjectInputSchema, (input) => service.updateProject(input as never));
  register('delete_project', DeleteProjectInputSchema, (input) => service.deleteProject((input as { project_id: string }).project_id));
  register('create_resource', CreateResourceInputSchema, (input) => service.createResource(input as never));
  register('update_resource', UpdateResourceInputSchema, (input) => service.updateResource(input as never));
  register('delete_resource', DeleteResourceInputSchema, (input) => service.deleteResource((input as { resource_id: string }).resource_id));
  register('get_resource_detail', GetResourceDetailInputSchema, (input) => service.getResourceDetail((input as { resource_id: string }).resource_id));
  register('continue_resource', ContinueResourceInputSchema, (input) => service.continueResource(input as never));
  register('save_study_log', SaveStudyLogInputSchema, (input) => service.saveStudyLog(input as never));
  register('get_pending_session', GetPendingSessionInputSchema, () => service.getPendingSession());
  register('abandon_pending_session', AbandonPendingSessionInputSchema, (input) => service.abandonPendingSession((input as { session_id: string }).session_id));
  register('close_pending_session', ClosePendingSessionInputSchema, (input) => service.closePendingSession(input as { session_id: string; close_source: 'viewer_closed' | 'user_ended' | 'app_recovered' }));
  register('get_enums', GetEnumsInputSchema, () => enumLabels);

  ipcMain.handle('cmd:select_local_file', async (_event, input): Promise<IpcResult<string | null>> => {
    try {
      const parsedInput = (input as { properties?: Array<'openFile' | 'openDirectory'> }) ?? {};
      const focusedWindow = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
      const result = await dialog.showOpenDialog(focusedWindow, {
        properties: parsedInput.properties ?? ['openFile'],
        title: parsedInput.properties?.includes('openDirectory') ? '选择本地修炼目录/文件夹' : '选择本地修炼秘卷文件',
      });
      if (result.canceled || result.filePaths.length === 0) {
        return { ok: true, data: null };
      }
      return { ok: true, data: result.filePaths[0] };
    } catch (error) {
      return { ok: false, error: toAppErrorPayload(error) };
    }
  });
}

function register(command: string, schema: ZodTypeAny, handler: Handler): void {
  ipcMain.handle(`cmd:${command}`, async (_event, input): Promise<IpcResult<unknown>> => {
    try {
      const parsedInput = await schema.parseAsync(input);
      const data = await handler(parsedInput);
      return { ok: true, data };
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
