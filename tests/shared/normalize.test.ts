import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import { normalizeStatusAndProgress } from '../../src/shared/normalize';

describe('normalizeStatusAndProgress', () => {
  it('binds terminal statuses to terminal progress', () => {
    expect(normalizeStatusAndProgress({ status: 'completed', progress_percent: 20 })).toEqual({ status: 'completed', progress_percent: 100 });
    expect(normalizeStatusAndProgress({ status: 'not_started', progress_percent: 90 })).toEqual({ status: 'not_started', progress_percent: 0 });
  });

  it('derives status from progress when status is omitted', () => {
    expect(normalizeStatusAndProgress({ progress_percent: 0 })).toEqual({ status: 'not_started', progress_percent: 0 });
    expect(normalizeStatusAndProgress({ progress_percent: 1 })).toEqual({ status: 'learning', progress_percent: 1 });
    expect(normalizeStatusAndProgress({ progress_percent: 99 })).toEqual({ status: 'learning', progress_percent: 99 });
    expect(normalizeStatusAndProgress({ progress_percent: 100 })).toEqual({ status: 'completed', progress_percent: 100 });
  });

  it('keeps active statuses in the 1..99 range', () => {
    expect(normalizeStatusAndProgress({ status: 'learning', progress_percent: 0 })).toEqual({ status: 'learning', progress_percent: 1 });
    expect(normalizeStatusAndProgress({ status: 'review', progress_percent: 100 })).toEqual({ status: 'review', progress_percent: 99 });
    expect(normalizeStatusAndProgress({ status: 'paused', progress_percent: 40 })).toEqual({ status: 'paused', progress_percent: 40 });
  });

  it('is idempotent', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100 }), fc.constantFrom('not_started', 'learning', 'paused', 'review', 'completed'), (progress, status) => {
        const once = normalizeStatusAndProgress({ status, progress_percent: progress });
        const twice = normalizeStatusAndProgress(once);
        expect(twice).toEqual(once);
      }),
    );
  });
});
