import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { relative, sep } from 'node:path';

@Injectable()
export class UploadsService {
  constructor(private readonly config: ConfigService) {}

  toPublicUrl(file: Express.Multer.File): string {
    const baseUrl = this.config
      .getOrThrow<string>('publicBaseUrl')
      .replace(/\/+$/, '');
    const relativePath = relative(process.cwd(), file.path)
      .split(sep)
      .join('/');

    return `${baseUrl}/${relativePath}`;
  }
}
