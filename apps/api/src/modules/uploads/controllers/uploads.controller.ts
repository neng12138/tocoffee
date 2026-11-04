import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { StaffJwtGuard } from '../../../common/auth/staff-jwt.guard.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ERROR_CODES } from '../../../common/errors/error-codes.js';
import { UploadsService } from '../services/uploads.service.js';

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

@ApiTags('管理端-上传')
@ApiBearerAuth()
@UseGuards(StaffJwtGuard)
@Controller('admin/uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post()
  @ApiOperation({ summary: '上传商品图片（jpg/png/webp，≤2MB）' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_request, _file, callback) => {
          const now = new Date();
          const month = String(now.getMonth() + 1).padStart(2, '0');
          const directory = join(
            process.cwd(),
            'uploads',
            'products',
            String(now.getFullYear()),
            month,
          );
          mkdirSync(directory, { recursive: true });
          callback(null, directory);
        },
        filename: (_request, file, callback) => {
          const extension = EXTENSIONS[file.mimetype] ?? '.bin';
          callback(null, `${randomUUID()}${extension}`);
        },
      }),
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (_request, file, callback) => {
        if (!EXTENSIONS[file.mimetype]) {
          callback(new BadRequestException('仅支持 jpg/png/webp 图片'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new AppError(ERROR_CODES.UPLOAD_INVALID, '请选择图片文件', 400);
    }

    return { url: this.uploads.toPublicUrl(file) };
  }
}
