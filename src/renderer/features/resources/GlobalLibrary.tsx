import { BookOpen, Play, RefreshCw, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import type { GetHomeOverviewOutput, ResourceSummary } from '../../../shared/dto';
import { ProgressBar } from '../../components/ProgressBar';
import { getResourceRoleDisplay, getResourceStatusLabel, getResourceTypeLabel } from './resourceDisplay';

type GlobalLibraryProps = {
  overview: GetHomeOverviewOutput;
  onContinueResource: (resource: ResourceSummary) => Promise<void>;
  onOpenLog: (resource: ResourceSummary, source: 'manual') => void;
  busy: boolean;
};

type AggregatedResource = {
  resource: ResourceSummary;
  projectName: string;
};

const EMPTY_AGGREGATED_RESOURCES: AggregatedResource[] = [];

export function GlobalLibrary({ overview, onContinueResource, onOpenLog, busy }: GlobalLibraryProps) {
  const [allResources, setAllResources] = useState<AggregatedResource[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const hasProjects = overview.projects.length > 0;

  useEffect(() => {
    if (!hasProjects) {
      return;
    }

    let active = true;
    const fetchAllResources = async () => {
      setLoading(true);
      setErrorMessage(null);
      try {
        const promises = overview.projects.map(async (project) => {
          const res = await window.api.get_project_detail(project.id);
          if (res.ok && res.data) {
            return res.data.resources.items.map((item) => ({
              resource: item,
              projectName: project.name,
            }));
          }
          throw new Error(`${project.name}：${res.ok ? '资料响应为空。' : res.error.user_message}`);
        });
        const results = await Promise.all(promises);
        if (active) {
          setAllResources(results.flat());
          setErrorMessage(null);
        }
      } catch (err) {
        console.error('Failed to aggregate global resources:', err);
        if (active) {
          setAllResources(EMPTY_AGGREGATED_RESOURCES);
          setErrorMessage(err instanceof Error && err.message ? err.message : '全局资料库加载失败，请稍后重试。');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void fetchAllResources();

    return () => {
      active = false;
    };
  }, [hasProjects, overview.projects, overview.last_saved_at, reloadKey]); // Refresh when project structure or logs change

  const effectiveResources = hasProjects ? allResources : EMPTY_AGGREGATED_RESOURCES;
  const isLoading = hasProjects && loading;
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const hasActiveFilters =
    normalizedSearchQuery.length > 0 || projectFilter !== 'all' || typeFilter !== 'all' || statusFilter !== 'all';

  const filteredResources = useMemo(() => {
    return effectiveResources.filter((item) => {
      const matchesSearch =
        normalizedSearchQuery.length === 0 ||
        item.resource.title.toLowerCase().includes(normalizedSearchQuery) ||
        item.projectName.toLowerCase().includes(normalizedSearchQuery);
      const matchesProject = projectFilter === 'all' || item.resource.project_id === projectFilter;
      const matchesType = typeFilter === 'all' || item.resource.type === typeFilter;
      const matchesStatus = statusFilter === 'all' || item.resource.status === statusFilter;
      return matchesSearch && matchesProject && matchesType && matchesStatus;
    });
  }, [effectiveResources, normalizedSearchQuery, projectFilter, typeFilter, statusFilter]);

  const uniqueProjects = useMemo(() => {
    return overview.projects.map((p) => ({ id: p.id, name: p.name }));
  }, [overview.projects]);

  const clearFilters = () => {
    setSearchQuery('');
    setProjectFilter('all');
    setTypeFilter('all');
    setStatusFilter('all');
  };

  const retryLoadResources = () => {
    setReloadKey((value) => value + 1);
  };

  const hasAnyResources = effectiveResources.length > 0;
  const hasFilteredResources = filteredResources.length > 0;
  const isLoadFailed = hasProjects && !isLoading && errorMessage !== null;
  const isFilteredEmpty = !isLoadFailed && hasAnyResources && !hasFilteredResources;

  return (
    <div className="global-library-panel">
      <div>
        <p className="eyebrow">无极法藏</p>
        <h2 style={{ fontSize: '22px', margin: '4px 0 0 0', fontFamily: '"InkBrushTitle", serif' }}>
          【 藏经阁全局秘卷 】
        </h2>
      </div>

      {/* Search & Filter Row */}
      <div className="library-search-row library-controls-row">
        <div className="library-search-field" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <input
            className="resource-search-input library-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索秘卷名、所属法门..."
            style={{ paddingLeft: '32px' }}
          />
          <Search size={14} className="muted" style={{ position: 'absolute', left: '10px' }} />
        </div>

        <select
          className="resource-filter-select library-filter-select"
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
        >
          <option value="all">所有修炼法门</option>
          {uniqueProjects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <select
          className="resource-filter-select library-filter-select"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="all">所有秘卷类型</option>
          <option value="document">文献 (PDF/EPUB)</option>
          <option value="video">影像 (视频)</option>
          <option value="web">灵网 (网页)</option>
          <option value="course">功课 (课程)</option>
          <option value="repo">宝库 (仓库)</option>
          <option value="exercise">历练 (练习)</option>
          <option value="book">典籍 (书籍)</option>
          <option value="other">奇珍 (其他)</option>
        </select>

        <select
          className="resource-filter-select library-filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">所有参悟状态</option>
          <option value="not_started">尚未面世</option>
          <option value="learning">正在参悟</option>
          <option value="review">温故知新</option>
          <option value="paused">道行搁置</option>
          <option value="completed">功德圆满</option>
        </select>

        <button
          className="ghost-button library-clear-filters-button"
          type="button"
          title="清除当前筛选"
          onClick={clearFilters}
          disabled={!hasActiveFilters}
        >
          <X size={14} />
          清除筛选
        </button>
      </div>

      {/* Library Table View */}
      <div className="library-table-container library-table-container--responsive">
        {isLoading ? (
          <div className="library-state library-state--loading" aria-live="polite">
            <p className="empty py-12">正在召集十方神念，检索秘卷归档...</p>
          </div>
        ) : isLoadFailed ? (
          <div className="library-state library-state--error" role="alert">
            <p className="empty py-12">全局资料库加载失败：{errorMessage}</p>
            <div className="library-state-actions">
              <button className="primary-button library-retry-button" type="button" onClick={retryLoadResources}>
                <RefreshCw size={14} />
                重试
              </button>
            </div>
          </div>
        ) : hasFilteredResources ? (
          <table className="library-table library-table--global">
            <thead>
              <tr>
                <th style={{ width: '18%' }}>所属大类</th>
                <th style={{ width: '30%' }}>秘卷标题</th>
                <th style={{ width: '12%' }}>类型</th>
                <th style={{ width: '15%' }}>参悟进度</th>
                <th style={{ width: '12%' }}>境界状态</th>
                <th style={{ width: '13%' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredResources.map(({ resource, projectName }) => {
                const roleDisplay = getResourceRoleDisplay(resource.cultivation_role);
                return (
                <tr key={resource.id}>
                  <td style={{ fontWeight: 600, color: 'var(--accent-strong)' }}>{projectName}</td>
                  <td>
                    <strong style={{ color: 'var(--text)' }}>{resource.title}</strong>
                    <div className="text-xs muted truncate max-w-[280px]" title={roleDisplay.description} style={{ marginTop: '2px' }}>
                      定位：{roleDisplay.label}
                    </div>
                    {resource.next_action && (
                      <div className="text-xs muted truncate max-w-[280px]" title={`下步行动: ${resource.next_action}`} style={{ marginTop: '2px' }}>
                        目标：{resource.next_action}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={`resource-badge ${resource.type}`}>
                      {getResourceTypeLabel(resource.type)}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <ProgressBar value={resource.progress_percent} />
                      <span style={{ fontSize: '14px', fontWeight: 'bold', width: '40px', textAlign: 'right' }}>
                        {resource.progress_percent}%
                      </span>
                    </div>
                  </td>
                  <td style={{ fontWeight: 600 }}>
                    <span
                      style={{
                        color:
                          resource.status === 'completed'
                            ? 'var(--success)'
                            : resource.status === 'learning'
                              ? 'rgb(var(--realm-primary-rgb, 34 211 238))'
                              : 'var(--muted)',
                      }}
                    >
                      {getResourceStatusLabel(resource.status)}
                    </span>
                  </td>
                  <td>
                    <div className="library-table-actions">
                      <button
                        className="primary-button"
                        type="button"
                        title="继续闭关参悟"
                        aria-label={`继续学习 ${resource.title}`}
                        onClick={() => void onContinueResource(resource)}
                        disabled={busy}
                      >
                        <Play size={14} style={{ marginRight: '4px' }} />
                        闭关
                      </button>
                      <button
                        className="ghost-button"
                        type="button"
                        title="记录出关功过"
                        aria-label={`记录进度 ${resource.title}`}
                        onClick={() => onOpenLog(resource, 'manual')}
                        disabled={busy}
                      >
                        <BookOpen size={14} style={{ marginRight: '4px' }} />
                        出关
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        ) : isFilteredEmpty ? (
          <div className="library-state library-state--filtered-empty">
            <p className="empty py-12">没有找到符合当前筛选的秘卷。</p>
            <div className="library-state-actions">
              <button className="ghost-button library-clear-filters-button" type="button" onClick={clearFilters}>
                <X size={14} />
                清除筛选
              </button>
            </div>
          </div>
        ) : (
          <div className="library-state library-state--empty">
            <p className="empty py-12">
              {hasProjects ? '藏经阁尚未迎请任何秘籍。' : '尚未创建修炼法门，暂无可汇总的秘籍。'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
