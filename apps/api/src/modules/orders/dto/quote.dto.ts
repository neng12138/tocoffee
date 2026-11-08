import { PickupTimeType } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class QuoteItemDto {
  @ApiProperty({
    example: '00000000-0000-4000-8000-000000000201',
    description: '商品 ID',
  })
  @IsUUID('4')
  productId!: string;

  @ApiProperty({ example: 2, minimum: 1, maximum: 20 })
  @IsInt()
  @Min(1)
  @Max(20)
  quantity!: number;

  @ApiProperty({
    example: ['00000000-0000-4000-8000-000000000401'],
    description: '所选规格选项 ID，最多 10 个',
    type: [String],
  })
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('4', { each: true })
  optionIds!: string[];
}

export class QuoteDto {
  @ApiProperty({ type: [QuoteItemDto], description: '购物车行，1–20 行' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => QuoteItemDto)
  items!: QuoteItemDto[];

  @ApiProperty({ enum: PickupTimeType, example: PickupTimeType.ASAP })
  @IsEnum(PickupTimeType)
  pickupTimeType!: PickupTimeType;

  @ApiPropertyOptional({
    example: '2026-11-08T14:30:00+08:00',
    description: '预约取餐时间；pickupTimeType=SCHEDULED 时必填',
  })
  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;
}
