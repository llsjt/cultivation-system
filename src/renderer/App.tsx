import { BookOpen, Check, CircleAlert, FilePlus2, FolderPlus, Pencil, Play, RefreshCcw, Save, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';

import type {
  GetEnumsOutput,
  GetHomeOverviewOutput,
  GetProjectDetailOutput,
  IpcResult,
  PendingSessionView,
  ResourceDetail,
  ResourceSummary,
  SaveStudyLogOutput,
} from '../shared/dto';
import type { OpenKind, ResourceStatus, ResourceType } from '../shared/enums';
import { normalizeProgressPercent } from '../shared/progress';

type ToastInput = { kind: 'success' | 'error'; message: string };
type Toast = ToastInput & { id: string };
type LogDraft = {
  resource: ResourceSummary;
  source: 'pending' | 'record_only' | 'manual';
  resource_updated_at_before: string;
  before_progress_percent: number;
  progress_text: string;
  progress_percent: string;
  status: ResourceStatus;
  statusChangedByUser: boolean;
  progressChangedByStatus: boolean;
  next_action: string;
};
type ResourceEditDraft = {
  id: string;
  title: string;
  type: ResourceType;
  open_kind: OpenKind;
  path_or_url: string;
  status: '' | Extract<ResourceStatus, 'learning' | 'review' | 'paused'>;
};
type ProjectEditDraft = { id: string; name: string };
type ConfirmRequest = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  resolve: (confirmed: boolean) => void;
};

