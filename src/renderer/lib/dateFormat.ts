const UNKNOWN_DATE_LABEL = '未记录';

function parseDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time) : null;
}

export function formatDateTime(value: string | null): string {
  const date = parseDate(value);
  return date ? date.toLocaleString('zh-CN') : UNKNOWN_DATE_LABEL;
}

export function formatDate(value: string | null): string {
  const date = parseDate(value);
  return date ? date.toISOString().slice(0, 10) : UNKNOWN_DATE_LABEL;
}

export function formatSavedAt(value: string | null): string {
  const date = parseDate(value);
  return date ? date.toLocaleString('zh-CN') : '尚未入定';
}
