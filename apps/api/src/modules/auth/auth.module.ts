import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CustomerJwtGuard } from '../../common/auth/customer-jwt.guard.js';
import { StaffJwtGuard } from '../../common/auth/staff-jwt.guard.js';
import { AdminAuthController } from './controllers/admin-auth.controller.js';
import { AuthController } from './controllers/auth.controller.js';
import { RateLimitService } from './rate-limit.service.js';
import { AuthService } from './services/auth.service.js';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController, AdminAuthController],
  providers: [AuthService, RateLimitService, CustomerJwtGuard, StaffJwtGuard],
  exports: [AuthService, RateLimitService, CustomerJwtGuard, StaffJwtGuard],
})
export class AuthModule {}