export function App() {
  const [overview, setOverview] = useState<GetHomeOverviewOutput | null>(null);
  const [enums, setEnums] = useState<GetEnumsOutput | null>(null);
  const [projectDetail, setProjectDetail] = useState<GetProjectDetailOutput | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceType, setResourceType] = useState<ResourceType>('document');
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
  const [showNewProject, setShowNewProject] = useState(false);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const selectedProject = useMemo(
    () => overview?.projects.find((project) => project.id === selectedProjectId) ?? overview?.projects[0] ?? null,
    [overview, selectedProjectId],
  );
  const resourceTypes = enums?.resource_type ?? [];
  const openKinds = enums?.open_kind ?? [];
  const resourceStatuses = enums?.resource_status ?? [];
  const anyModalOpen = Boolean(logDraft || resourceEdit || projectEdit || resourceDetail || pendingConflict || confirmRequest);

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
      return;
    }
    setProjectDetail(await unwrap(window.api.get_project_detail(projectId)));
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
    const detailPromise = projectId ? window.api.get_project_detail(projectId).then(unwrapResult) : Promise.resolve(null);
    detailPromise
      .then((data) => {
        if (!cancelled) {
          setProjectDetail(data);
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
          initial_progress_percent: Number(initialProgress),
          initial_next_action: initialNextAction || null,
        }),
      );
      setResourceTitle('');
      setPathOrUrl('');
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

  async function openPendingLog(pending: PendingSessionView) {
    const detail = await unwrap(window.api.get_resource_detail(pending.resource_id));
    setPendingConflict(null);
    setLogDraft({
      resource: detail,
      source: 'pending',
      resource_updated_at_before: pending.resource_updated_at_before,
      before_progress_percent: pending.progress_before_percent,
      progress_text: detail.progress_text ?? '',
      progress_percent: String(detail.progress_percent),
      status: detail.status,
      statusChangedByUser: false,
      progressChangedByStatus: false,
      next_action: detail.next_action ?? '',
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
    });
  }

  function changeLogStatus(status: ResourceStatus) {
    if (status === 'completed') {
      showToast({ kind: 'success', message: '进度将设为 100%。' });
    } else if (status === 'not_started') {
      showToast({ kind: 'success', message: '进度将设为 0%。' });
    }

    setLogDraft((current) => {
      if (!current) {
        return current;
      }

      if (status === 'completed') {
        return { ...current, status, statusChangedByUser: true, progress_percent: '100', progressChangedByStatus: true };
      }

      if (status === 'not_started') {
        return { ...current, status, statusChangedByUser: true, progress_percent: '0', progressChangedByStatus: true };
      }

      return { ...current, status, statusChangedByUser: true, progressChangedByStatus: false };
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
        progress_text: logDraft.progress_text || null,
        progress_percent: Number(logDraft.progress_percent),
        ...(logDraft.statusChangedByUser ? { status: logDraft.status } : {}),
        next_action: logDraft.next_action || null,
        resource_updated_at_before: logDraft.resource_updated_at_before,
      };
      if (input.progress_percent < logDraft.before_progress_percent && !logDraft.progressChangedByStatus) {
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
          message: '资料在打开记录后发生过变化。确认覆盖表示用当前弹窗里的进度、状态和下一步保存。',
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

  if (!overview) {
    return <main className="app-shell grid place-items-center text-slate-100">正在读取本地记录...</main>;
  }

  const totalProjects = overview.projects.length;
  const totalResources = overview.projects.reduce((sum, p) => sum + p.resource_count, 0);
  const averageProgress = overview.projects.length
    ? Math.round(overview.projects.reduce((sum, p) => sum + p.progress_percent, 0) / overview.projects.length)
    : 0;
  const totalRecentLogs = overview.recent_logs.length;

  return (
    <main className="app-shell">
      {toasts.length > 0 ? (
        <div className="toast-stack" aria-live="polite">
          {toasts.slice(0, 3).map((toast) => (
            <div className={`toast ${toast.kind}`} role={toast.kind === 'error' ? 'alert' : 'status'} key={toast.id}>
              {toast.kind === 'success' ? <Check size={18} /> : <CircleAlert size={18} />}
              <span>{toast.message}</span>
              <button type="button" onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))} title="关闭" aria-label="关闭提示">
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {/* ==================== LEFT SIDEBAR ==================== */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo-wrap">
            <span className="logo-icon">☯</span>
            <div>
              <p className="eyebrow">Cultivation System</p>
              <h1>修仙参悟系统</h1>
            </div>
          </div>
          <p className="save-status">
            {overview.last_saved_at ? `本地已保存 · ${overview.last_saved_at}` : '等待首次本地保存'}
          </p>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section-header">
            <h2>修炼方向</h2>
            <button
              className={`icon-button new-project-toggle ${showNewProject ? 'active' : ''}`}
              type="button"
              onClick={() => setShowNewProject(!showNewProject)}
              title="新建方向"
              aria-label="新建修炼方向"
            >
              <FolderPlus size={16} />
            </button>
          </div>

          {showNewProject ? (
            <div className="sidebar-new-project-panel">
              <form className="stack-form" onSubmit={async (e) => { e.preventDefault(); await submitProject(e); setShowNewProject(false); }}>
                <input value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="方向名称" required maxLength={120} />
                <textarea value={projectDescription} onChange={(event) => setProjectDescription(event.target.value)} placeholder="描述..." maxLength={1000} />
                <div className="form-actions">
                  <button className="secondary-button" type="submit" disabled={busy}>
                    保存方向
                  </button>
                  <button className="ghost-button compact-btn" type="button" onClick={() => setShowNewProject(false)}>
                    取消
                  </button>
                </div>
              </form>
            </div>
          ) : null}

          <div className="item-list sidebar-project-list">
            {overview.projects.map((project) => (
              <button
                className={`list-item ${project.id === selectedProject?.id ? 'active' : ''}`}
                key={project.id}
                type="button"
                onClick={() => setSelectedProjectId(project.id)}
              >
                <div className="list-item-main">
                  <span className="project-dot">●</span>
                  <span className="project-name">{project.name}</span>
                </div>
                <small className="project-meta">
                  {project.progress_percent}% · {project.resource_count} 份资料
                </small>
              </button>
            ))}
            {overview.projects.length === 0 ? <p className="empty">暂无修炼方向</p> : null}
          </div>
        </nav>
      </aside>

      {/* ==================== RIGHT CONTENT AREA ==================== */}
      <div className="content-area">
        {/* Sticky Header */}
        <header className="content-header">
          <div className="breadcrumb">
            <span className="muted">当前境界 /</span>
            <strong>{selectedProject?.name ?? '未选择法门'}</strong>
          </div>
          <button className="icon-button refresh-btn" type="button" onClick={refresh} disabled={busy} title="刷新" aria-label="刷新">
            <RefreshCcw size={16} />
          </button>
        </header>

        {/* Scrollable Content Body */}
        <div className="content-body">
          {overview.pending ? (
            <section className="pending-strip">
              <div>
                <strong>待出关记录</strong>
                <span>{overview.pending.current_resource_title ?? overview.pending.resource_title_snapshot}</span>
              </div>
              <div className="actions">
                <button type="button" className="primary-button" onClick={() => openPendingLog(overview.pending!)} disabled={busy}>
                  <Save size={16} />
                  出关记录：保存本次学习进度
                </button>
                <button type="button" className="ghost-button" onClick={() => abandonPending(overview.pending!)} disabled={busy}>
                  放弃记录
                </button>
              </div>
            </section>
          ) : null}

          {/* Core Grid: Main Column (details, resources) + Right Profile (wukong style) */}
          <div className="content-grid">
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
                        继续闭关：打开资料继续学习
                      </button>
                      <button className="ghost-button" type="button" onClick={() => openLog(overview.recommended!, 'manual')} disabled={busy}>
                        <BookOpen size={16} />
                        出关记录
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="empty">暂无可推荐资料，建议在下方挑选或加入新的参悟秘卷。</p>
                )}
              </section>

              {/* Selected Project details and its resources */}
              <section className="detail-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">法门内景</p>
                    <h2>{selectedProject?.name ?? '暂无选定法门'}</h2>
                  </div>
                  {selectedProject ? (
                    <div className="actions">
                      <button className="ghost-button" type="button" onClick={() => setProjectEdit({ id: selectedProject.id, name: selectedProject.name })} disabled={busy} title="编辑方向">
                        <Pencil size={16} />
                      </button>
                      <button className="danger-button" type="button" onClick={() => deleteProject(selectedProject.id)} disabled={busy} title="删除方向">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ) : null}
                </div>

                {selectedProject ? (
                  <>
                    <form className="resource-form" onSubmit={submitResource}>
                      <input value={resourceTitle} onChange={(event) => setResourceTitle(event.target.value)} placeholder="资料名" required maxLength={200} />
                      <select value={resourceType} onChange={(event) => setResourceType(event.target.value as ResourceType)}>
                        {resourceTypes.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                      <select value={openKind} onChange={(event) => setOpenKind(event.target.value as OpenKind)}>
                        {openKinds.map((kind) => (
                          <option key={kind.value} value={kind.value}>
                            {kind.label}
                          </option>
                        ))}
                      </select>
                      {openKind !== 'record_only' ? (
                        <input value={pathOrUrl} onChange={(event) => setPathOrUrl(event.target.value)} placeholder="路径或链接" required maxLength={2048} />
                      ) : null}
                      <input value={initialProgress} onChange={(event) => setInitialProgress(event.target.value)} type="number" min={0} max={100} placeholder="初始进度" />
                      <input value={initialNextAction} onChange={(event) => setInitialNextAction(event.target.value)} placeholder="下次闭关目标" maxLength={500} />
                      <button className="secondary-button" type="submit" disabled={busy}>
                        <FilePlus2 size={16} />
                        加入资料
                      </button>
                    </form>

                    <div className="resource-list">
                      {projectDetail?.resources.items.map((resource) => (
                        <article className="resource-row" key={resource.id}>
                          <div className="resource-info">
                            <div className="resource-title-row">
                              <span className={`resource-badge ${resource.type}`}>
                                {resourceTypes.find((t) => t.value === resource.type)?.label ?? resource.type}
                              </span>
                              <h3>{resource.title}</h3>
                            </div>
                            <p>{resource.progress_text || '尚未记录进度描述。'}</p>
                            <p className="next-action">
                              <strong className="action-tag">目标：</strong>
                              {resource.next_action || '还没有设置下次闭关目标。'}
                            </p>
                            <ProgressBar value={resource.progress_percent} />
                          </div>
                          <div className="resource-actions">
                            <button className="primary-button" type="button" onClick={() => continueResource(resource)} disabled={busy}>
                              <Play size={14} />
                              继续闭关
                            </button>
                            <button className="ghost-button" type="button" onClick={() => openLog(resource, 'manual')} disabled={busy}>
                              出关记录
                            </button>
                            <button className="ghost-button" type="button" onClick={() => showResourceDetail(resource)} disabled={busy}>
                              详情
                            </button>
                            <button className="ghost-button" type="button" onClick={() => startEditResource(resource)} disabled={busy} title="编辑资料">
                              <Pencil size={14} />
                            </button>
                            <button className="danger-button" type="button" onClick={() => deleteResource(resource)} disabled={busy} title="删除资料">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </article>
                      ))}
                      {projectDetail && projectDetail.resources.items.length === 0 ? (
                        <p className="empty">此方向下暂无秘籍资料，请在上方添加。</p>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <p className="empty">请先在左侧选择或创建一个修炼方向以查阅和管理资料。</p>
                )}
              </section>
            </div>

            {/* Right Column: Wukong Style attributes Profile panel */}
            <div className="wukong-profile-panel">
              <div className="wukong-profile-header">
                <h2>【 元神法帖 】</h2>
                <p className="eyebrow text-center">Spiritual Attributes</p>
              </div>

              {/* Stats group 1: Foundation */}
              <div className="wukong-stat-group">
                <div className="wukong-stat-group-header">
                  <span>元神根基</span>
                </div>
                <div className="wukong-stat-item">
                  <span className="stat-label">参悟法门</span>
                  <span className="stat-divider"></span>
                  <span className="stat-value">{totalProjects} 门</span>
                </div>
                <div className="wukong-stat-item">
                  <span className="stat-label">研读法宝</span>
                  <span className="stat-divider"></span>
                  <span className="stat-value">{totalResources} 册</span>
                </div>
                <div className="wukong-stat-item">
                  <span className="stat-label">修行时日</span>
                  <span className="stat-divider"></span>
                  <span className="stat-value text-xs">{overview.last_saved_at ? '已保存' : '新参悟'}</span>
                </div>
              </div>

              {/* Stats group 2: Progress */}
              <div className="wukong-stat-group">
                <div className="wukong-stat-group-header">
                  <span>大乘参悟</span>
                </div>
                <div className="wukong-stat-item">
                  <span className="stat-label">总参悟度</span>
                  <span className="stat-divider"></span>
                  <span className="stat-value">{averageProgress}%</span>
                </div>
                <div className="wukong-stat-item">
                  <span className="stat-label">主修大道</span>
                  <span className="stat-divider"></span>
                  <span className="stat-value truncate max-w-[80px]" title={selectedProject?.name ?? '暂无'}>
                    {selectedProject?.name ?? '无'}
                  </span>
                </div>
                <div className="wukong-stat-item">
                  <span className="stat-label">主修进度</span>
                  <span className="stat-divider"></span>
                  <span className="stat-value">{selectedProject ? selectedProject.progress_percent : 0}%</span>
                </div>
              </div>

              {/* Stats group 3: Resistances */}
              <div className="wukong-stat-group">
                <div className="wukong-stat-group-header">
                  <span>历练劫难</span>
                </div>
                <div className="wukong-stat-item">
                  <span className="stat-label">红尘心魔</span>
                  <span className="stat-divider"></span>
                  <span className={`stat-value ${overview.pending ? 'cinnabar-text' : 'success-text'}`}>
                    {overview.pending ? '心魔滋生' : '灵台清明'}
                  </span>
                </div>
                <div className="wukong-stat-item">
                  <span className="stat-label">历练次数</span>
                  <span className="stat-divider"></span>
                  <span className="stat-value">{totalRecentLogs} 回</span>
                </div>
              </div>

              {/* Wukong Style Log fold (Recent logs) */}
              <div className="wukong-logs-section">
                <div className="wukong-stat-group-header">
                  <span>历练志 / 最近出关</span>
                </div>
                <div className="wukong-log-scroller">
                  {overview.recent_logs.map((log) => (
                    <div className="wukong-log-item" key={log.id}>
                      <span className="log-dot">◆</span>
                      <div className="log-item-content">
                        <strong>{log.resource_title_snapshot}</strong>
                        <small>
                          进度提升 {log.progress_before_percent}% → {log.progress_after_percent}%
                        </small>
                      </div>
                    </div>
                  ))}
                  {overview.recent_logs.length === 0 ? <p className="empty text-xs py-4 text-center">暂无历练印记</p> : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {logDraft ? (
        <div className="modal-backdrop" role="presentation">
          <form className="modal" onSubmit={submitLog} onKeyDown={(event) => handleModalKeyDown(event, () => setLogDraft(null))} role="dialog" aria-modal="true" aria-labelledby="study-log-title">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">出关记录：保存本次学习进度</p>
                <h2 id="study-log-title">{logDraft.resource.title}</h2>
              </div>
              <button className="icon-button" type="button" onClick={() => setLogDraft(null)} title="关闭" aria-label="关闭出关记录">
                <X size={18} />
              </button>
            </div>
            <label>
              出关进度
              <textarea value={logDraft.progress_text} onChange={(event) => setLogDraft({ ...logDraft, progress_text: event.target.value })} maxLength={500} required autoFocus />
            </label>
            <label>
              参悟进度
              <input
                value={logDraft.progress_percent}
                onChange={(event) => setLogDraft({ ...logDraft, progress_percent: event.target.value, progressChangedByStatus: false })}
                type="number"
                min={0}
                max={100}
                required
              />
            </label>
            <label>
              状态
              <select value={logDraft.status} onChange={(event) => changeLogStatus(event.target.value as ResourceStatus)}>
                {resourceStatuses.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.themed_label}
                  </option>
                ))}
              </select>
            </label>
            {logDraft.status === 'completed' || logDraft.status === 'not_started' ? (
              <p className="field-hint">{logDraft.status === 'completed' ? '进度将设为 100%。' : '进度将设为 0%。'}</p>
            ) : null}
            <label>
              下次闭关目标
              <textarea value={logDraft.next_action} onChange={(event) => setLogDraft({ ...logDraft, next_action: event.target.value })} maxLength={500} />
            </label>
            <div className="actions">
              <button className="primary-button" type="submit" disabled={busy}>
                <Save size={16} />
                保存记录
              </button>
              <button className="ghost-button" type="button" onClick={() => setLogDraft(null)}>
                取消
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {projectEdit ? (
        <div className="modal-backdrop" role="presentation">
          <form className="modal" onSubmit={submitProjectEdit} onKeyDown={(event) => handleModalKeyDown(event, () => setProjectEdit(null))} role="dialog" aria-modal="true" aria-labelledby="project-edit-title">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">方向编辑</p>
                <h2 id="project-edit-title">{projectEdit.name}</h2>
              </div>
              <button className="icon-button" type="button" onClick={() => setProjectEdit(null)} title="关闭" aria-label="关闭方向编辑">
                <X size={18} />
              </button>
            </div>
            <label>
              方向名称
              <input value={projectEdit.name} onChange={(event) => setProjectEdit({ ...projectEdit, name: event.target.value })} required maxLength={120} autoFocus />
            </label>
            <div className="actions">
              <button className="primary-button" type="submit" disabled={busy}>
                <Save size={16} />
                保存方向
              </button>
              <button className="ghost-button" type="button" onClick={() => setProjectEdit(null)}>
                取消
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {resourceEdit ? (
        <div className="modal-backdrop" role="presentation">
          <form className="modal" onSubmit={submitResourceEdit} onKeyDown={(event) => handleModalKeyDown(event, () => setResourceEdit(null))} role="dialog" aria-modal="true" aria-labelledby="resource-edit-title">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">资料编辑</p>
                <h2 id="resource-edit-title">{resourceEdit.title}</h2>
              </div>
              <button className="icon-button" type="button" onClick={() => setResourceEdit(null)} title="关闭" aria-label="关闭资料编辑">
                <X size={18} />
              </button>
            </div>
            <label>
              资料名
              <input value={resourceEdit.title} onChange={(event) => setResourceEdit({ ...resourceEdit, title: event.target.value })} required maxLength={200} autoFocus />
            </label>
            <label>
              类型
              <select value={resourceEdit.type} onChange={(event) => setResourceEdit({ ...resourceEdit, type: event.target.value as ResourceType })}>
                {resourceTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              打开方式
              <select value={resourceEdit.open_kind} onChange={(event) => setResourceEdit({ ...resourceEdit, open_kind: event.target.value as OpenKind })}>
                {openKinds.map((kind) => (
                  <option key={kind.value} value={kind.value}>
                    {kind.label}
                  </option>
                ))}
              </select>
            </label>
            {resourceEdit.open_kind !== 'record_only' ? (
              <label>
                路径或链接
                <input value={resourceEdit.path_or_url} onChange={(event) => setResourceEdit({ ...resourceEdit, path_or_url: event.target.value })} required maxLength={2048} />
              </label>
            ) : null}
            <label>
              非终态标记
              <select value={resourceEdit.status} onChange={(event) => setResourceEdit({ ...resourceEdit, status: event.target.value as ResourceEditDraft['status'] })}>
                <option value="">保持当前状态</option>
                {resourceStatuses
                  .filter((status) => status.value === 'learning' || status.value === 'review' || status.value === 'paused')
                  .map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.themed_label}
                    </option>
                  ))}
              </select>
            </label>
            <div className="actions">
              <button className="primary-button" type="submit" disabled={busy}>
                <Save size={16} />
                保存资料
              </button>
              <button className="ghost-button" type="button" onClick={() => setResourceEdit(null)}>
                取消
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {resourceDetail ? (
        <div className="modal-backdrop" role="presentation">
          <section className="modal" onKeyDown={(event) => handleModalKeyDown(event, () => setResourceDetail(null))} role="dialog" aria-modal="true" aria-labelledby="resource-detail-title">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">资料详情</p>
                <h2 id="resource-detail-title">{resourceDetail.title}</h2>
              </div>
              <button className="icon-button" type="button" onClick={() => setResourceDetail(null)} title="关闭" aria-label="关闭资料详情">
                <X size={18} />
              </button>
            </div>
            <ProgressBar value={resourceDetail.progress_percent} />
            <dl className="detail-list">
              <div>
                <dt>当前参悟位置</dt>
                <dd>{resourceDetail.progress_text ?? '尚未记录'}</dd>
              </div>
              <div>
                <dt>下次闭关目标</dt>
                <dd>{resourceDetail.next_action ?? '尚未设置'}</dd>
              </div>
              <div>
                <dt>类型</dt>
                <dd>{resourceTypes.find((type) => type.value === resourceDetail.type)?.label ?? resourceDetail.type}</dd>
              </div>
              <div>
                <dt>打开方式</dt>
                <dd>{openKinds.find((kind) => kind.value === resourceDetail.open_kind)?.label ?? resourceDetail.open_kind}</dd>
              </div>
              <div>
                <dt>状态</dt>
                <dd>{enums?.resource_status.find((status) => status.value === resourceDetail.status)?.themed_label ?? resourceDetail.status}</dd>
              </div>
              <div>
                <dt>打开目标</dt>
                <dd>{resourceDetail.path_or_url_display ?? '仅记录进度'}</dd>
              </div>
              <div>
                <dt>最近打开</dt>
                <dd>{resourceDetail.last_opened_at ?? '暂无'}</dd>
              </div>
              <div>
                <dt>最近出关</dt>
                <dd>{resourceDetail.last_studied_at ?? '暂无'}</dd>
              </div>
            </dl>
            <h3 className="compact-heading">最近记录</h3>
            <div className="item-list">
              {resourceDetail.recent_logs.map((log) => (
                <div className="log-item" key={log.id}>
                  <strong>
                    {log.progress_before_percent}% {'->'} {log.progress_after_percent}%
                  </strong>
                  <small>{log.next_action || '未设置下次闭关目标'}</small>
                </div>
              ))}
              {resourceDetail.recent_logs.length === 0 ? <p className="empty">暂无记录。</p> : null}
            </div>
          </section>
        </div>
      ) : null}

      {pendingConflict ? (
        <div className="modal-backdrop" role="presentation">
          <section className="modal compact-modal" onKeyDown={(event) => handleModalKeyDown(event, () => setPendingConflict(null))} role="dialog" aria-modal="true" aria-labelledby="pending-conflict-title">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">待出关记录</p>
                <h2 id="pending-conflict-title">先处理上一次学习</h2>
              </div>
              <button className="icon-button" type="button" onClick={() => setPendingConflict(null)} title="关闭" aria-label="关闭待记录冲突">
                <X size={18} />
              </button>
            </div>
            <p className="modal-message">
              {pendingConflict.current_resource_title ?? pendingConflict.resource_title_snapshot}
            </p>
            <div className="actions">
              <button className="primary-button" type="button" onClick={() => openPendingLog(pendingConflict)} autoFocus>
                <Save size={16} />
                记录本次学习
              </button>
              <button className="danger-button" type="button" onClick={() => abandonPending(pendingConflict)}>
                放弃记录
              </button>
              <button className="ghost-button" type="button" onClick={() => setPendingConflict(null)}>
                取消
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {confirmRequest ? (
        <div className="modal-backdrop" role="presentation">
          <section className="modal compact-modal" onKeyDown={(event) => handleModalKeyDown(event, () => settleConfirm(false))} role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">确认操作</p>
                <h2 id="confirm-title">{confirmRequest.title}</h2>
              </div>
              <button className="icon-button" type="button" onClick={() => settleConfirm(false)} title="关闭" aria-label="关闭确认">
                <X size={18} />
              </button>
            </div>
            <p id="confirm-message" className="modal-message">
              {confirmRequest.message}
            </p>
            <div className="actions">
              <button className={confirmRequest.danger ? 'danger-button' : 'primary-button'} type="button" onClick={() => settleConfirm(true)} autoFocus>
                {confirmRequest.confirmLabel}
              </button>
              <button className="ghost-button" type="button" onClick={() => settleConfirm(false)}>
                {confirmRequest.cancelLabel ?? '取消'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

export function ProgressBar({ value }: { value: number }) {
  const progress = normalizeProgressPercent(value);

  return (
    <div className="progress-wrap" role="progressbar" aria-label={`完成 ${progress}%`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
      <span style={{ width: `${progress}%` }} />
      <strong>{progress}%</strong>
    </div>
  );
}

function handleModalKeyDown(event: KeyboardEvent<HTMLElement>, close: () => void) {
  if (event.key === 'Escape') {
    event.preventDefault();
    close();
    return;
  }

  if (event.key !== 'Tab') {
    return;
  }

  const focusable = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => element.offsetParent !== null);

  if (focusable.length === 0) {
    event.preventDefault();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;

  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

async function unwrap<T>(promise: Promise<IpcResult<T>>): Promise<T> {
  return unwrapResult(await promise);
}

function unwrapResult<T>(result: IpcResult<T>): T {
  if (result.ok) {
    return result.data;
  }
  throw new Error(result.error.user_message);
}

async function run(setBusy: (value: boolean) => void, showToast: (toast: ToastInput) => void, work: () => Promise<void>) {
  setBusy(true);
  try {
    await work();
  } catch (error) {
    showError(showToast, error);
  } finally {
    setBusy(false);
  }
}

function showError(showToast: (toast: ToastInput) => void, error: unknown) {
  showToast({ kind: 'error', message: error instanceof Error ? error.message : '操作失败。' });
}

function feedbackMessage(result: SaveStudyLogOutput): string {
  if (result.feedback_kind === 'completed') {
    return '已记录本次学习，资料已参悟完成。';
  }
  if (result.feedback_kind === 'unchanged') {
    return '已记录本次学习，本次暂无进度变化。';
  }
  if (result.feedback_kind === 'decreased') {
    return `已记录本次学习，进度调整为 ${result.resource.progress_percent}%。`;
  }
  return `已记录本次学习，进度提升 ${result.progress_delta}%。`;
}
