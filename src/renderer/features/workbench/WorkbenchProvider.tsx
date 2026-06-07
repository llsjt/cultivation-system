import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

import type {
  PendingSessionView,
  ResourceDetail,
  ResourceSummary,
  SaveStudyLogOutput,
} from '../../../shared/dto';
import type { CultivationRole, OpenKind, ResourceStatus, ResourceType } from '../../../shared/enums';
import { ProjectSidebar } from '../projects/ProjectSidebar';
import { ProjectStatsPanel } from '../projects/ProjectStatsPanel';
import { GlobalLibrary } from '../resources/GlobalLibrary';
import { AnalyticsDashboard } from '../projects/AnalyticsDashboard';
import { ToastStack } from '../../components/ToastStack';
import { run, showError } from '../../lib/actionRunner';
import { feedbackMessage } from '../../lib/feedback';
import { unwrapResult } from '../../lib/ipc';
import { buildCockpitViewModel, type LastStudyFeedbackInput } from '../projects/cockpitViewModel';
import type { ConfirmRequest, LogDraft, ProjectEditDraft, ResourceEditDraft, Toast, ToastInput } from '../../types';
import { AppBackground } from './AppBackground';
import { AppFeedbackContext } from './appFeedbackContext';
import { CurrentStudyWorkbench } from './CurrentStudyWorkbench';
import { useAppBootstrap } from './useAppBootstrap';
import { useSelectedProjectData } from './useSelectedProjectData';
import { workbenchApi } from './useWorkbenchActions';
import { WorkbenchActionsContext } from './workbenchActionsContext';
import { WorkbenchDataContext } from './workbenchDataContext';
import { WorkbenchOverlayHost } from './WorkbenchOverlayHost';
import { AppHeader } from './AppHeader';

type AppTab = 'meditation' | 'library' | 'analytics' | 'spirit';

