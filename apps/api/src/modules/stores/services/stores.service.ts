import { Injectable } from '@nestjs/common';
import { AppError } from '../../../common/errors/app-error.js';
import { ERROR_CODES } from '../../../common/errors/error-codes.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { toStorePublic } from '../mappers/store.mapper.js';
import type { StorePublic } from '../types/store.types.js';

@Injectable()
export class StoresService {
  constructor(private readonly prisma: PrismaService) {}

  async getStore(): Promise<StorePublic> {
    const store = await this.prisma.store.findFirst({
      orderBy: { createdAt: 'asc' },
    });

    if (!store) {
      throw new AppError(ERROR_CODES.NOT_FOUND, '门店不存在', 404);
    }

    return toStorePublic(store);
  }
}
