import type { ToastInput } from '../types';

export async function run(setBusy: (value: boolean) => void, showToast: (toast: ToastInput) => void, work: () => Promise<void>) {
  setBusy(true);
  try {
    await work();
  } catch (error) {
    showError(showToast, error);
  } finally {
    setBusy(false);
  }
}

export function showError(showToast: (toast: ToastInput) => void, error: unknown) {
  showToast({ kind: 'error', message: error instanceof Error ? error.message : '操作失败。' });
}
