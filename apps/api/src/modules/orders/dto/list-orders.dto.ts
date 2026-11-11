import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { OrderStatus } from '@prisma/client';

export enum OrderListTab {
  ALL = 'ALL',
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  ACTIVE = 'ACTIVE',
  FINISHED = 'FINISHED',
  CANCELED = 'CANCELED',
}

export class ListOrdersDto {
  @IsOptional()
  @IsEnum(OrderListTab)
  tab?: OrderListTab;

  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}
