import {
  Controller,
  Get,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../database/prisma.service.js';

export interface HealthResponse {
  status: 'ok';
  db: 'up';
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: '服务与数据库健康检查' })
  @ApiOkResponse({
    schema: {
      example: { status: 'ok', db: 'up' },
    },
  })
  async check(): Promise<HealthResponse> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', db: 'up' };
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        db: 'down',
      });
    }
  }
}
