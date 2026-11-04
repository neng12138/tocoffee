import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AppError } from '../errors/app-error.js';
import { ERROR_CODES } from '../errors/error-codes.js';
import { STAFF_AUDIENCE } from './auth.constants.js';
import type { RequestWithStaff, StaffJwtPayload } from './auth.types.js';
import { extractBearerToken } from './bearer-token.js';

@Injectable()
export class StaffJwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithStaff>();
    const token = extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, '请先登录', 401);
    }

    try {
      const payload = await this.jwtService.verifyAsync<StaffJwtPayload>(token, {
        secret: this.config.getOrThrow<string>('jwt.staffSecret'),
        audience: STAFF_AUDIENCE,
      });

      if (
        payload.typ !== 'staff' ||
        typeof payload.sub !== 'string' ||
        typeof payload.storeId !== 'string' ||
        (payload.role !== 'OWNER' && payload.role !== 'STAFF')
      ) {
        throw new Error('invalid staff token');
      }

      request.staff = {
        id: payload.sub,
        storeId: payload.storeId,
        role: payload.role,
      };
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
