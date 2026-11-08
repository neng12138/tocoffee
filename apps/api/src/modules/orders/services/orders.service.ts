import { Injectable } from '@nestjs/common';
import {
  ActorType,
  OrderStatus,
  PickupTimeType,
  PickupType,
  Prisma,
} from '@prisma/client';
import { randomInt } from 'node:crypto';
import { AppError } from '../../../common/errors/app-error.js';
import { ERROR_CODES } from '../../../common/errors/error-codes.js';
import { getZonedNow } from '../../../common/utils/time.js';
import { PrismaService } from '../../../database/prisma.service.js';
import type { StorePublic } from '../../stores/types/store.types.js';
import { StoresService } from '../../stores/services/stores.service.js';
import type { CreateOrderDto } from '../dto/create-order.dto.js';
import type { QuoteDto } from '../dto/quote.dto.js';
import {
  toOrderPublic,
  type OrderWithRelations,
} from '../mappers/order.mapper.js';
import type { OrderPublic } from '../types/order.types.js';
import type {
  PricingProduct,
  QuoteResult,
} from '../types/pricing.types.js';
import { PricingService } from './pricing.service.js';

const ORDER_EXPIRY_MINUTES = 15;
const MAX_ORDER_NO_ATTEMPTS = 3;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

function toBusinessDate(value: Date): Date {
  const { date } = getZonedNow(value);
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatOrderNo(now: Date): string {
  const local = new Date(now.getTime() + 8 * 60 * 60_000);
  const year = String(local.getUTCFullYear()).slice(-2);
  const month = String(local.getUTCMonth() + 1).padStart(2, '0');
  const day = String(local.getUTCDate()).padStart(2, '0');
  const hour = String(local.getUTCHours()).padStart(2, '0');
  const minute = String(local.getUTCMinutes()).padStart(2, '0');
  const second = String(local.getUTCSeconds()).padStart(2, '0');
  const random = String(randomInt(0, 10_000)).padStart(4, '0');

  return `T${year}${month}${day}${hour}${minute}${second}${random}`;
}

function calculateReleaseAt(
  scheduledAt: Date,
  prepMinutes: number,
  now: Date,
): Date {
  const leadMinutes = Math.max(10, Math.max(0, prepMinutes) + 2);
  const target = scheduledAt.getTime() - leadMinutes * 60_000;
  return new Date(Math.max(now.getTime(), target));
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storesService: StoresService,
    private readonly pricingService: PricingService,
  ) {}

  async quote(dto: QuoteDto): Promise<QuoteResult> {
    const result = await this.buildQuote(dto);
    return result.quote;
  }

  async create(
    dto: CreateOrderDto,
    memberId: string,
    rawIdempotencyKey: string | undefined,
  ): Promise<OrderPublic> {
    const idempotencyKey = this.readIdempotencyKey(rawIdempotencyKey);

    const existing = await this.findByIdempotency(memberId, idempotencyKey);
    if (existing) {
      return toOrderPublic(existing);
    }

    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
    });
    if (!member) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, '会员不存在', 401);
    }

    const { quote, store, now } = await this.buildQuote(dto);
    if (dto.expectedTotalCents !== quote.payableCents) {
      throw new AppError(
        ERROR_CODES.PRICE_CHANGED,
        '商品价格已变化，请刷新报价后重试',
        409,
        { quote },
      );
    }

    const businessDate = toBusinessDate(quote.scheduledAt ?? now);
    const releaseAt = quote.scheduledAt
      ? calculateReleaseAt(quote.scheduledAt, store.prepMinutes, now)
      : null;
    const expiresAt = new Date(
      now.getTime() + ORDER_EXPIRY_MINUTES * 60_000,
    );
    const contactPhone = dto.contactPhone || member.phone;
    const contactName = dto.contactName || member.nickname;

    for (let attempt = 0; attempt < MAX_ORDER_NO_ATTEMPTS; attempt += 1) {
      const orderNo = formatOrderNo(now);

      try {
        const created = await this.prisma.$transaction(async (tx) => {
          return tx.order.create({
            data: {
              orderNo,
              storeId: store.id,
              memberId,
              status: OrderStatus.PENDING_PAYMENT,
              pickupType: PickupType.SELF_PICKUP,
              pickupTimeType: dto.pickupTimeType,
              scheduledAt: quote.scheduledAt,
              releaseAt,
              businessDate,
              itemsAmountCents: quote.itemsAmountCents,
              discountCents: quote.discountCents,
              payableCents: quote.payableCents,
              paidCents: 0,
              remark: dto.remark || null,
              contactName: contactName || null,
              contactPhone: contactPhone || null,
              expiresAt,
              idempotencyKey,
              items: {
                create: quote.items.map((line) => ({
                  productId: line.productId,
                  productName: line.name,
                  productImage: line.imageUrl,
                  specSnapshot:
                    line.options as unknown as Prisma.InputJsonValue,
                  specText: line.specText,
                  unitPriceCents: line.unitPriceCents,
                  quantity: line.quantity,
                  totalCents: line.totalCents,
                })),
              },
              events: {
                create: {
                  toStatus: OrderStatus.PENDING_PAYMENT,
                  actorType: ActorType.CUSTOMER,
                  actorId: memberId,
                  note: '创建订单',
                },
              },
            },
            include: {
              items: true,
              events: { orderBy: { createdAt: 'asc' } },
            },
          });
        });

        return toOrderPublic(created);
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          const duplicate = await this.findByIdempotency(
            memberId,
            idempotencyKey,
          );
          if (duplicate) {
            return toOrderPublic(duplicate);
          }

          // order_no 碰撞时换一个随机尾号重试。
          continue;
        }

        throw error;
      }
    }

    throw new AppError(
      ERROR_CODES.INTERNAL_ERROR,
      '创建订单失败，请稍后重试',
      500,
    );
  }

  private readIdempotencyKey(raw: string | undefined): string {
    const key = raw?.trim();
    if (!key) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        '缺少 Idempotency-Key 请求头',
        400,
      );
    }
    if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        'Idempotency-Key 必须为 8–64 位字母、数字、下划线或连字符',
        400,
      );
    }
    return key;
  }

  private findByIdempotency(
    memberId: string,
    idempotencyKey: string,
  ): Promise<OrderWithRelations | null> {
    return this.prisma.order.findFirst({
      where: { memberId, idempotencyKey },
      include: {
        items: true,
        events: { orderBy: { createdAt: 'asc' } },
      },
    });
  }

  private async buildQuote(dto: QuoteDto): Promise<{
    quote: QuoteResult;
    store: StorePublic;
    now: Date;
  }> {
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

    const quote = this.pricingService.quote({
      items: dto.items,
      products: pricingProducts,
      store,
      pickupTimeType: dto.pickupTimeType,
      scheduledAt,
      now,
      queueCount,
    });

    return { quote, store, now };
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
