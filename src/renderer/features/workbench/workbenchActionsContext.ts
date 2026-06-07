import { createContext } from 'react';

import type { WorkbenchActionsContextValue } from './types';

export const WorkbenchActionsContext = createContext<WorkbenchActionsContextValue | null>(null);
