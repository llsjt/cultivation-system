export const errorCodes = [
  'VALIDATION_FAILED',
  'NOT_FOUND',
  'PENDING_SESSION_CONFLICT',
  'UNSUPPORTED_URL_SCHEME',
  'INVALID_URL',
  'PATH_NOT_FOUND',
  'PATH_BLOCKED',
  'PERMISSION_DENIED',
  'DB_CONSTRAINT_FAILED',
  'MIGRATION_FAILED',
  'TRANSACTION_FAILED',
  'IPC_CONTRACT_FAILED',
] as const;

export type ErrorCode = (typeof errorCodes)[number];

export interface AppErrorPayload {
  code: ErrorCode;
  user_message: string;
  recoverable: boolean;
  details?: Record<string, unknown>;
}

export const ErrorMessages: Record<ErrorCode, Pick<AppErrorPayload, 'user_message' | 'recoverable'>> = {
  VALIDATION_FAILED: { user_message: '输入有误，请检查后重试。', recoverable: true },
  NOT_FOUND: { user_message: '没有找到对应内容，可能已被删除。', recoverable: true },
  PENDING_SESSION_CONFLICT: { user_message: '已有一次闭关尚未出关记录，请先处理上一条学习记录。', recoverable: true },
  UNSUPPORTED_URL_SCHEME: { user_message: '只支持 http:// 或 https:// 链接。', recoverable: true },
  INVALID_URL: { user_message: '链接格式无法识别，请检查后重新输入。', recoverable: true },
  PATH_NOT_FOUND: { user_message: '找不到该路径，文件可能已被移动或删除。', recoverable: true },
  PATH_BLOCKED: { user_message: '为保护本地安全，已阻断此资源打开。', recoverable: true },
  PERMISSION_DENIED: { user_message: '没有权限打开该路径。可以修改路径，或仅记录进度。', recoverable: true },
  DB_CONSTRAINT_FAILED: { user_message: '保存失败，刚才填写的内容已保留。请稍后重试。', recoverable: true },
  MIGRATION_FAILED: { user_message: '数据升级未完成，应用已停止启动以保护数据。', recoverable: false },
  TRANSACTION_FAILED: { user_message: '保存失败，刚才填写的内容已保留。请稍后重试。', recoverable: true },
  IPC_CONTRACT_FAILED: { user_message: '内部数据契约异常，请重启应用后再试。', recoverable: false },
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly recoverable: boolean;
  readonly details?: Record<string, unknown>;

  constructor(input: { code: ErrorCode; details?: Record<string, unknown>; cause?: unknown }) {
    const message = ErrorMessages[input.code].user_message;
    super(message, { cause: input.cause });
    this.name = 'AppError';
    this.code = input.code;
    this.recoverable = ErrorMessages[input.code].recoverable;
    this.details = input.details;
  }

  toPayload(): AppErrorPayload {
    return {
      code: this.code,
      user_message: ErrorMessages[this.code].user_message,
      recoverable: this.recoverable,
      ...(this.details ? { details: this.details } : {}),
    };
  }
}

export function toAppErrorPayload(error: unknown, fallback: ErrorCode = 'TRANSACTION_FAILED'): AppErrorPayload {
  if (error instanceof AppError) {
    return error.toPayload();
  }

  return new AppError({ code: fallback }).toPayload();
}
