// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import fc from 'fast-check';
import { describe, expect, it, vi } from 'vitest';

import type { GetEnumsOutput, GetHomeOverviewOutput, GetProjectCultivationOutput, GetProjectDetailOutput, IpcResult } from '../shared/dto';
import type { CultivationAPI } from '../shared/types/api';
import { normalizeProgressPercent } from '../shared/progress';
import { App, ProgressBar } from './App';

const ok = <T,>(data: T): IpcResult<T> => ({ ok: true, data });

const now = '2026-01-01T00:00:00.000Z';

const project = {
  id: 'project-1',
  name: '测试法门',
  status: 'learning',
  progress_percent: 0,
  resource_count: 0,
  realm_rank: 0,
  realm_layer: 1,
  realm_name: '炼气',
  last_studied_at: null,
  updated_at: now,
  created_at: now,
} satisfies GetHomeOverviewOutput['projects'][number];

const overview = {
  recommended: null,
  recommended_project_name: null,
  recommended_project_progress: null,
  pending: null,
  projects: [project],
  recent_logs: [],
  last_saved_at: now,
} satisfies GetHomeOverviewOutput;

const projectDetail = {
  project,
  resources: { items: [], total: 0, limit: 100, offset: 0 },
  recent_logs: [],
} satisfies GetProjectDetailOutput;

const cultivation = {
  project_id: project.id,
  realm_rank: 0,
  realm_name: '炼气',
  realm_layer: 1,
  next_realm_name: '筑基',
  dao_foundation_score: 0,
  can_breakthrough: false,
  metrics: {
    core_mastery: 0,
    trial_mastery: 0,
    reflection_score: 0,
    stability_score: 0,
  },
  core_resource_count: 0,
  trial_resource_count: 0,
  recent_log_count: 0,
  effective_study_minutes_14d: 0,
  effective_study_minutes_target: 120,
  effective_study_minutes_remaining: 120,
  effective_study_days_14d: 0,
  missing_duration_log_count: 0,
  capped_duration_log_count: 0,
  diagnostic_warnings: ['近 14 天有效学习时间不足，还差 120 分钟。'],
  bottlenecks: ['继续积累修炼记录'],
} satisfies GetProjectCultivationOutput;

const enums = {
  project_status: [{ value: 'learning', plain_label: '学习中', themed_label: '闭关淬炼' }],
  resource_status: [{ value: 'learning', plain_label: '学习中', themed_label: '闭关淬炼' }],
  resource_type: [{ value: 'document', label: '文档' }],
  open_kind: [{ value: 'record_only', label: '仅记录' }],
  cultivation_role: [{ value: 'core', label: '核心功法' }],
  study_evidence_type: [{ value: 'read', label: '阅读理解' }],
} satisfies GetEnumsOutput;

function mockApi(): CultivationAPI {
  return {
    get_home_overview: vi.fn(() => Promise.resolve(ok(overview))),
    list_projects: vi.fn(() => Promise.resolve(ok({ items: [project], total: 1, limit: 50, offset: 0 }))),
    get_project_detail: vi.fn(() => Promise.resolve(ok(projectDetail))),
    get_project_cultivation: vi.fn(() => Promise.resolve(ok(cultivation))),
    attempt_breakthrough: vi.fn(),
    create_project: vi.fn(),
    update_project: vi.fn(),
    delete_project: vi.fn(),
    create_resource: vi.fn(),
    update_resource: vi.fn(),
    delete_resource: vi.fn(),
    get_resource_detail: vi.fn(),
    continue_resource: vi.fn(),
    save_study_log: vi.fn(),
    get_pending_session: vi.fn(() => Promise.resolve(ok(null))),
    abandon_pending_session: vi.fn(),
    close_pending_session: vi.fn(),
    on_pending_session_closed: vi.fn(() => () => undefined),
    get_enums: vi.fn(() => Promise.resolve(ok(enums))),
    select_local_file: vi.fn(() => Promise.resolve(ok(null))),
  };
}

describe('ProgressBar', () => {
  it('renders width, text, and aria from the normalized value', () => {
    // Feature: black-myth-ui-theme, Property 5: ProgressBar render output is consistent with normalized progress.
    fc.assert(
      fc.property(fc.double(), (value) => {
        const normalized = normalizeProgressPercent(value);
        const { container, unmount } = render(<ProgressBar value={value} />);
        const progressbar = screen.getByRole('progressbar');
        const fill = container.querySelector('.progress-wrap span');

        expect(progressbar).toHaveAttribute('aria-valuenow', String(normalized));
        expect(progressbar).toHaveTextContent(`${normalized}%`);
        expect(fill).toHaveStyle({ width: `${normalized}%` });
        unmount();
      }),
      { numRuns: 100 },
    );
  });
});

describe('App', () => {
  it('renders the loaded shell after the initial overview request resolves', async () => {
    const api = mockApi();
    Object.defineProperty(window, 'api', { configurable: true, value: api });

    const { unmount } = render(<App />);

    expect(screen.getByText('正在读取本地记录...')).toBeInTheDocument();
    expect(await screen.findByText('修仙参悟系统')).toBeInTheDocument();
    await waitFor(() => expect(api.get_project_detail).toHaveBeenCalledWith(project.id));

    unmount();
  });
});
