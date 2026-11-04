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
import type { AuthenticatedMember } from '../../../common/auth/auth.types.js';
import { CurrentMember } from '../../../common/auth/current-member.decorator.js';
import { CustomerJwtGuard } from '../../../common/auth/customer-jwt.guard.js';
import { LoginDto } from '../dto/login.dto.js';
import { RequestCodeDto } from '../dto/request-code.dto.js';
import { AuthService } from '../services/auth.service.js';

@ApiTags('顾客认证')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('code')
  @HttpCode(200)
  @ApiOperation({ summary: '发送手机验证码' })
  requestCode(
    @Body() dto: RequestCodeDto,
    @Req() request: Request,
  ) {
    return this.authService.requestCode(dto.phone, this.clientIp(request));
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: '手机号验证码登录，不存在则自动注册' })
  login(@Body() dto: LoginDto, @Req() request: Request) {
    return this.authService.login(
      dto.phone,
      dto.code,
      this.clientIp(request),
    );
  }

  @Get('me')
  @UseGuards(CustomerJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '当前顾客信息' })
  me(@CurrentMember() member: AuthenticatedMember) {
    return this.authService.getMember(member.id);
  }

  private clientIp(request: Request): string {
    return request.ip ?? request.socket.remoteAddress ?? 'unknown';
  }
}
