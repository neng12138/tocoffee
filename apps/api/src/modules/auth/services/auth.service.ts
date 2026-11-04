import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import type { StringValue } from 'ms';
import { randomInt } from 'node:crypto';
import {
  CUSTOMER_AUDIENCE,
  CUSTOMER_TOKEN_TTL,
  STAFF_AUDIENCE,
  STAFF_TOKEN_TTL,
} from '../../../common/auth/auth.constants.js';
import type {
  CustomerLoginResult,
  MemberPublic,
  RequestCodeResult,
  StaffLoginResult,
  StaffPublic,
} from '../../../common/auth/auth.types.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ERROR_CODES } from '../../../common/errors/error-codes.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { toMemberPublic } from '../mappers/member.mapper.js';
import { toStaffPublic } from '../mappers/staff.mapper.js';
import { RateLimitService } from '../rate-limit.service.js';

const CODE_TTL_SECONDS = 300;
const CODE_TTL_MS = CODE_TTL_SECONDS * 1000;
const PASSWORD_COST = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly rateLimit: RateLimitService,
  ) {}

  async requestCode(phone: string, ip: string): Promise<RequestCodeResult> {
    this.rateLimit.consume(`code:${ip}:${phone}`);

    // 同一手机号只保留最新一条未消费验证码。
    await this.prisma.verificationCode.deleteMany({
      where: { phone, consumedAt: null },
    });

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const codeHash = await hash(code, 8);
    await this.prisma.verificationCode.create({
      data: {
        phone,
        codeHash,
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      },
    });

    return {
      expiresInSeconds: CODE_TTL_SECONDS,
      ...(this.config.get<boolean>('authDevMode') ? { devCode: code } : {}),
    };
  }

  async login(
    phone: string,
    code: string,
    ip: string,
  ): Promise<CustomerLoginResult> {
    this.rateLimit.consume(`login:${ip}:${phone}`);

    const record = await this.prisma.verificationCode.findFirst({
      where: { phone, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      throw new AppError(
        ERROR_CODES.UNAUTHORIZED,
        '验证码错误或已过期',
        401,
      );
    }

    if (record.expiresAt.getTime() <= Date.now()) {
      throw new AppError(
        ERROR_CODES.UNAUTHORIZED,
        '验证码错误或已过期',
        401,
      );
    }

    if (!(await compare(code, record.codeHash))) {
      throw new AppError(
        ERROR_CODES.UNAUTHORIZED,
        '验证码错误或已过期',
        401,
      );
    }

    const consumed = await this.prisma.verificationCode.updateMany({
      where: { id: record.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    if (consumed.count !== 1) {
      throw new AppError(
        ERROR_CODES.UNAUTHORIZED,
        '验证码已使用，请重新获取',
        401,
      );
    }

    const member = await this.prisma.member.upsert({
      where: { phone },
      update: { lastLoginAt: new Date() },
      create: { phone, lastLoginAt: new Date() },
    });

    return {
      token: await this.signCustomer(member.id),
      member: toMemberPublic(member),
    };
  }

  async getMember(memberId: string): Promise<MemberPublic> {
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, '账号不存在', 401);
    }

    return toMemberPublic(member);
  }

  async staffLogin(
    username: string,
    password: string,
    ip: string,
  ): Promise<StaffLoginResult> {
    this.rateLimit.consume(`staff:${ip}:${username}`);

    const staff = await this.prisma.staff.findFirst({
      where: { username, status: 'ACTIVE' },
      include: { store: { select: { id: true, name: true } } },
    });

    if (!staff || !(await compare(password, staff.passwordHash))) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, '账号或密码错误', 401);
    }

    return {
      token: await this.signStaff(staff),
      staff: toStaffPublic(staff),
    };
  }

  async getStaff(staffId: string): Promise<StaffPublic> {
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
      include: { store: { select: { id: true, name: true } } },
    });

    if (!staff || staff.status !== 'ACTIVE') {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, '账号不存在或已停用', 401);
    }

    return toStaffPublic(staff);
  }

  async changePassword(
    staffId: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<void> {
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
    });

    if (!staff || staff.status !== 'ACTIVE') {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, '账号不存在或已停用', 401);
    }

    if (!(await compare(oldPassword, staff.passwordHash))) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, '原密码错误', 400);
    }

    if (oldPassword === newPassword) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        '新密码不能与原密码相同',
        400,
      );
    }

    await this.prisma.staff.update({
      where: { id: staffId },
      data: { passwordHash: await hash(newPassword, PASSWORD_COST) },
    });
  }

  private signCustomer(memberId: string): Promise<string> {
    return this.jwtService.signAsync(
      { sub: memberId, typ: 'customer' },
      {
        secret: this.config.getOrThrow<string>('jwt.customerSecret'),
        audience: CUSTOMER_AUDIENCE,
        expiresIn: (this.config.get<string>('jwt.customerExpiresIn') ??
          CUSTOMER_TOKEN_TTL) as StringValue,
      },
    );
  }

  private signStaff(staff: {
    id: string;
    storeId: string;
    role: 'OWNER' | 'STAFF';
  }): Promise<string> {
    return this.jwtService.signAsync(
      {
        sub: staff.id,
        typ: 'staff',
        storeId: staff.storeId,
        role: staff.role,
      },
      {
        secret: this.config.getOrThrow<string>('jwt.staffSecret'),
        audience: STAFF_AUDIENCE,
        expiresIn: (this.config.get<string>('jwt.staffExpiresIn') ??
          STAFF_TOKEN_TTL) as StringValue,
      },
    );
  }
}
