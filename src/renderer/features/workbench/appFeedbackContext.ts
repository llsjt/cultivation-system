import { createContext } from 'react';

import type { AppFeedbackContextValue } from './types';

export const AppFeedbackContext = createContext<AppFeedbackContextValue | null>(null);
