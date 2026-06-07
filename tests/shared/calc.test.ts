import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import { calcProjectProgress } from '../../src/shared/calc';

describe('calcProjectProgress', () => {
  it('rounds average progress', () => {
    expect(calcProjectProgress([])).toBe(0);
    expect(calcProjectProgress([20, 40, 100])).toBe(53);
  });

  it('stays in the progress range', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 100 }), { minLength: 0, maxLength: 50 }), (values) => {
        expect(calcProjectProgress(values)).toBeGreaterThanOrEqual(0);
        expect(calcProjectProgress(values)).toBeLessThanOrEqual(100);
      }),
    );
  });
});
