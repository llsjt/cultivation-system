import { BarChart3, Home, Library, RefreshCcw, Sparkles, type LucideIcon } from 'lucide-react';
import { useCallback, type KeyboardEvent } from 'react';

import type { AppTab } from './types';

const appTabs: { id: AppTab; label: string; Icon: LucideIcon }[] = [
  { id: 'meditation', label: '当前学习（驾驶舱）', Icon: Home },
  { id: 'library', label: '资料（藏经阁）', Icon: Library },
  { id: 'analytics', label: '修行统计', Icon: BarChart3 },
  { id: 'spirit', label: '突破诊断', Icon: Sparkles },
];

type AppHeaderProps = {
  activeTab: AppTab;
  busy: boolean;
  selectedProjectName: string | null;
  stageName: string;
  onRefresh(): void;
  onSelectTab(tab: AppTab): void;
};

export function AppHeader({ activeTab, busy, selectedProjectName, stageName, onRefresh, onSelectTab }: AppHeaderProps) {
  const focusTab = useCallback(
    (tab: AppTab) => {
      onSelectTab(tab);
      window.requestAnimationFrame(() => {
        document.getElementById(`app-tab-${tab}`)?.focus();
      });
    },
    [onSelectTab],
  );

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

  return (
    <header className="content-header">
      <div className="breadcrumb">
        <span className="muted">当前境界 /</span>
        <strong className="text-gradient-themed" style={{ textShadow: '0 0 10px rgb(var(--accent-strong-rgb) / 0.4)', fontSize: '19px' }}>
          {selectedProjectName ?? '未选择法门'} {selectedProjectName ? `(${stageName})` : ''}
        </strong>
      </div>

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
            onClick={() => onSelectTab(tab.id)}
            onKeyDown={handleTabKeyDown}
          >
            <tab.Icon aria-hidden="true" size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="header-actions">
        <button className="icon-button refresh-btn" type="button" onClick={onRefresh} disabled={busy} title="刷新" aria-label="刷新">
          <RefreshCcw size={16} />
        </button>
      </div>
    </header>
  );
}
