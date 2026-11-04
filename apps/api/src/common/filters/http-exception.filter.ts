import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppError } from '../errors/app-error.js';
import { ERROR_CODES } from '../errors/error-codes.js';

interface ErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: ErrorBody = {
      code: ERROR_CODES.INTERNAL_ERROR,
      message: '服务器内部错误',
    };

    if (exception instanceof AppError) {
      status = exception.status;
      body = {
        code: exception.code,
        message: exception.message,
        ...(exception.details === undefined
          ? {}
          : { details: exception.details }),
      };
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      body = this.fromHttpException(exception);
    } else {
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json(body);
  }

  private fromHttpException(exception: HttpException): ErrorBody {
    const payload = exception.getResponse();
    const status = exception.getStatus();

    if (typeof payload === 'string') {
      return { code: this.codeForStatus(status), message: payload };
    }

    const record = payload as Record<string, unknown>;
    const message = record.message;

    return {
      code:
        typeof record.code === 'string'
          ? record.code
          : this.codeForStatus(status),
      message: Array.isArray(message)
        ? message.join('; ')
        : typeof message === 'string'
          ? message
          : exception.message,
      ...(record.details === undefined ? {} : { details: record.details }),
    };
  }

  private codeForStatus(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ERROR_CODES.VALIDATION_ERROR;
      case HttpStatus.UNAUTHORIZED:
        return ERROR_CODES.UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return ERROR_CODES.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ERROR_CODES.NOT_FOUND;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ERROR_CODES.RATE_LIMITED;
      default:
        return status >= 500
          ? ERROR_CODES.INTERNAL_ERROR
          : ERROR_CODES.VALIDATION_ERROR;
    }
  }
}
