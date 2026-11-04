import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'admin123' })
  @IsString({ message: '原密码格式不正确' })
  @MinLength(6, { message: '原密码至少 6 位' })
  @MaxLength(72, { message: '原密码过长' })
  oldPassword!: string;

  @ApiProperty({ example: 'newPass123' })
  @IsString({ message: '新密码格式不正确' })
  @MinLength(8, { message: '新密码至少 8 位' })
  @MaxLength(72, { message: '新密码过长' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).{8,72}$/, {
    message: '新密码至少 8 位，且同时包含字母和数字',
  })
  newPassword!: string;
}
