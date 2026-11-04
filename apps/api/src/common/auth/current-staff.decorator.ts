import {
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import type {
  AuthenticatedStaff,
  RequestWithStaff,
} from './auth.types.js';

export const CurrentStaff = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedStaff | undefined =>
    context.switchToHttp().getRequest<RequestWithStaff>().staff,
);
