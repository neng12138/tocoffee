import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';

export class DashboardQueryDto {
  @ApiPropertyOptional({
    description: '统计日，格式 YYYY-MM-DD；不传默认上海今天',
    example: '2026-11-11',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date 格式应为 YYYY-MM-DD' })
  date?: string;
}
