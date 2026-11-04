import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class StaffLoginDto {
  @ApiProperty({ example: 'owner' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: '账号格式不正确' })
  @MinLength(1, { message: '请输入账号' })
  @MaxLength(50, { message: '账号过长' })
  username!: string;

  @ApiProperty({ example: 'admin123' })
  @IsString({ message: '密码格式不正确' })
  @MinLength(6, { message: '密码至少 6 位' })
  @MaxLength(72, { message: '密码过长' })
  password!: string;
}
