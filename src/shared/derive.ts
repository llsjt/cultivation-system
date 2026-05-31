import type { ProjectStatus, ResourceStatus } from './enums';

const projectStatusPriority: ProjectStatus[] = ['review', 'learning', 'paused', 'completed', 'not_started'];

export function deriveProjectStatus(resourceStatuses: ResourceStatus[]): ProjectStatus {
  if (resourceStatuses.length === 0) {
    return 'not_started';
  }

  for (const status of projectStatusPriority) {
    if (resourceStatuses.includes(status)) {
      return status;
    }
  }

  return 'not_started';
}
