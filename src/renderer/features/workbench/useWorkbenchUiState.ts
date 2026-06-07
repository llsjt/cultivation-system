import { useEffect, useState } from 'react';

import type { AppTab } from './types';

export function useWorkbenchUiState() {
  const [activeTab, setActiveTab] = useState<AppTab>('meditation');
  const [animPaused, setAnimPaused] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);

  // Pause ambient decoration when the desktop window is not active.
  useEffect(() => {
    const updatePaused = () => {
      setAnimPaused(document.visibilityState === 'hidden' || !document.hasFocus());
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

  return {
    activeTab,
    setActiveTab,
    animPaused,
    showNewProject,
    setShowNewProject,
  };
}
