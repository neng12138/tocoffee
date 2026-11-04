import { Injectable } from '@nestjs/common';
import { AppError } from '../../../common/errors/app-error.js';
import { ERROR_CODES } from '../../../common/errors/error-codes.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { StoresService } from '../../stores/services/stores.service.js';
import {
  toMenuCategory,
  toProductDetail,
} from '../mappers/catalog.mapper.js';
import type {
  MenuPublic,
  ProductDetailPublic,
} from '../types/catalog.types.js';

const PUBLIC_PRODUCT_STATUSES = ['ON_SALE', 'SOLD_OUT'] as const;

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storesService: StoresService,
  ) {}

  async getMenu(): Promise<MenuPublic> {
    const store = await this.storesService.getStore();

    const categories = await this.prisma.category.findMany({
      where: {
        storeId: store.id,
        status: 'ACTIVE',
      },
      orderBy: { sort: 'asc' },
      include: {
        products: {
          where: { status: { in: [...PUBLIC_PRODUCT_STATUSES] } },
          orderBy: { sort: 'asc' },
          include: {
            specGroups: {
              orderBy: { sort: 'asc' },
              include: {
                group: {
                  include: {
                    options: { orderBy: { sort: 'asc' } },
                  },
                },
              },
            },
          },
        },
      },
    });

    return {
      categories: categories.map(toMenuCategory),
    };
  }

  async getProduct(productId: string): Promise<ProductDetailPublic> {
    const store = await this.storesService.getStore();

    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        storeId: store.id,
        status: { in: [...PUBLIC_PRODUCT_STATUSES] },
      },
      include: {
        category: {
          select: { id: true, name: true },
        },
        specGroups: {
          orderBy: { sort: 'asc' },
          include: {
            group: {
              include: {
                options: { orderBy: { sort: 'asc' } },
              },
            },
          },
        },
      },
    });

    if (!product) {
      throw new AppError(ERROR_CODES.NOT_FOUND, '商品不存在或已下架', 404);
    }

    return toProductDetail(product);
  }
}
