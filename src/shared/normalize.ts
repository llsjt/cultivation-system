import type { ResourceStatus } from './enums';

export interface NormalizeInput {
  status?: ResourceStatus | null;
  progress_percent: number;
}

export interface NormalizedProgress {
  status: ResourceStatus;
  progress_percent: number;
}

export function normalizeStatusAndProgress(input: NormalizeInput): NormalizedProgress {
  const progress = Math.trunc(input.progress_percent);

  if (progress < 0 || progress > 100) {
    throw new RangeError('progress_percent must be between 0 and 100');
  }

  if (input.status === 'completed') {
    return { status: 'completed', progress_percent: 100 };
  }

  if (input.status === 'not_started') {
    return { status: 'not_started', progress_percent: 0 };
  }

  if (input.status === 'learning' || input.status === 'review' || input.status === 'paused') {
    return { status: input.status, progress_percent: clampActiveProgress(progress) };
  }

  if (progress === 100) {
    return { status: 'completed', progress_percent: 100 };
  }

  if (progress === 0) {
    return { status: 'not_started', progress_percent: 0 };
  }

  return { status: 'learning', progress_percent: progress };
}

function clampActiveProgress(progress: number): number {
  if (progress <= 0) {
    return 1;
  }

  if (progress >= 100) {
    return 99;
  }

  return progress;
}
