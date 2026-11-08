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
import type { CancelOrderDto } from '../dto/cancel-order.dto.js';
import type { CreateOrderDto } from '../dto/create-order.dto.js';
import type { ListOrdersDto } from '../dto/list-orders.dto.js';
import type { QuoteDto } from '../dto/quote.dto.js';
import { PaymentsService } from '../../payments/services/payments.service.js';
import {
  toOrderPublic,
  type OrderWithRelations,
} from '../mappers/order.mapper.js';
import type { OrderPublic } from '../types/order.types.js';
import type {
  PricingProduct,
  QuoteResult,
} from '../types/pricing.types.js';
import { PickupCodeService } from './pickup-code.service.js';
import { PricingService } from './pricing.service.js';

const ORDER_EXPIRY_MINUTES = 15;
const MAX_ASAP_READY_MINUTES = 30;
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
    private readonly paymentsService: PaymentsService,
    private readonly pickupCodeService: PickupCodeService,
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

  async list(memberId: string, query: ListOrdersDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.OrderWhereInput = {
      memberId,
      ...(query.status ? { status: query.status } : {}),
    };

    const [total, orders] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          items: true,
          events: { orderBy: { createdAt: 'asc' } },
        },
      }),
    ]);

    return {
      items: orders.map(toOrderPublic),
      total,
      page,
      pageSize,
    };
  }

  async detail(memberId: string, orderId: string): Promise<OrderPublic> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, memberId },
      include: {
        items: true,
        events: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!order) {
      throw new AppError(ERROR_CODES.NOT_FOUND, '订单不存在', 404);
    }

    return toOrderPublic(order);
  }

  async pay(orderId: string, memberId: string): Promise<OrderPublic> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const locked = await tx.$queryRaw<Array<{ id: string }>>`
            SELECT id FROM orders
            WHERE id = ${orderId}::uuid AND member_id = ${memberId}::uuid
            FOR UPDATE
          `;
          if (!locked.length) {
            throw new AppError(ERROR_CODES.NOT_FOUND, '订单不存在', 404);
          }

          const order = await tx.order.findUniqueOrThrow({
            where: { id: orderId },
            include: {
              items: true,
              events: { orderBy: { createdAt: 'asc' } },
            },
          });

          // 重复支付直接返回当前订单，不重复写支付记录。
          if (order.status === OrderStatus.PAID) {
            return toOrderPublic(order);
          }
          if (order.status !== OrderStatus.PENDING_PAYMENT) {
            throw new AppError(
              ERROR_CODES.ORDER_NOT_PAYABLE,
              '当前订单不可支付',
              409,
              { status: order.status },
            );
          }

          const now = new Date();
          if (order.expiresAt.getTime() <= now.getTime()) {
            throw new AppError(
              ERROR_CODES.ORDER_EXPIRED,
              '订单已超时关闭，请重新下单',
              409,
            );
          }

          const store = await tx.store.findUniqueOrThrow({
            where: { id: order.storeId },
          });
          const scheduledAt =
            order.pickupTimeType === PickupTimeType.SCHEDULED
              ? order.scheduledAt
              : null;
          const businessDate = toBusinessDate(scheduledAt ?? now);
          const releaseAt = scheduledAt
            ? calculateReleaseAt(scheduledAt, store.prepMinutes, now)
            : null;

          const queueCount = await tx.order.count({
            where: {
              storeId: order.storeId,
              status: { in: [OrderStatus.PAID, OrderStatus.ACCEPTED] },
              OR: [
                { pickupTimeType: PickupTimeType.ASAP },
                { releasedAt: { not: null } },
              ],
            },
          });

          const estimatedReadyAt = scheduledAt
            ? scheduledAt
            : new Date(
                now.getTime() +
                  Math.min(
                    MAX_ASAP_READY_MINUTES,
                    store.prepMinutes +
                      queueCount * store.perOrderMinutes,
                  ) *
                    60_000,
              );

          const seq = await this.nextPickupSequence(
            tx,
            store.id,
            businessDate,
          );
          const pickupCode = this.pickupCodeService.format(
            store.pickupCodePrefix,
            seq,
          );

          await this.paymentsService.charge(
            tx,
            order.id,
            order.payableCents,
            now,
          );

          const updated = await tx.order.update({
            where: { id: order.id },
            data: {
              status: OrderStatus.PAID,
              paidCents: order.payableCents,
              paidAt: now,
              businessDate,
              releaseAt,
              pickupCode,
              estimatedReadyAt,
              events: {
                create: {
                  fromStatus: OrderStatus.PENDING_PAYMENT,
                  toStatus: OrderStatus.PAID,
                  actorType: ActorType.CUSTOMER,
                  actorId: memberId,
                  note: '支付成功',
                },
              },
            },
            include: {
              items: true,
              events: { orderBy: { createdAt: 'asc' } },
            },
          });

          return toOrderPublic(updated);
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002' &&
          attempt === 0
        ) {
          continue;
        }
        throw error;
      }
    }

    throw new AppError(
      ERROR_CODES.INTERNAL_ERROR,
      '支付处理失败，请稍后重试',
      500,
    );
  }

  async cancel(
    orderId: string,
    memberId: string,
    dto: CancelOrderDto,
  ): Promise<OrderPublic> {
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const changed = await tx.order.updateMany({
        where: {
          id: orderId,
          memberId,
          status: OrderStatus.PENDING_PAYMENT,
        },
        data: {
          status: OrderStatus.CANCELED,
          canceledAt: now,
          cancelReason: dto.reason?.trim() || '用户取消订单',
        },
      });

      if (changed.count === 0) {
        const current = await tx.order.findFirst({
          where: { id: orderId, memberId },
          select: { status: true },
        });
        if (!current) {
          throw new AppError(ERROR_CODES.NOT_FOUND, '订单不存在', 404);
        }
        throw new AppError(
          ERROR_CODES.ORDER_INVALID_STATUS,
          '当前订单不可取消',
          409,
          { status: current.status },
        );
      }

      await tx.orderEvent.create({
        data: {
          orderId,
          fromStatus: OrderStatus.PENDING_PAYMENT,
          toStatus: OrderStatus.CANCELED,
          actorType: ActorType.CUSTOMER,
          actorId: memberId,
          note: dto.reason?.trim() || '用户取消订单',
        },
      });

      const updated = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: {
          items: true,
          events: { orderBy: { createdAt: 'asc' } },
        },
      });

      return toOrderPublic(updated);
    });
  }

  private async nextPickupSequence(
    tx: Prisma.TransactionClient,
    storeId: string,
    businessDate: Date,
  ): Promise<number> {
    const dateKey = businessDate.toISOString().slice(0, 10);
    const rows = await tx.$queryRaw<Array<{ last_seq: number }>>`
      INSERT INTO pickup_counters (store_id, business_date, last_seq)
      VALUES (${storeId}::uuid, ${dateKey}::date, 1)
      ON CONFLICT (store_id, business_date)
      DO UPDATE SET last_seq = pickup_counters.last_seq + 1
      RETURNING last_seq
    `;

    if (!rows.length) {
      throw new AppError(
        ERROR_CODES.INTERNAL_ERROR,
        '取餐码生成失败，请稍后重试',
        500,
      );
    }

    return rows[0].last_seq;
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
