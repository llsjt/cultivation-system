import { describe, expect, it } from 'vitest';

import { formatDate, formatDateTime, formatSavedAt } from '../../../src/renderer/lib/dateFormat';

describe('dateFormat', () => {
  it('returns stable empty labels for missing or invalid dates', () => {
    expect(formatDate(null)).toBe('未记录');
    expect(formatDate('')).toBe('未记录');
    expect(formatDate('not-a-date')).toBe('未记录');
    expect(formatDateTime(null)).toBe('未记录');
    expect(formatSavedAt(null)).toBe('尚未入定');
  });

  it('formats valid dates', () => {
    expect(formatDate('2026-01-02T03:04:05.000Z')).toBe('2026-01-02');
    expect(formatDateTime('2026-01-02T03:04:05.000Z')).not.toBe('未记录');
    expect(formatSavedAt('2026-01-02T03:04:05.000Z')).not.toBe('尚未入定');
  });
});
