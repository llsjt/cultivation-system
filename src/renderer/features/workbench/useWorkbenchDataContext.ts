import { useContext } from 'react';

import { WorkbenchDataContext } from './workbenchDataContext';

export function useWorkbenchDataContext() {
  const value = useContext(WorkbenchDataContext);
  if (!value) {
    throw new Error('WorkbenchDataContext is not available.');
  }

  return value;
}
