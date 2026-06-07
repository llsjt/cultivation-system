// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { GetEnumsOutput, GetHomeOverviewOutput, GetProjectDetailOutput, IpcResult, ResourceDetail, ResourceSummary } from '../../../../src/shared/dto';
import type { CultivationAPI } from '../../../../src/shared/types/api';
import { ResourceManagementPanel } from '../../../../src/renderer/features/resources/ResourceManagementPanel';

const now = '2026-01-01T00:00:00.000Z';

const ok = <T,>(data: T): IpcResult<T> => ({ ok: true, data });

const project = {
  id: 'project-1',
  name: '前端修炼',
  status: 'learning',
  progress_percent: 35,
  resource_count: 3,
  realm_rank: 0,
  realm_layer: 2,
  realm_name: '炼气',
  last_studied_at: null,
  updated_at: now,
  created_at: now,
} satisfies GetHomeOverviewOutput['projects'][number];

function resource(overrides: Partial<ResourceSummary> & Pick<ResourceSummary, 'id' | 'title'>): ResourceSummary {
  return {
    id: overrides.id,
    project_id: project.id,
    title: overrides.title,
    type: overrides.type ?? 'document',
    open_kind: overrides.open_kind ?? 'record_only',
    cultivation_role: overrides.cultivation_role ?? 'core',
    mastery_group: overrides.mastery_group ?? null,
    mastery_weight: overrides.mastery_weight ?? 3,
    status: overrides.status ?? 'learning',
    progress_text: overrides.progress_text ?? null,
    progress_percent: overrides.progress_percent ?? 20,
    next_action: overrides.next_action ?? null,
    last_opened_at: overrides.last_opened_at ?? null,
    last_studied_at: overrides.last_studied_at ?? null,
    updated_at: overrides.updated_at ?? now,
    created_at: overrides.created_at ?? now,
  };
}

const resources = [
  resource({
    id: 'resource-alpha',
    title: 'Alpha Guide',
    type: 'document',
    cultivation_role: 'core',
    progress_percent: 40,
    status: 'learning',
    next_action: '读完状态管理章节',
  }),
  resource({
    id: 'resource-beta',
    title: 'Beta Practice',
    type: 'exercise',
    cultivation_role: 'trial',
    progress_percent: 70,
    status: 'review',
  }),
  resource({
    id: 'resource-gamma',
    title: 'Gamma Archive',
    type: 'book',
    cultivation_role: 'reference',
    progress_percent: 100,
    status: 'completed',
  }),
] satisfies ResourceSummary[];

const projectDetail = {
  project,
  resources: { items: resources, total: resources.length, limit: 100, offset: 0 },
  recent_logs: [],
} satisfies GetProjectDetailOutput;

const enums = {
  resource_type: [
    { value: 'document', label: '文档' },
    { value: 'exercise', label: '练习' },
  ],
  open_kind: [{ value: 'record_only', label: '仅记录' }],
  cultivation_role: [
    { value: 'core', label: '核心功法' },
    { value: 'trial', label: '突破试炼' },
    { value: 'reference', label: '参考资料' },
  ],
} satisfies Pick<GetEnumsOutput, 'resource_type' | 'open_kind' | 'cultivation_role'>;

function detailFor(summary: ResourceSummary): ResourceDetail {
  return {
    ...summary,
    path_or_url_display: null,
    path_or_url_raw: null,
    recent_logs: [],
  };
}

function renderPanel(overrides: Partial<ComponentProps<typeof ResourceManagementPanel>> = {}) {
  const api = {
    get_resource_detail: vi.fn((resourceId: string) => {
      const summary = resources.find((item) => item.id === resourceId);
      return Promise.resolve(ok(detailFor(summary ?? resources[0])));
    }),
  } satisfies Partial<CultivationAPI>;
  Object.defineProperty(window, 'api', { configurable: true, value: api });

  const props = {
    selectedProject: project,
    projectDetail,
    resourceTitle: '',
    resourceType: 'document',
    cultivationRole: 'core',
    masteryGroup: '',
    masteryWeight: '3',
    openKind: 'record_only',
    pathOrUrl: '',
    initialProgress: '0',
    initialNextAction: '',
    resourceTypes: enums.resource_type,
    cultivationRoles: enums.cultivation_role,
    openKinds: enums.open_kind,
    busy: false,
    onResourceTitleChange: vi.fn(),
    onResourceTypeChange: vi.fn(),
    onCultivationRoleChange: vi.fn(),
    onMasteryGroupChange: vi.fn(),
    onMasteryWeightChange: vi.fn(),
    onOpenKindChange: vi.fn(),
    onPathOrUrlChange: vi.fn(),
    onInitialProgressChange: vi.fn(),
    onInitialNextActionChange: vi.fn(),
    onSubmitResource: vi.fn(),
    onPickPath: vi.fn(),
    onEditProject: vi.fn(),
    onDeleteProject: vi.fn(),
    onContinueResource: vi.fn(),
    onOpenLog: vi.fn(),
    onShowResourceDetail: vi.fn(),
    onStartEditResource: vi.fn(),
    onDeleteResource: vi.fn(),
    ...overrides,
  } satisfies ComponentProps<typeof ResourceManagementPanel>;

  render(<ResourceManagementPanel {...props} />);

  return { api, props };
}

describe('ResourceManagementPanel', () => {
  afterEach(() => cleanup());

  it('filters the current project list by search text and status', () => {
    renderPanel();
    const list = screen.getByLabelText('当前方向资料列表');

    fireEvent.change(screen.getByLabelText('搜索当前方向资料'), { target: { value: 'Beta' } });
    expect(within(list).getByText('Beta Practice')).toBeInTheDocument();
    expect(within(list).queryByText('Gamma Archive')).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'completed' } });
    expect(within(list).getByText('暂无匹配秘卷')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('搜索当前方向资料'), { target: { value: '' } });
    expect(within(list).getByText('Gamma Archive')).toBeInTheDocument();
    expect(within(list).queryByText('Alpha Guide')).not.toBeInTheDocument();
  });

  it('keeps the selected detail stable when the list play button is used', async () => {
    const onContinueResource = vi.fn();
    renderPanel({ onContinueResource });

    expect(screen.getByRole('heading', { name: 'Alpha Guide' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '继续学习 Beta Practice' }));

    await waitFor(() => expect(onContinueResource).toHaveBeenCalledWith(resources[1]));
    expect(screen.getByRole('heading', { name: 'Alpha Guide' })).toBeInTheDocument();
  });

  it('runs detail continue and manual log actions for the selected resource', async () => {
    const onContinueResource = vi.fn();
    const onOpenLog = vi.fn();
    renderPanel({ onContinueResource, onOpenLog });

    fireEvent.click(screen.getByRole('button', { name: 'Beta Practice 练习突破试炼70%' }));
    expect(screen.getByRole('heading', { name: 'Beta Practice' })).toBeInTheDocument();

    const continueButtons = screen.getAllByRole('button', { name: '继续学习 Beta Practice' });
    fireEvent.click(continueButtons[continueButtons.length - 1]);
    fireEvent.click(screen.getByRole('button', { name: '记录进度 Beta Practice' }));

    await waitFor(() => expect(onContinueResource).toHaveBeenCalledWith(resources[1]));
    expect(onOpenLog).toHaveBeenCalledWith(resources[1], 'manual');
  });
});
