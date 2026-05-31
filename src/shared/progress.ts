function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function normalizeProgressPercent(value: number, previous?: number): number {
  if (Number.isFinite(value)) {
    return clampPercent(value);
  }

  if (previous !== undefined && Number.isFinite(previous)) {
    return clampPercent(previous);
  }

  return 0;
}
