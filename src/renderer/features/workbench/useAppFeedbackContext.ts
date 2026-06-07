import { useContext } from 'react';

import { AppFeedbackContext } from './appFeedbackContext';

export function useAppFeedbackContext() {
  const value = useContext(AppFeedbackContext);
  if (!value) {
    throw new Error('AppFeedbackContext is not available.');
  }

  return value;
}
