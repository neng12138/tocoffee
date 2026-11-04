import {
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import type {
  AuthenticatedMember,
  RequestWithMember,
} from './auth.types.js';

export const CurrentMember = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedMember | undefined =>
    context.switchToHttp().getRequest<RequestWithMember>().member,
);
