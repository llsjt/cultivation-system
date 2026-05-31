export function calcProjectProgress(percents: number[]): number {
  if (percents.length === 0) {
    return 0;
  }

  const total = percents.reduce((sum, value) => sum + value, 0);
  return Math.round(total / percents.length);
}
