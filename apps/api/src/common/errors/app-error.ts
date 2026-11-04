import type { ErrorCode } from './error-codes.js';

/**
 * 业务错误。全局异常过滤器会把它转换为 { code, message, details? }。
 */
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly status = 400,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
