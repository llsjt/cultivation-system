import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import { deriveProjectStatus } from '../../src/shared/derive';
import type { ResourceStatus } from '../../src/shared/enums';

describe('deriveProjectStatus', () => {
  it('uses the project-level priority order', () => {
    expect(deriveProjectStatus([])).toBe('not_started');
    expect(deriveProjectStatus(['completed', 'not_started'])).toBe('completed');
    expect(deriveProjectStatus(['learning', 'review'])).toBe('review');
    expect(deriveProjectStatus(['paused', 'not_started'])).toBe('paused');
  });

  it('is invariant to resource ordering', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom<ResourceStatus>('not_started', 'learning', 'paused', 'review', 'completed'), { minLength: 0, maxLength: 20 }),
        (statuses) => {
          const reversed = [...statuses].reverse();
          expect(deriveProjectStatus(reversed)).toBe(deriveProjectStatus(statuses));
        },
      ),
    );
  });
});
