import { createContext } from 'react';

import type { WorkbenchDataContextValue } from './types';

export const WorkbenchDataContext = createContext<WorkbenchDataContextValue | null>(null);
