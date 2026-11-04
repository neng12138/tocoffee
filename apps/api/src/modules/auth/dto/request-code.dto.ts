import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Matches } from 'class-validator';

export class RequestCodeDto {
  @ApiProperty({ example: '13800138000' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: '手机号格式不正确' })
  @Matches(/^1[3-9]\d{9}$/, { message: '请输入正确的手机号' })
  phone!: string;
}
