import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { QuoteDto } from './quote.dto.js';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateOrderDto extends QuoteDto {
  @ApiProperty({
    example: 5800,
    description: '客户端 quote 得到的应付金额（分），用于检测价格变化',
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  expectedTotalCents!: number;

  @ApiPropertyOptional({
    example: '少冰，谢谢',
    description: '订单备注，最多 50 字',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(trim)
  remark?: string;

  @ApiPropertyOptional({
    example: '林小姐',
    description: '联系人姓名，默认取会员昵称',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(trim)
  contactName?: string;

  @ApiPropertyOptional({
    example: '13900000021',
    description: '联系人手机号，默认取登录手机号',
  })
  @IsOptional()
  @IsString()
  @Matches(/^1[3-9]\d{9}$/, { message: '联系人手机号格式不正确' })
  @Transform(trim)
  contactPhone?: string;
}
