import { Injectable } from '@nestjs/common';
import { StaffRole, type Prisma } from '@prisma/client';
import { AppError } from '../../../common/errors/app-error.js';
import { ERROR_CODES } from '../../../common/errors/error-codes.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { toAdminStore } from '../mappers/admin-store.mapper.js';
import type { AdminStorePublic } from '../types/admin-store.types.js';
import type { UpdateStoreDto } from '../dto/update-store.dto.js';

@Injectable()
export class AdminStoresService {
  constructor(private readonly prisma: PrismaService) {}

  async getStore(storeId: string): Promise<AdminStorePublic> {
    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (!store) {
      throw new AppError(ERROR_CODES.NOT_FOUND, '门店不存在', 404);
    }

    return toAdminStore(store);
  }

  async updateStore(
    storeId: string,
    role: StaffRole,
    dto: UpdateStoreDto,
  ): Promise<AdminStorePublic> {
    if (role !== StaffRole.OWNER) {
      throw new AppError(ERROR_CODES.FORBIDDEN, '仅店主可修改门店设置', 403);
    }

    if (dto.businessHours !== undefined) {
      this.assertBusinessHours(dto.businessHours);
    }

    const data: Prisma.StoreUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.businessHours !== undefined) {
      data.businessHours = dto.businessHours as unknown as Prisma.InputJsonValue;
    }
    if (dto.isAcceptingOrders !== undefined) {
      data.isAcceptingOrders = dto.isAcceptingOrders;
    }
    if (dto.prepMinutes !== undefined) data.prepMinutes = dto.prepMinutes;
    if (dto.perOrderMinutes !== undefined) {
      data.perOrderMinutes = dto.perOrderMinutes;
    }
    if (dto.pickupNotice !== undefined) {
      data.pickupNotice = dto.pickupNotice.trim() || null;
    }
    if (dto.pickupCodePrefix !== undefined) {
      data.pickupCodePrefix = dto.pickupCodePrefix;
    }

    const store = await this.prisma.store.update({
      where: { id: storeId },
      data,
    });

    return toAdminStore(store);
  }

  private assertBusinessHours(hours: { day: number; open: string; close: string }[]): void {
    const days = new Set<number>();

    for (const entry of hours) {
      if (days.has(entry.day)) {
        throw new AppError(
          ERROR_CODES.VALIDATION_ERROR,
          `营业时间第 ${entry.day} 天重复`,
          400,
        );
      }
      days.add(entry.day);

      if (entry.open >= entry.close) {
        throw new AppError(
          ERROR_CODES.VALIDATION_ERROR,
          `第 ${entry.day} 天的打烊时间必须晚于开门时间`,
          400,
        );
      }
    }
  }
}