export function WorkbenchProvider() {
  const [activeTab, setActiveTab] = useState<AppTab>('meditation');
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
  const [lastStudyFeedback, setLastStudyFeedback] = useState<LastStudyFeedbackInput | null>(null);
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

  const showToast = useCallback((toast: ToastInput) => {
    setToasts((current) => [...current, { ...toast, id: globalThis.crypto.randomUUID() }]);
  }, []);

  const { overview, enums, refreshOverview } = useAppBootstrap({ showToast });
  const {
    selectedProject,
    selectedProjectId,
    setSelectedProjectId,
    projectDetail,
    projectCultivation,
    loadProject,
  } = useSelectedProjectData({ overview, showToast });

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

  const resourceTypes = enums?.resource_type ?? [];
  const openKinds = enums?.open_kind ?? [];
  const resourceStatuses = enums?.resource_status ?? [];
  const cultivationRoles = enums?.cultivation_role ?? [];
  const evidenceTypes = enums?.study_evidence_type ?? [];
  const anyModalOpen = Boolean(logDraft || resourceEdit || projectEdit || resourceDetail || pendingConflict || confirmRequest);
  const cockpitNowSeed = overview?.last_saved_at ?? projectDetail?.recent_logs[0]?.studied_at ?? selectedProject?.updated_at ?? null;
  const cockpitNow = useMemo(() => {
    const timestamp = cockpitNowSeed ? Date.parse(cockpitNowSeed) : 0;
    return new Date(Number.isFinite(timestamp) ? timestamp : 0);
  }, [cockpitNowSeed]);
  const cockpitViewModel = useMemo(
    () =>
      buildCockpitViewModel({
        overview,
        selectedProject,
        projectDetail,
        projectCultivation,
        lastStudyFeedback,
        now: cockpitNow,
      }),
    [cockpitNow, lastStudyFeedback, overview, projectCultivation, projectDetail, selectedProject],
  );

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

  const refresh = useCallback(async () => {
    const data = await refreshOverview();
    const nextProjectId = selectedProjectId ?? data.projects[0]?.id ?? null;
    setSelectedProjectId(nextProjectId);
    await loadProject(nextProjectId);
  }, [loadProject, refreshOverview, selectedProjectId, setSelectedProjectId]);

  function askConfirm(input: Omit<ConfirmRequest, 'resolve'>): Promise<boolean> {
    return new Promise((resolve) => {
      setConfirmRequest({ ...input, resolve });
    });
  }

  function settleConfirm(confirmed: boolean) {
    confirmRequest?.resolve(confirmed);
    setConfirmRequest(null);
  }

  async function submitProject(event: FormEvent) {
    event.preventDefault();
    await run(setBusy, showToast, async () => {
      const project = await workbenchApi.createProject({ name: projectName, description: projectDescription || null });
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
      await workbenchApi.createResource({
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
        });
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
      const result = await workbenchApi.continueResource({ resource_id: resource.id });
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
        const retry = await workbenchApi.continueResource({ resource_id: resource.id, risk_confirm_token: result.risk_confirm_token });
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
      session = await workbenchApi.closePendingSession(pending.id, 'user_ended');
    }

    const detail = await workbenchApi.getResourceDetail(session.resource_id);
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
          ? '已根据资料窗口打开到关闭时间自动填入有效学习时长，可修改。'
          : '已根据打开资料到结束闭关时间自动填入有效学习时长，可修改。',
    });
  }, []);

  useEffect(() => {
    return workbenchApi.onPendingSessionClosed((pending) => {
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
      const result = await workbenchApi.selectLocalFile({
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
      await workbenchApi.updateProject(projectEdit.id, { name: projectEdit.name });
      setProjectEdit(null);
      await refresh();
      showToast({ kind: 'success', message: '修炼方向已更新。' });
    });
  }

  async function startEditResource(resource: ResourceSummary) {
    await run(setBusy, showToast, async () => {
      const detail = await workbenchApi.getResourceDetail(resource.id);
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
      setResourceDetail(await workbenchApi.getResourceDetail(resource.id));
    });
  }

  async function submitResourceEdit(event: FormEvent) {
    event.preventDefault();
    if (!resourceEdit) {
      return;
    }

    await run(setBusy, showToast, async () => {
      await workbenchApi.updateResource(resourceEdit.id, {
          title: resourceEdit.title,
          type: resourceEdit.type,
          open_kind: resourceEdit.open_kind,
          path_or_url: resourceEdit.open_kind === 'record_only' ? null : resourceEdit.path_or_url,
          cultivation_role: resourceEdit.cultivation_role,
          mastery_group: resourceEdit.mastery_group || null,
          mastery_weight: Number(resourceEdit.mastery_weight),
          ...(resourceEdit.status ? { status: resourceEdit.status } : {}),
        });
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

      let response = await workbenchApi.saveStudyLog(input);
      if (!response.ok && response.error.details?.conflict === true) {
        const confirmed = await askConfirm({
          title: '资料已变化',
          message: '资料在打开记录后发生过变化。确认覆盖表示用当前弹窗里的进度、状态、证据和下一步保存。',
          confirmLabel: '确认覆盖',
        });
        if (confirmed) {
          response = await workbenchApi.saveStudyLog({ ...input, confirm_overwrite: true });
        }
      }
      const result = unwrapResult<SaveStudyLogOutput>(response);
      setLogDraft(null);
      setLastStudyFeedback({ savedAt: new Date().toISOString(), output: result });
      await refresh();
      showToast({ kind: 'success', message: feedbackMessage(result) });
    });
  }

  async function attemptBreakthrough() {
    if (!selectedProject) {
      return;
    }

    await run(setBusy, showToast, async () => {
      const result = await workbenchApi.attemptBreakthrough(selectedProject.id);
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
      await workbenchApi.abandonPendingSession(pending.id);
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
      await workbenchApi.deleteResource(resource.id);
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
      await workbenchApi.deleteProject(projectId);
      setSelectedProjectId(null);
      await refresh();
      showToast({ kind: 'success', message: '修炼方向已删除。' });
    });
  }

  const dismissToast = (toastId: string) => setToasts((current) => current.filter((item) => item.id !== toastId));

  const workbenchDataContextValue = {
    overview,
    enums,
    selectedProject,
    selectedProjectId,
    projectDetail,
    projectCultivation,
    cockpitViewModel,
    activeTab,
  };

  const workbenchActionsContextValue = {
    actions: {
      submitProject,
      submitResource,
      continueResource,
      openPendingLog,
      pickPath,
      openLog,
      submitProjectEdit,
      startEditResource,
      showResourceDetail,
      submitResourceEdit,
      submitLog,
      attemptBreakthrough,
      abandonPending,
      deleteResource,
      deleteProject,
    },
    navigation: {
      setActiveTab,
      setSelectedProjectId,
      refresh,
    },
  };

  const appFeedbackContextValue = {
    busy,
    toasts,
    confirmRequest,
    showToast,
    dismissToast,
    askConfirm,
    settleConfirm,
  };


  if (!overview) {
    return <main className="app-shell grid place-items-center text-slate-100">正在读取本地记录...</main>;
  }

  return (
    <AppFeedbackContext.Provider value={appFeedbackContextValue}>
      <WorkbenchActionsContext.Provider value={workbenchActionsContextValue}>
        <WorkbenchDataContext.Provider value={workbenchDataContextValue}>
          <AppBackground activeTab={activeTab} animPaused={animPaused} stageClass={stageClass}>

      <ToastStack toasts={toasts} onDismiss={dismissToast} />

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
        <AppHeader
          activeTab={activeTab}
          busy={busy}
          selectedProjectName={selectedProject?.name ?? null}
          stageName={stageName}
          onRefresh={() => void refresh()}
          onSelectTab={setActiveTab}
        />

        {/* Scrollable Content Body */}
        <div className="content-body">
          {/* Tab Conditional Rendering */}
          {activeTab === 'meditation' ? (
            <div id="app-panel-meditation" className="tab-panel" role="tabpanel" aria-labelledby="app-tab-meditation">
              <CurrentStudyWorkbench
                resourcePanelProps={{
                  selectedProject,
                  projectDetail,
                  resourceTitle,
                  resourceType,
                  cultivationRole,
                  masteryGroup,
                  masteryWeight,
                  openKind,
                  pathOrUrl,
                  initialProgress,
                  initialNextAction,
                  resourceTypes,
                  cultivationRoles,
                  openKinds,
                  busy,
                  onResourceTitleChange: setResourceTitle,
                  onResourceTypeChange: setResourceType,
                  onCultivationRoleChange: setCultivationRole,
                  onMasteryGroupChange: setMasteryGroup,
                  onMasteryWeightChange: setMasteryWeight,
                  onOpenKindChange: setOpenKind,
                  onPathOrUrlChange: setPathOrUrl,
                  onInitialProgressChange: setInitialProgress,
                  onInitialNextActionChange: setInitialNextAction,
                  onSubmitResource: submitResource,
                  onPickPath: (kind) => pickPath(kind, false),
                  onEditProject: (project) => setProjectEdit({ id: project.id, name: project.name }),
                  onDeleteProject: deleteProject,
                  onContinueResource: continueResource,
                  onOpenLog: openLog,
                  onShowResourceDetail: showResourceDetail,
                  onStartEditResource: startEditResource,
                  onDeleteResource: deleteResource,
                }}
              />
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

      <WorkbenchOverlayHost
        logDraft={logDraft}
        projectEdit={projectEdit}
        resourceEdit={resourceEdit}
        resourceDetail={resourceDetail}
        pendingConflict={pendingConflict}
        confirmRequest={confirmRequest}
        breakthroughData={breakthroughData}
        enums={enums}
        resourceStatuses={resourceStatuses}
        evidenceTypes={evidenceTypes}
        resourceTypes={resourceTypes}
        cultivationRoles={cultivationRoles}
        openKinds={openKinds}
        busy={busy}
        onChangeLogDraft={setLogDraft}
        onChangeLogStatus={changeLogStatus}
        onSubmitLog={submitLog}
        onChangeProjectEdit={setProjectEdit}
        onSubmitProjectEdit={submitProjectEdit}
        onChangeResourceEdit={setResourceEdit}
        onSubmitResourceEdit={submitResourceEdit}
        onPickEditPath={(kind) => pickPath(kind, true)}
        onCloseResourceDetail={() => setResourceDetail(null)}
        onOpenPendingLog={openPendingLog}
        onAbandonPending={abandonPending}
        onClosePendingConflict={() => setPendingConflict(null)}
        onSettleConfirm={settleConfirm}
        onCloseBreakthrough={() => setBreakthroughData(null)}
      />
          </AppBackground>
        </WorkbenchDataContext.Provider>
      </WorkbenchActionsContext.Provider>
    </AppFeedbackContext.Provider>
  );
}

