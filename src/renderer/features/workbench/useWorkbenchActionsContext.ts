import { useContext } from 'react';

import { WorkbenchActionsContext } from './workbenchActionsContext';

export function useWorkbenchActionsContext() {
  const value = useContext(WorkbenchActionsContext);
  if (!value) {
    throw new Error('WorkbenchActionsContext is not available.');
  }

  return value;
}
