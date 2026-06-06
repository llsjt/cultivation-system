// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { GetHomeOverviewOutput, GetProjectDetailOutput, IpcResult, ResourceSummary } from '../../../shared/dto';
import type { CultivationAPI } from '../../../shared/types/api';
import { GlobalLibrary } from './GlobalLibrary';

const now = '2026-01-01T00:00:00.000Z';

const ok = <T,>(data: T): IpcResult<T> => ({ ok: true, data });

const projects = [
  {
    id: 'project-front',
    name: '前端修炼',
    status: 'learning',
    progress_percent: 40,
    resource_count: 1,
    realm_rank: 0,
    realm_layer: 2,
    realm_name: '炼气',
    last_studied_at: null,
    updated_at: now,
    created_at: now,
  },
  {
    id: 'project-algo',
    name: '算法修炼',
    status: 'learning',
    progress_percent: 20,
    resource_count: 2,
    realm_rank: 0,
    realm_layer: 1,
    realm_name: '炼气',
    last_studied_at: null,
    updated_at: now,
    created_at: now,
  },
] satisfies GetHomeOverviewOutput['projects'];

function resource(overrides: Partial<ResourceSummary> & Pick<ResourceSummary, 'id' | 'project_id' | 'title'>): ResourceSummary {
  return {
    id: overrides.id,
    project_id: overrides.project_id,
    title: overrides.title,
    type: overrides.type ?? 'document',
    open_kind: overrides.open_kind ?? 'record_only',
    cultivation_role: overrides.cultivation_role ?? 'core',
    mastery_group: overrides.mastery_group ?? null,
    mastery_weight: overrides.mastery_weight ?? 3,
    status: overrides.status ?? 'learning',
    progress_text: overrides.progress_text ?? null,
    progress_percent: overrides.progress_percent ?? 10,
    next_action: overrides.next_action ?? null,
    last_opened_at: overrides.last_opened_at ?? null,
    last_studied_at: overrides.last_studied_at ?? null,
    updated_at: overrides.updated_at ?? now,
    created_at: overrides.created_at ?? now,
  };
}

const frontResource = resource({
  id: 'resource-react',
  project_id: 'project-front',
  title: 'React Hooks',
  type: 'document',
  status: 'review',
});
const algoExercise = resource({
  id: 'resource-dp',
  project_id: 'project-algo',
  title: 'DP Practice',
  type: 'exercise',
  status: 'learning',
});
const algoBook = resource({
  id: 'resource-graph',
  project_id: 'project-algo',
  title: 'Graph Notes',
  type: 'book',
  status: 'completed',
});

const overview = {
  recommended: null,
  recommended_project_name: null,
  recommended_project_progress: null,
  pending: null,
  projects,
  recent_logs: [],
  last_saved_at: now,
} satisfies GetHomeOverviewOutput;

const details: Record<string, GetProjectDetailOutput> = {
  'project-front': {
    project: projects[0],
    resources: { items: [frontResource], total: 1, limit: 100, offset: 0 },
    recent_logs: [],
  },
  'project-algo': {
    project: projects[1],
    resources: { items: [algoExercise, algoBook], total: 2, limit: 100, offset: 0 },
    recent_logs: [],
  },
};

function renderLibrary(overrides: Partial<ComponentProps<typeof GlobalLibrary>> = {}) {
  const api = {
    get_project_detail: vi.fn((projectId: string) => Promise.resolve(ok(details[projectId]))),
  } satisfies Partial<CultivationAPI>;
  Object.defineProperty(window, 'api', { configurable: true, value: api });

  const props = {
    overview,
    onContinueResource: vi.fn(),
    onOpenLog: vi.fn(),
    busy: false,
    ...overrides,
  } satisfies ComponentProps<typeof GlobalLibrary>;

  render(<GlobalLibrary {...props} />);

  return { api, props };
}

describe('GlobalLibrary', () => {
  afterEach(() => cleanup());

  it('searches by title and project name, combines filters, and clears filters', async () => {
    renderLibrary();

    expect(await screen.findByText('React Hooks')).toBeInTheDocument();
    expect(screen.getByText('DP Practice')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('搜索秘卷名、所属法门...'), { target: { value: '算法' } });
    expect(screen.queryByText('React Hooks')).not.toBeInTheDocument();
    expect(screen.getByText('DP Practice')).toBeInTheDocument();
    expect(screen.getByText('Graph Notes')).toBeInTheDocument();

    const filters = screen.getAllByRole('combobox');
    fireEvent.change(filters[0], { target: { value: 'project-algo' } });
    fireEvent.change(filters[1], { target: { value: 'exercise' } });
    fireEvent.change(filters[2], { target: { value: 'learning' } });
    expect(screen.getByText('DP Practice')).toBeInTheDocument();
    expect(screen.queryByText('Graph Notes')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '清除筛选' }));
    await waitFor(() => expect(screen.getByText('React Hooks')).toBeInTheDocument());
    expect(screen.getByText('DP Practice')).toBeInTheDocument();
    expect(screen.getByText('Graph Notes')).toBeInTheDocument();
  });

  it('runs continue and manual log actions with the filtered row resource', async () => {
    const onContinueResource = vi.fn();
    const onOpenLog = vi.fn();
    renderLibrary({ onContinueResource, onOpenLog });

    expect(await screen.findByText('DP Practice')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '继续学习 DP Practice' }));
    fireEvent.click(screen.getByRole('button', { name: '记录进度 DP Practice' }));

    await waitFor(() => expect(onContinueResource).toHaveBeenCalledWith(algoExercise));
    expect(onOpenLog).toHaveBeenCalledWith(algoExercise, 'manual');
  });
});
