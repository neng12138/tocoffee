import { Type, Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class BusinessHourDto {
  @IsInt()
  @Min(1)
  @Max(7)
  day!: number;

  @Matches(HHMM, { message: 'open 格式应为 HH:mm' })
  open!: string;

  @Matches(HHMM, { message: 'close 格式应为 HH:mm' })
  close!: string;
}

export class UpdateStoreDto {
  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 80)
  name?: string;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 255)
  address?: string;

  @ApiPropertyOptional({ description: '门店电话，可留空' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Matches(/^[0-9+\-\s]{5,32}$/, { message: '电话格式不正确' })
  phone?: string;

  @ApiPropertyOptional({ type: [BusinessHourDto], description: '最多 7 天；休息日不传' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => BusinessHourDto)
  businessHours?: BusinessHourDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isAcceptingOrders?: boolean;

  @ApiPropertyOptional({ minimum: 1, maximum: 120 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(120)
  prepMinutes?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 60 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  perOrderMinutes?: number;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  pickupNotice?: string;

  @ApiPropertyOptional({ description: '取餐码前缀，1–4 位字母或数字', example: 'A' })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @Matches(/^[A-Z0-9]{1,4}$/, { message: '取餐码前缀只能是 1–4 位字母或数字' })
  pickupCodePrefix?: string;
}
