import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AppError } from '../errors/app-error.js';
import { ERROR_CODES } from '../errors/error-codes.js';
import { CUSTOMER_AUDIENCE } from './auth.constants.js';
import type {
  CustomerJwtPayload,
  RequestWithMember,
} from './auth.types.js';
import { extractBearerToken } from './bearer-token.js';

@Injectable()
export class CustomerJwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithMember>();
    const token = extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, '请先登录', 401);
    }

    try {
      const payload = await this.jwtService.verifyAsync<CustomerJwtPayload>(
        token,
        {
          secret: this.config.getOrThrow<string>('jwt.customerSecret'),
          audience: CUSTOMER_AUDIENCE,
        },
      );

      if (payload.typ !== 'customer' || typeof payload.sub !== 'string') {
        throw new Error('invalid customer token');
      }

      request.member = { id: payload.sub };
      return true;
    } catch {
      throw new AppError(
        ERROR_CODES.UNAUTHORIZED,
        '登录已失效，请重新登录',
        401,
      );
    }
  }
}
