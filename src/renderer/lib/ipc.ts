import type { IpcResult } from '../../shared/dto';

export async function unwrap<T>(promise: Promise<IpcResult<T>>): Promise<T> {
  return unwrapResult(await promise);
}

export function unwrapResult<T>(result: IpcResult<T>): T {
  if (result.ok) {
    return result.data;
  }
  throw new Error(result.error.user_message);
}
