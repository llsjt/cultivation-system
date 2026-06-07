import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { normalizeProgressPercent } from '../../src/shared/progress';

function oracle(value: number, previous?: number): number {
  const source = Number.isFinite(value) ? value : previous;
  return source !== undefined && Number.isFinite(source) ? Math.min(100, Math.max(0, Math.round(source))) : 0;
}

describe('normalizeProgressPercent', () => {
  it('handles key examples', () => {
    expect(normalizeProgressPercent(-5)).toBe(0);
    expect(normalizeProgressPercent(105)).toBe(100);
    expect(normalizeProgressPercent(49.6)).toBe(50);
    expect(normalizeProgressPercent(Number.NaN, 73.2)).toBe(73);
    expect(normalizeProgressPercent(Number.NaN)).toBe(0);
  });

  it('keeps every result in the 0..100 integer range', () => {
    // Feature: black-myth-ui-theme, Property 1: progress values always fall in the [0,100] integer range.
    fc.assert(
      fc.property(fc.double(), fc.option(fc.double(), { nil: undefined }), (value, previous) => {
        const result = normalizeProgressPercent(value, previous);
        expect(Number.isInteger(result)).toBe(true);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThanOrEqual(100);
      }),
      { numRuns: 100 },
    );
  });

  it('clamps and rounds finite input', () => {
    // Feature: black-myth-ui-theme, Property 2: finite input follows clamp(round(value), 0, 100).
    fc.assert(
      fc.property(fc.double({ noNaN: true, noDefaultInfinity: true }), fc.option(fc.double(), { nil: undefined }), (value, previous) => {
        expect(normalizeProgressPercent(value, previous)).toBe(oracle(value, previous));
      }),
      { numRuns: 100 },
    );
  });

  it('falls back to the previous finite value or zero for non-finite input', () => {
    // Feature: black-myth-ui-theme, Property 3: non-finite input falls back to previous finite progress or 0.
    fc.assert(
      fc.property(fc.constantFrom(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY), fc.option(fc.double(), { nil: undefined }), (value, previous) => {
        expect(normalizeProgressPercent(value, previous)).toBe(oracle(value, previous));
      }),
      { numRuns: 100 },
    );
  });

  it('is idempotent', () => {
    // Feature: black-myth-ui-theme, Property 4: normalizing an already-normalized value does not change it.
    fc.assert(
      fc.property(fc.double(), (value) => {
        const normalized = normalizeProgressPercent(value);
        expect(normalizeProgressPercent(normalized)).toBe(normalized);
      }),
      { numRuns: 100 },
    );
  });

});
