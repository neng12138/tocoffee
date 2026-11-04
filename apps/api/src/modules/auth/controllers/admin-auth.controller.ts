import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import type { AuthenticatedStaff } from '../../../common/auth/auth.types.js';
import { CurrentStaff } from '../../../common/auth/current-staff.decorator.js';
import { StaffJwtGuard } from '../../../common/auth/staff-jwt.guard.js';
import { ChangePasswordDto } from '../dto/change-password.dto.js';
import { StaffLoginDto } from '../dto/staff-login.dto.js';
import { AuthService } from '../services/auth.service.js';

@ApiTags('员工认证')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: '员工账号密码登录' })
  login(@Body() dto: StaffLoginDto, @Req() request: Request) {
    return this.authService.staffLogin(
      dto.username,
      dto.password,
      this.clientIp(request),
    );
  }

  @Get('me')
  @UseGuards(StaffJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '当前员工信息' })
  me(@CurrentStaff() staff: AuthenticatedStaff) {
    return this.authService.getStaff(staff.id);
  }

  @Post('change-password')
  @HttpCode(200)
  @UseGuards(StaffJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '修改当前员工密码' })
  async changePassword(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.authService.changePassword(
      staff.id,
      dto.oldPassword,
      dto.newPassword,
    );
    return { ok: true };
  }

  private clientIp(request: Request): string {
    return request.ip ?? request.socket.remoteAddress ?? 'unknown';
  }
}
