import { Injectable } from '@nestjs/common';
import { OrderStatus, PickupTimeType } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service.js';
import { StoresService } from '../../stores/services/stores.service.js';
import type { QuoteDto } from '../dto/quote.dto.js';
import type {
  PricingProduct,
  QuoteResult,
} from '../types/pricing.types.js';
import { PricingService } from './pricing.service.js';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storesService: StoresService,
    private readonly pricingService: PricingService,
  ) {}

  async quote(dto: QuoteDto): Promise<QuoteResult> {
    const store = await this.storesService.getStore();
    const productIds = [...new Set(dto.items.map((item) => item.productId))];

    const products = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
        storeId: store.id,
      },
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
    });

    const pricingProducts: PricingProduct[] = products.map((product) => ({
      id: product.id,
      name: product.name,
      imageUrl: product.imageUrl,
      basePriceCents: product.basePriceCents,
      status: product.status,
      specGroups: product.specGroups.map((link) => ({
        id: link.group.id,
        name: link.group.name,
        required: link.group.required,
        multiSelect: link.group.multiSelect,
        minSelect: link.group.minSelect,
        maxSelect: link.group.maxSelect,
        options: link.group.options.map((option) => ({
          id: option.id,
          name: option.name,
          priceDeltaCents: option.priceDeltaCents,
          isAvailable: option.isAvailable,
        })),
      })),
    }));

    const now = new Date();
    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    const queueCount =
      dto.pickupTimeType === PickupTimeType.ASAP
        ? await this.countQueue(store.id)
        : 0;

    return this.pricingService.quote({
      items: dto.items,
      products: pricingProducts,
      store,
      pickupTimeType: dto.pickupTimeType,
      scheduledAt,
      now,
      queueCount,
    });
  }

  private countQueue(storeId: string): Promise<number> {
    return this.prisma.order.count({
      where: {
        storeId,
        status: { in: [OrderStatus.PAID, OrderStatus.ACCEPTED] },
        OR: [
          { pickupTimeType: PickupTimeType.ASAP },
          { releasedAt: { not: null } },
        ],
      },
    });
  }
}
