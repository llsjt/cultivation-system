import { BarChart3, BookOpen, Home, Library, Play, RefreshCcw, Sparkles, type LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from 'react';

import type {
  GetEnumsOutput,
  GetHomeOverviewOutput,
  GetProjectCultivationOutput,
  GetProjectDetailOutput,
  PendingSessionView,
  ResourceDetail,
  ResourceSummary,
  SaveStudyLogOutput,
} from '../shared/dto';
import type { CultivationRole, OpenKind, ResourceStatus, ResourceType } from '../shared/enums';
import { ConfirmDialog } from './components/ConfirmDialog';
import { ProgressBar } from './components/ProgressBar';
import { ProjectEditModal } from './features/projects/ProjectEditModal';
import { ProjectSidebar } from './features/projects/ProjectSidebar';
import { ProjectStatsPanel } from './features/projects/ProjectStatsPanel';
import { ResourceDetailModal } from './features/resources/ResourceDetailModal';
import { ResourceEditModal } from './features/resources/ResourceEditModal';
import { ResourceManagementPanel } from './features/resources/ResourceManagementPanel';
import { PendingConflictModal } from './features/studyLogs/PendingConflictModal';
import { PendingStrip } from './features/studyLogs/PendingStrip';
import { StudyLogModal } from './features/studyLogs/StudyLogModal';
import { GlobalLibrary } from './features/resources/GlobalLibrary';
import { AnalyticsDashboard } from './features/projects/AnalyticsDashboard';
import { ToastStack } from './components/ToastStack';
import { BreakthroughOverlay } from './components/BreakthroughOverlay';
import { run, showError } from './lib/actionRunner';
import { feedbackMessage } from './lib/feedback';
import { unwrap, unwrapResult } from './lib/ipc';
import type { ConfirmRequest, LogDraft, ProjectEditDraft, ResourceEditDraft, Toast, ToastInput } from './types';

export { ProgressBar } from './components/ProgressBar';

type ParticleStyle = CSSProperties & {
  '--drift-x': string;
};

type AppTab = 'meditation' | 'library' | 'analytics' | 'spirit';

const appTabs: { id: AppTab; label: string; Icon: LucideIcon }[] = [
  { id: 'meditation', label: '当前学习', Icon: Home },
  { id: 'library', label: '全部资料', Icon: Library },
  { id: 'analytics', label: '学习统计', Icon: BarChart3 },
  { id: 'spirit', label: '修行状态', Icon: Sparkles },
];

function stableUnit(index: number, salt: number): number {
  const value = Math.sin((index + 1) * (salt + 19.19)) * 10000;
  return value - Math.floor(value);
}

export function App() {
  const [overview, setOverview] = useState<GetHomeOverviewOutput | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>('meditation');
  const [enums, setEnums] = useState<GetEnumsOutput | null>(null);
  const [projectDetail, setProjectDetail] = useState<GetProjectDetailOutput | null>(null);
  const [projectCultivation, setProjectCultivation] = useState<GetProjectCultivationOutput | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceType, setResourceType] = useState<ResourceType>('document');
  const [cultivationRole, setCultivationRole] = useState<CultivationRole>('core');
  const [masteryGroup, setMasteryGroup] = useState('');
  const [masteryWeight, setMasteryWeight] = useState('1');
  const [openKind, setOpenKind] = useState<OpenKind>('record_only');
  const [pathOrUrl, setPathOrUrl] = useState('');
  const [initialProgress, setInitialProgress] = useState('0');
  const [initialNextAction, setInitialNextAction] = useState('');
  const [logDraft, setLogDraft] = useState<LogDraft | null>(null);
  const [resourceEdit, setResourceEdit] = useState<ResourceEditDraft | null>(null);
  const [projectEdit, setProjectEdit] = useState<ProjectEditDraft | null>(null);
  const [resourceDetail, setResourceDetail] = useState<ResourceDetail | null>(null);
  const [pendingConflict, setPendingConflict] = useState<PendingSessionView | null>(null);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [busy, setBusy] = useState(false);
  const [animPaused, setAnimPaused] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [breakthroughData, setBreakthroughData] = useState<{ resourceTitle: string; stageName: string } | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const anyModalOpenRef = useRef(false);
  const busyRef = useRef(false);
  const autoOpenedPendingIdsRef = useRef<Set<string>>(new Set());

  const selectedProject = useMemo(
    () => overview?.projects.find((project) => project.id === selectedProjectId) ?? overview?.projects[0] ?? null,
    [overview, selectedProjectId],
  );

  const stageClass = useMemo(() => {
    if (!selectedProject) return 'theme-lianqi';
    if (selectedProject.realm_rank <= 0) return 'theme-lianqi';
    if (selectedProject.realm_rank === 1) return 'theme-zhuji';
    if (selectedProject.realm_rank === 2) return 'theme-jindan';
    if (selectedProject.realm_rank === 3) return 'theme-yuanying';
    return 'theme-huashen';
  }, [selectedProject]);

  const stageName = useMemo(() => {
    if (!selectedProject) return '未入门';
    const layer = projectCultivation?.realm_layer ?? selectedProject.realm_layer;
    return `${selectedProject.realm_name}${layer}层`;
  }, [projectCultivation?.realm_layer, selectedProject]);

  const particles = useMemo(() => {
    const colorsMap: Record<AppTab, string[]> = {
      meditation: [
        'var(--accent-strong)',
        'rgba(98, 195, 158, 0.75)',  // Emerald Green
        'rgba(230, 185, 93, 0.75)',   // Pure Gold
        'rgba(177, 159, 251, 0.75)',  // Astral Purple
        'rgba(93, 164, 230, 0.75)',   // Celestial Blue
      ],
      library: [
        'rgba(230, 185, 93, 0.8)',    // Pure Gold
        'rgba(217, 143, 36, 0.75)',   // Amber
        'rgba(255, 231, 163, 0.9)',   // Soft Gold
        'rgba(166, 158, 141, 0.6)',   // Ink Sandalwood
      ],
      analytics: [
        'rgba(224, 245, 255, 0.85)',  // Star White
        'rgba(157, 232, 255, 0.75)',  // Nebula Cyan
        'rgba(116, 128, 255, 0.7)',   // Celestial Blue
        'rgba(215, 194, 255, 0.65)',  // Astral Violet
      ],
      spirit: [
        'rgba(215, 194, 255, 0.85)',  // Astral Violet
        'rgba(255, 180, 226, 0.8)',   // Glowing Pink
        'rgba(255, 211, 107, 0.75)',  // Divine Gold
        'rgba(155, 120, 241, 0.7)',   // Deep Purple
      ]
    };
    const colors = colorsMap[activeTab] ?? colorsMap.meditation;

    return Array.from({ length: 5 }).map((_, i) => ({
      id: i,
      left: `${stableUnit(i, 1) * 95}%`,
      delay: `${stableUnit(i, 2) * 8}s`,
      duration: `${6 + stableUnit(i, 3) * 6}s`,
      size: `${3 + stableUnit(i, 4) * 4}px`,
      driftX: `${-65 + stableUnit(i, 5) * 130}px`,
      color: colors[i % colors.length]
    }));
  }, [activeTab]);

  const resourceTypes = enums?.resource_type ?? [];
  const openKinds = enums?.open_kind ?? [];
  const resourceStatuses = enums?.resource_status ?? [];
  const cultivationRoles = enums?.cultivation_role ?? [];
  const evidenceTypes = enums?.study_evidence_type ?? [];
  const anyModalOpen = Boolean(logDraft || resourceEdit || projectEdit || resourceDetail || pendingConflict || confirmRequest);

  useEffect(() => {
    anyModalOpenRef.current = anyModalOpen;
  }, [anyModalOpen]);

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  // 窗口失焦或标签页不可见时暂停常驻装饰动画，桌面应用切到后台不必继续烧 GPU
  useEffect(() => {
    const updatePaused = () => {
      const paused = document.visibilityState === 'hidden' || !document.hasFocus();
      setAnimPaused(paused);
    };
    updatePaused();
    window.addEventListener('focus', updatePaused);
    window.addEventListener('blur', updatePaused);
    document.addEventListener('visibilitychange', updatePaused);
    return () => {
      window.removeEventListener('focus', updatePaused);
      window.removeEventListener('blur', updatePaused);
      document.removeEventListener('visibilitychange', updatePaused);
    };
  }, []);

  const showToast = useCallback((toast: ToastInput) => {
    setToasts((current) => [...current, { ...toast, id: globalThis.crypto.randomUUID() }]);
  }, []);

  useEffect(() => {
    const first = toasts[0];
    if (!first) {
      return;
    }

    const timeout = window.setTimeout(
      () => setToasts((current) => current.filter((toast) => toast.id !== first.id)),
      first.kind === 'error' ? 5000 : 3000,
    );
    return () => window.clearTimeout(timeout);
  }, [toasts]);

  useEffect(() => {
    if (!anyModalOpen) {
      return;
    }

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    };
  }, [anyModalOpen]);

  const loadProject = useCallback(async (projectId: string | null) => {
    if (!projectId) {
      setProjectDetail(null);
      setProjectCultivation(null);
      return;
    }
    const [detail, cultivation] = await Promise.all([
      window.api.get_project_detail(projectId).then(unwrapResult),
      window.api.get_project_cultivation(projectId).then(unwrapResult),
    ]);
    setProjectDetail(detail);
    setProjectCultivation(cultivation);
  }, []);

  const refresh = useCallback(async () => {
    const data = await unwrap(window.api.get_home_overview());
    setOverview(data);
    const nextProjectId = selectedProjectId ?? data.projects[0]?.id ?? null;
    setSelectedProjectId(nextProjectId);
    await loadProject(nextProjectId);
  }, [loadProject, selectedProjectId]);

  function askConfirm(input: Omit<ConfirmRequest, 'resolve'>): Promise<boolean> {
    return new Promise((resolve) => {
      setConfirmRequest({ ...input, resolve });
    });
  }

  function settleConfirm(confirmed: boolean) {
    confirmRequest?.resolve(confirmed);
    setConfirmRequest(null);
  }

  const focusTab = useCallback((tab: AppTab) => {
    setActiveTab(tab);
    window.requestAnimationFrame(() => {
      document.getElementById(`app-tab-${tab}`)?.focus();
    });
  }, []);

  const handleTabKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      const currentTab = event.currentTarget.dataset.tab as AppTab | undefined;
      const currentIndex = appTabs.findIndex((tab) => tab.id === currentTab);
      if (currentIndex === -1) {
        return;
      }

      let nextIndex: number;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        nextIndex = (currentIndex + 1) % appTabs.length;
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        nextIndex = (currentIndex - 1 + appTabs.length) % appTabs.length;
      } else if (event.key === 'Home') {
        nextIndex = 0;
      } else if (event.key === 'End') {
        nextIndex = appTabs.length - 1;
      } else {
        return;
      }

      event.preventDefault();
      focusTab(appTabs[nextIndex].id);
    },
    [focusTab],
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all([window.api.get_home_overview().then(unwrapResult), window.api.get_enums().then(unwrapResult)])
      .then(([data, enumData]) => {
        if (cancelled) {
          return;
        }
        setOverview(data);
        setEnums(enumData);
        setSelectedProjectId((current) => current ?? data.projects[0]?.id ?? null);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          showError(showToast, error);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  useEffect(() => {
    let cancelled = false;
    const projectId = selectedProject?.id ?? null;
    const detailPromise = projectId
      ? Promise.all([window.api.get_project_detail(projectId).then(unwrapResult), window.api.get_project_cultivation(projectId).then(unwrapResult)])
      : Promise.resolve([null, null] as const);
    detailPromise
      .then(([detail, cultivation]) => {
        if (!cancelled) {
          setProjectDetail(detail);
          setProjectCultivation(cultivation);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          showError(showToast, error);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedProject?.id, showToast]);

  async function submitProject(event: FormEvent) {
    event.preventDefault();
    await run(setBusy, showToast, async () => {
      const project = await unwrap(window.api.create_project({ name: projectName, description: projectDescription || null }));
      setProjectName('');
      setProjectDescription('');
      setSelectedProjectId(project.id);
      await refresh();
      showToast({ kind: 'success', message: '修炼方向已保存。' });
    });
  }

  async function submitResource(event: FormEvent) {
    event.preventDefault();
    if (!selectedProject) {
      showToast({ kind: 'error', message: '请先创建修炼方向。' });
      return;
    }

    await run(setBusy, showToast, async () => {
      await unwrap(
        window.api.create_resource({
          project_id: selectedProject.id,
          title: resourceTitle,
          type: resourceType,
          open_kind: openKind,
          path_or_url: openKind === 'record_only' ? null : pathOrUrl,
          cultivation_role: cultivationRole,
          mastery_group: masteryGroup || null,
          mastery_weight: Number(masteryWeight),
          initial_progress_percent: Number(initialProgress),
          initial_next_action: initialNextAction || null,
        }),
      );
      setResourceTitle('');
      setPathOrUrl('');
      setCultivationRole('core');
      setMasteryGroup('');
      setMasteryWeight('1');
      setInitialProgress('0');
      setInitialNextAction('');
      await refresh();
      showToast({ kind: 'success', message: '资料已加入。' });
    });
  }

  async function continueResource(resource: ResourceSummary) {
    await run(setBusy, showToast, async () => {
      const result = await unwrap(window.api.continue_resource({ resource_id: resource.id }));
      if (result.result === 'record_only') {
        openLog(resource, 'record_only');
        return;
      }
      if (result.result === 'opened' && result.pending) {
        showToast({ kind: 'success', message: '已打开资料。闭关结束后记一笔出关记录。' });
        await refresh();
        return;
      }
      if (result.result === 'pending_conflict' && result.conflict_existing) {
        showToast({ kind: 'error', message: '已有待出关记录，请先处理。' });
        setPendingConflict(result.conflict_existing);
        return;
      }
      if (result.result === 'blocked' && result.block_level === 'warn' && result.risk_confirm_token) {
        const confirmed = await askConfirm({
          title: '确认打开一次',
          message: result.block_reason ?? '该资源需要确认后才能打开。',
          confirmLabel: '打开一次',
        });
        if (!confirmed) {
          return;
        }
        const retry = await unwrap(window.api.continue_resource({ resource_id: resource.id, risk_confirm_token: result.risk_confirm_token }));
        if (retry.result === 'opened' && retry.pending) {
          showToast({ kind: 'success', message: '已打开资料。闭关结束后记一笔出关记录。' });
          await refresh();
          return;
        }
        if (retry.result === 'record_only') {
          openLog(resource, 'record_only');
          return;
        }
        throw new Error(retry.block_reason ?? retry.open_error_code ?? '打开失败。');
      }
      if (result.result === 'open_failed') {
        throw new Error(result.open_error_code ?? '打开失败。');
      }
      throw new Error(result.block_reason ?? '暂时无法打开。');
    });
  }

  const openPendingLog = useCallback(async (pending: PendingSessionView) => {
    let session = pending;
    if (!session.closed_at) {
      session = await unwrap(window.api.close_pending_session(pending.id, 'user_ended'));
    }

    const detail = await unwrap(window.api.get_resource_detail(session.resource_id));
    setPendingConflict(null);
    setLogDraft({
      resource: detail,
      source: 'pending',
      resource_updated_at_before: session.resource_updated_at_before,
      before_progress_percent: session.progress_before_percent,
      progress_text: detail.progress_text ?? '',
      progress_percent: String(detail.progress_percent),
      status: detail.status,
      statusChangedByUser: false,
      progressChangedByStatus: false,
      next_action: detail.next_action ?? '',
      duration_minutes: session.duration_minutes === null ? '' : String(session.duration_minutes),
      evidence_type: '',
      duration_hint:
        session.close_source === 'viewer_closed'
          ? '已根据资料窗口打开到关闭时间记录，可修改。'
          : '已根据打开资料到结束闭关时间记录，可修改。',
    });
  }, []);

  useEffect(() => {
    return window.api.on_pending_session_closed((pending) => {
      void (async () => {
        await refresh();
        if (busyRef.current || anyModalOpenRef.current || autoOpenedPendingIdsRef.current.has(pending.id)) {
          return;
        }
        autoOpenedPendingIdsRef.current.add(pending.id);
        await openPendingLog(pending);
      })().catch((error: unknown) => {
        showError(showToast, error);
      });
    });
  }, [openPendingLog, refresh, showToast]);

  async function pickPath(kind: 'file' | 'folder', isEdit: boolean) {
    await run(setBusy, showToast, async () => {
      const result = await window.api.select_local_file({
        properties: kind === 'file' ? ['openFile'] : ['openDirectory'],
      });
      if (result.ok && result.data) {
        if (isEdit) {
          setResourceEdit((current) => {
            if (!current) {
              return current;
            }
            const fileName = result.data!.split(/[\\/]/).pop() ?? '';
            return {
              ...current,
              path_or_url: result.data!,
              title: current.title === '' ? fileName : current.title,
            };
          });
        } else {
          setPathOrUrl(result.data);
          const fileName = result.data.split(/[\\/]/).pop() ?? '';
          setResourceTitle((current) => (current === '' ? fileName : current));
        }
        showToast({ kind: 'success', message: `已成功选择本地${kind === 'file' ? '文件' : '文件夹'}。` });
      }
    });
  }

  function openLog(resource: ResourceSummary, source: LogDraft['source']) {
    if (source !== 'pending' && overview?.pending?.resource_id === resource.id) {
      void openPendingLog(overview.pending);
      return;
    }

    setLogDraft({
      resource,
      source,
      resource_updated_at_before: resource.updated_at,
      before_progress_percent: resource.progress_percent,
      progress_text: resource.progress_text ?? '',
      progress_percent: String(resource.progress_percent),
      status: resource.status,
      statusChangedByUser: false,
      progressChangedByStatus: false,
      next_action: resource.next_action ?? '',
      duration_minutes: '',
      evidence_type: '',
    });
  }

  function changeLogStatus(status: ResourceStatus) {
    setLogDraft((current) => {
      if (!current) {
        return current;
      }

      const progressByStatus = status === 'completed' ? '100' : status === 'not_started' ? '0' : current.progress_percent;
      return {
        ...current,
        status,
        statusChangedByUser: true,
        progressChangedByStatus: status === 'completed' || status === 'not_started' ? true : current.progressChangedByStatus,
        progress_percent: progressByStatus,
      };
    });
  }

  async function submitProjectEdit(event: FormEvent) {
    event.preventDefault();
    if (!projectEdit) {
      return;
    }

    await run(setBusy, showToast, async () => {
      await unwrap(window.api.update_project(projectEdit.id, { name: projectEdit.name }));
      setProjectEdit(null);
      await refresh();
      showToast({ kind: 'success', message: '修炼方向已更新。' });
    });
  }

  async function startEditResource(resource: ResourceSummary) {
    await run(setBusy, showToast, async () => {
      const detail = await unwrap(window.api.get_resource_detail(resource.id));
      setResourceEdit({
        id: detail.id,
        title: detail.title,
        type: detail.type,
        open_kind: detail.open_kind,
        path_or_url: detail.path_or_url_raw ?? '',
        status: detail.status === 'learning' || detail.status === 'review' || detail.status === 'paused' ? detail.status : '',
        cultivation_role: detail.cultivation_role,
        mastery_group: detail.mastery_group ?? '',
        mastery_weight: String(detail.mastery_weight),
      });
    });
  }

  async function showResourceDetail(resource: ResourceSummary) {
    await run(setBusy, showToast, async () => {
      setResourceDetail(await unwrap(window.api.get_resource_detail(resource.id)));
    });
  }

  async function submitResourceEdit(event: FormEvent) {
    event.preventDefault();
    if (!resourceEdit) {
      return;
    }

    await run(setBusy, showToast, async () => {
      await unwrap(
        window.api.update_resource(resourceEdit.id, {
          title: resourceEdit.title,
          type: resourceEdit.type,
          open_kind: resourceEdit.open_kind,
          path_or_url: resourceEdit.open_kind === 'record_only' ? null : resourceEdit.path_or_url,
          cultivation_role: resourceEdit.cultivation_role,
          mastery_group: resourceEdit.mastery_group || null,
          mastery_weight: Number(resourceEdit.mastery_weight),
          ...(resourceEdit.status ? { status: resourceEdit.status } : {}),
        }),
      );
      setResourceEdit(null);
      await refresh();
      showToast({ kind: 'success', message: '资料已更新。' });
    });
  }

  async function submitLog(event: FormEvent) {
    event.preventDefault();
    if (!logDraft) {
      return;
    }

    await run(setBusy, showToast, async () => {
      const input = {
        resource_id: logDraft.resource.id,
        source: logDraft.source,
        progress_text: logDraft.progress_text,
        progress_percent: Number(logDraft.progress_percent),
        status: logDraft.status,
        next_action: logDraft.next_action || null,
        duration_minutes: logDraft.duration_minutes === '' ? null : Number(logDraft.duration_minutes),
        evidence_type: logDraft.evidence_type || null,
        resource_updated_at_before: logDraft.resource_updated_at_before,
      };
      if (input.progress_percent < logDraft.before_progress_percent) {
        const confirmed = await askConfirm({
          title: '确认进度回退',
          message: `本次参悟进度将从 ${logDraft.before_progress_percent}% 调整到 ${input.progress_percent}%。`,
          confirmLabel: '确认保存',
        });
        if (!confirmed) {
          return;
        }
      }

      let response = await window.api.save_study_log(input);
      if (!response.ok && response.error.details?.conflict === true) {
        const confirmed = await askConfirm({
          title: '资料已变化',
          message: '资料在打开记录后发生过变化。确认覆盖表示用当前弹窗里的进度、状态、证据和下一步保存。',
          confirmLabel: '确认覆盖',
        });
        if (confirmed) {
          response = await window.api.save_study_log({ ...input, confirm_overwrite: true });
        }
      }
      const result = unwrapResult<SaveStudyLogOutput>(response);
      setLogDraft(null);
      await refresh();
      showToast({ kind: 'success', message: feedbackMessage(result) });
    });
  }

  async function attemptBreakthrough() {
    if (!selectedProject) {
      return;
    }

    await run(setBusy, showToast, async () => {
      const result = await unwrap(window.api.attempt_breakthrough(selectedProject.id));
      await refresh();
      showToast({ kind: result.passed ? 'success' : 'error', message: result.message });
      if (result.passed) {
        setBreakthroughData({
          resourceTitle: selectedProject.name,
          stageName: `${result.project.realm_name}${result.project.realm_layer}层`,
        });
      }
    });
  }

  async function abandonPending(pending: PendingSessionView) {
    const confirmed = await askConfirm({
      title: '放弃待出关记录',
      message: '放弃后不会生成学习日志，也不会更新进度、下一步目标或最近出关时间。',
      confirmLabel: '放弃记录',
      danger: true,
    });
    if (!confirmed) {
      return;
    }
    await run(setBusy, showToast, async () => {
      await unwrap(window.api.abandon_pending_session(pending.id));
      setPendingConflict(null);
      await refresh();
      showToast({ kind: 'success', message: '已放弃本次待出关记录。' });
    });
  }

  async function deleteResource(resource: ResourceSummary) {
    const pending = overview?.pending?.resource_id === resource.id;
    const confirmed = await askConfirm({
      title: '删除资料',
      message: pending ? '该资料有待出关记录，删除会一并放弃。历史日志会保留资料标题快照。' : '删除后历史日志会保留资料标题快照。',
      confirmLabel: '继续删除',
      danger: true,
    });
    const doubleConfirmed =
      confirmed &&
      (await askConfirm({
        title: '再次确认删除资料',
        message: `即将删除“${resource.title}”。`,
        confirmLabel: '确认删除',
        danger: true,
      }));
    if (!doubleConfirmed) {
      return;
    }
    await run(setBusy, showToast, async () => {
      await unwrap(window.api.delete_resource(resource.id));
      await refresh();
      showToast({ kind: 'success', message: '资料已删除。' });
    });
  }

  async function deleteProject(projectId: string) {
    const project = overview?.projects.find((item) => item.id === projectId);
    const pending = overview?.pending?.project_id === projectId;
    const confirmed = await askConfirm({
      title: '删除修炼方向',
      message: pending ? '该方向下有待出关记录，删除会一并放弃，并删除方向下的全部资料。' : '该方向下的资料会一并删除。',
      confirmLabel: '继续删除',
      danger: true,
    });
    const doubleConfirmed =
      confirmed &&
      (await askConfirm({
        title: '再次确认删除方向',
        message: `即将删除“${project?.name ?? '当前方向'}”。`,
        confirmLabel: '确认删除',
        danger: true,
      }));
    if (!doubleConfirmed) {
      return;
    }
    await run(setBusy, showToast, async () => {
      await unwrap(window.api.delete_project(projectId));
      setSelectedProjectId(null);
      await refresh();
      showToast({ kind: 'success', message: '修炼方向已删除。' });
    });
  }

  const shellThemeClass = useMemo(() => {
    if (activeTab === 'meditation') return stageClass;
    return `tab-theme-${activeTab}`;
  }, [activeTab, stageClass]);

  const bgGraphic = useMemo(() => {
    if (activeTab === 'meditation') {
      return (
        <svg className="spiritual-array-svg" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <circle cx="100" cy="100" r="95" stroke="currentColor" strokeWidth="0.8" strokeDasharray="8 4" />
          <circle cx="100" cy="100" r="85" stroke="currentColor" strokeWidth="0.5" />
          <circle cx="100" cy="100" r="70" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3 3" />
          <circle cx="100" cy="100" r="45" stroke="currentColor" strokeWidth="0.6" />
          <path d="M100 5 L100 195 M5 100 L195 100 M33 33 L167 167 M33 167 L167 33" stroke="currentColor" strokeWidth="0.3" opacity="0.5" />
          <circle cx="100" cy="100" r="15" stroke="currentColor" strokeWidth="1" />
          <path d="M100 85 A7.5 7.5 0 0 0 100 100 A7.5 7.5 0 0 1 100 115 A15 15 0 0 1 100 85 Z" fill="currentColor" opacity="0.8" />
        </svg>
      );
    }
    if (activeTab === 'library') {
      return (
        <svg className="spiritual-array-svg library-array-svg" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <polygon points="100,5 167,33 195,100 167,167 100,195 33,167 5,100 33,33" stroke="currentColor" strokeWidth="0.8" strokeDasharray="5 3" />
          <polygon points="100,15 157,39 181,100 157,161 100,181 43,161 19,100 43,39" stroke="currentColor" strokeWidth="0.5" />
          <circle cx="100" cy="100" r="65" stroke="currentColor" strokeWidth="0.6" />
          <circle cx="100" cy="100" r="45" stroke="currentColor" strokeWidth="0.6" strokeDasharray="4 2" />
          <rect x="80" y="80" width="40" height="40" rx="3" stroke="currentColor" strokeWidth="1" opacity="0.8" />
          <line x1="85" y1="90" x2="115" y2="90" stroke="currentColor" strokeWidth="0.8" />
          <line x1="85" y1="100" x2="115" y2="100" stroke="currentColor" strokeWidth="0.8" />
          <line x1="85" y1="110" x2="105" y2="110" stroke="currentColor" strokeWidth="0.8" />
          <path d="M40 40 L60 60 M160 40 L140 60 M40 160 L60 140 M160 160 L140 140" stroke="currentColor" strokeWidth="0.5" opacity="0.6" />
        </svg>
      );
    }
    if (activeTab === 'analytics') {
      return (
        <svg className="spiritual-array-svg analytics-array-svg" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <circle cx="100" cy="100" r="95" stroke="currentColor" strokeWidth="0.5" opacity="0.6" />
          <circle cx="100" cy="100" r="75" stroke="currentColor" strokeWidth="0.8" strokeDasharray="10 5" />
          <circle cx="100" cy="100" r="50" stroke="currentColor" strokeWidth="0.4" />
          <circle cx="100" cy="100" r="25" stroke="currentColor" strokeWidth="0.6" strokeDasharray="2 2" />
          <path d="M100 5 L159 181 L5 73 L195 73 L41 181 Z" stroke="currentColor" strokeWidth="0.6" opacity="0.5" />
          <circle cx="100" cy="5" r="2.5" fill="currentColor" />
          <circle cx="159" cy="181" r="2.5" fill="currentColor" />
          <circle cx="5" cy="73" r="2.5" fill="currentColor" />
          <circle cx="195" cy="73" r="2.5" fill="currentColor" />
          <circle cx="41" cy="181" r="2.5" fill="currentColor" />
          <circle cx="100" cy="100" r="88" stroke="currentColor" strokeWidth="0.8" strokeDasharray="1 3" />
        </svg>
      );
    }
    if (activeTab === 'spirit') {
      return (
        <svg className="spiritual-array-svg spirit-array-svg" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <circle cx="100" cy="100" r="95" stroke="currentColor" strokeWidth="0.4" opacity="0.5" />
          <circle cx="100" cy="100" r="85" stroke="currentColor" strokeWidth="0.8" strokeDasharray="6 3" />
          <path d="M100 20 C120 50, 120 70, 100 100 C80 70, 80 50, 100 20 Z" stroke="currentColor" strokeWidth="0.8" />
          <path d="M100 180 C120 150, 120 130, 100 100 C80 130, 80 150, 100 180 Z" stroke="currentColor" strokeWidth="0.8" />
          <path d="M20 100 C50 120, 70 120, 100 100 C70 80, 50 80, 20 100 Z" stroke="currentColor" strokeWidth="0.8" />
          <path d="M180 100 C150 120, 130 120, 100 100 C130 80, 150 80, 180 100 Z" stroke="currentColor" strokeWidth="0.8" />
          <path d="M43 43 C70 60, 80 70, 100 100 C80 80, 70 60, 43 43 Z" stroke="currentColor" strokeWidth="0.6" opacity="0.7" />
          <path d="M157 157 C130 140, 120 130, 100 100 C120 120, 130 140, 157 157 Z" stroke="currentColor" strokeWidth="0.6" opacity="0.7" />
          <path d="M43 157 C70 140, 80 130, 100 100 C80 120, 70 140, 43 157 Z" stroke="currentColor" strokeWidth="0.6" opacity="0.7" />
          <path d="M157 43 C130 60, 120 70, 100 100 C120 80, 130 60, 157 43 Z" stroke="currentColor" strokeWidth="0.6" opacity="0.7" />
          <circle cx="100" cy="100" r="30" stroke="currentColor" strokeWidth="1" />
          <path d="M100 85 C108 93, 108 100, 100 115 C92 100, 92 93, 100 85 Z" fill="currentColor" opacity="0.9" />
        </svg>
      );
    }
    return null;
  }, [activeTab]);

  if (!overview) {
    return <main className="app-shell grid place-items-center text-slate-100">正在读取本地记录...</main>;
  }

  return (
    <main className={`app-shell ${shellThemeClass}`} data-anim-paused={animPaused}>
      {/* ==================== 🪐 聚灵阵背景与灵气粒子 🪐 ==================== */}
      <div className="spiritual-array-bg" aria-hidden="true">
        {/* Rotating SVG array */}
        {bgGraphic}

        {/* Floating particles */}
        {particles.map((p) => {
          const particleStyle: ParticleStyle = {
              left: p.left,
              animationDelay: p.delay,
              animationDuration: p.duration,
              width: p.size,
              height: p.size,
              '--drift-x': p.driftX,
              background: p.color,
              boxShadow: `0 0 10px ${p.color}`
            };

          return <div key={p.id} className="spiritual-particle" style={particleStyle} />;
        })}
      </div>

      <ToastStack toasts={toasts} onDismiss={(toastId) => setToasts((current) => current.filter((item) => item.id !== toastId))} />

      <ProjectSidebar
        overview={overview}
        selectedProject={selectedProject}
        showNewProject={showNewProject}
        projectName={projectName}
        projectDescription={projectDescription}
        busy={busy}
        onToggleNewProject={() => setShowNewProject((current) => !current)}
        onCloseNewProject={() => setShowNewProject(false)}
        onProjectNameChange={setProjectName}
        onProjectDescriptionChange={setProjectDescription}
        onSubmitProject={submitProject}
        onSelectProject={setSelectedProjectId}
      />
      {/* ==================== RIGHT CONTENT AREA ==================== */}
      <div className="content-area">
        {/* Sticky Header */}
        <header className="content-header">
          <div className="breadcrumb">
            <span className="muted">当前境界 /</span>
            <strong className="text-gradient-themed" style={{ textShadow: '0 0 10px rgb(var(--accent-strong-rgb) / 0.4)', fontSize: '19px' }}>
              {selectedProject?.name ?? '未选择法门'} {selectedProject ? `(${stageName})` : ''}
            </strong>
          </div>

          {/* 🪐 Center Tab Navigation Bar 🪐 */}
          <div className="tab-nav" role="tablist" aria-label="主内容视图">
            {appTabs.map((tab) => (
              <button
                aria-controls={`app-panel-${tab.id}`}
                aria-selected={activeTab === tab.id}
                className={`tab-btn tab-btn-${tab.id} ${activeTab === tab.id ? 'active' : ''}`}
                data-tab={tab.id}
                id={`app-tab-${tab.id}`}
                key={tab.id}
                role="tab"
                tabIndex={activeTab === tab.id ? 0 : -1}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={handleTabKeyDown}
              >
                <tab.Icon aria-hidden="true" size={15} />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="header-actions">
            <button className="icon-button refresh-btn" type="button" onClick={refresh} disabled={busy} title="刷新" aria-label="刷新">
              <RefreshCcw size={16} />
            </button>
          </div>
        </header>

        {/* Scrollable Content Body */}
        <div className="content-body">
          {overview.pending ? (
            <PendingStrip pending={overview.pending} busy={busy} onOpenLog={openPendingLog} onAbandon={abandonPending} />
          ) : null}

          {/* Tab Conditional Rendering */}
          {activeTab === 'meditation' ? (
            /* Core Grid: Main Column (details, resources) */
            <div id="app-panel-meditation" className="content-grid meditation-grid" role="tabpanel" aria-labelledby="app-tab-meditation">
              {/* Main Column */}
              <div className="main-column">
                {/* Recommended study card at the very top of main column */}
                <section className="hero-panel">
                  <p className="eyebrow">继续闭关</p>
                  {overview.recommended ? (
                    <>
                      <h2>{overview.recommended.title}</h2>
                      <p className="muted">{overview.recommended_project_name}</p>
                      <ProgressBar value={overview.recommended.progress_percent} />
                      <p className="next-action">{overview.recommended.next_action || '还没有设置下次闭关目标。'}</p>
                      <div className="actions">
                        <button className="primary-button" type="button" onClick={() => continueResource(overview.recommended!)} disabled={busy}>
                          <Play size={16} />
                          继续学习
                        </button>
                        <button className="ghost-button" type="button" onClick={() => openLog(overview.recommended!, 'manual')} disabled={busy}>
                          <BookOpen size={16} />
                          记录进度
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="empty">暂无可推荐资料，建议在下方挑选或加入新的参悟秘卷。</p>
                  )}
                </section>

                <ResourceManagementPanel
                  selectedProject={selectedProject}
                  projectDetail={projectDetail}
                  resourceTitle={resourceTitle}
                  resourceType={resourceType}
                  cultivationRole={cultivationRole}
                  masteryGroup={masteryGroup}
                  masteryWeight={masteryWeight}
                  openKind={openKind}
                  pathOrUrl={pathOrUrl}
                  initialProgress={initialProgress}
                  initialNextAction={initialNextAction}
                  resourceTypes={resourceTypes}
                  cultivationRoles={cultivationRoles}
                  openKinds={openKinds}
                  busy={busy}
                  onResourceTitleChange={setResourceTitle}
                  onResourceTypeChange={setResourceType}
                  onCultivationRoleChange={setCultivationRole}
                  onMasteryGroupChange={setMasteryGroup}
                  onMasteryWeightChange={setMasteryWeight}
                  onOpenKindChange={setOpenKind}
                  onPathOrUrlChange={setPathOrUrl}
                  onInitialProgressChange={setInitialProgress}
                  onInitialNextActionChange={setInitialNextAction}
                  onSubmitResource={submitResource}
                  onPickPath={(kind) => pickPath(kind, false)}
                  onEditProject={(project) => setProjectEdit({ id: project.id, name: project.name })}
                  onDeleteProject={deleteProject}
                  onContinueResource={continueResource}
                  onOpenLog={openLog}
                  onShowResourceDetail={showResourceDetail}
                  onStartEditResource={startEditResource}
                  onDeleteResource={deleteResource}
                />
              </div>

            </div>
          ) : activeTab === 'library' ? (
            <div id="app-panel-library" className="tab-panel" role="tabpanel" aria-labelledby="app-tab-library">
              <GlobalLibrary
                overview={overview}
                onContinueResource={continueResource}
                onOpenLog={openLog}
                busy={busy}
              />
            </div>
          ) : activeTab === 'analytics' ? (
            <div id="app-panel-analytics" className="tab-panel" role="tabpanel" aria-labelledby="app-tab-analytics">
              <AnalyticsDashboard overview={overview} />
            </div>
          ) : (
            <div id="app-panel-spirit" className="tab-panel spirit-panel" role="tabpanel" aria-labelledby="app-tab-spirit">
              <ProjectStatsPanel
                overview={overview}
                selectedProject={selectedProject}
                cultivation={projectCultivation}
                busy={busy}
                onAttemptBreakthrough={attemptBreakthrough}
              />
            </div>
          )}
        </div>
      </div>

      {logDraft ? (
        <StudyLogModal
          draft={logDraft}
          resourceStatuses={resourceStatuses}
          evidenceTypes={evidenceTypes}
          busy={busy}
          onChange={setLogDraft}
          onStatusChange={changeLogStatus}
          onSubmit={submitLog}
          onClose={() => setLogDraft(null)}
        />
      ) : null}

      {projectEdit ? (
        <ProjectEditModal
          draft={projectEdit}
          busy={busy}
          onChange={setProjectEdit}
          onSubmit={submitProjectEdit}
          onClose={() => setProjectEdit(null)}
        />
      ) : null}

      {resourceEdit ? (
        <ResourceEditModal
          draft={resourceEdit}
          resourceTypes={resourceTypes}
          cultivationRoles={cultivationRoles}
          openKinds={openKinds}
          resourceStatuses={resourceStatuses}
          busy={busy}
          onChange={setResourceEdit}
          onSubmit={submitResourceEdit}
          onPickPath={(kind) => pickPath(kind, true)}
          onClose={() => setResourceEdit(null)}
        />
      ) : null}

      {resourceDetail ? <ResourceDetailModal detail={resourceDetail} enums={enums} onClose={() => setResourceDetail(null)} /> : null}

      {pendingConflict ? (
        <PendingConflictModal
          pending={pendingConflict}
          onOpenLog={openPendingLog}
          onAbandon={abandonPending}
          onClose={() => setPendingConflict(null)}
        />
      ) : null}

      {confirmRequest ? <ConfirmDialog request={confirmRequest} onSettle={settleConfirm} /> : null}

      {breakthroughData && (
        <BreakthroughOverlay
          resourceTitle={breakthroughData.resourceTitle}
          stageName={breakthroughData.stageName}
          onClose={() => setBreakthroughData(null)}
        />
      )}
    </main>
  );
}
