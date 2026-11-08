import { Injectable } from '@nestjs/common';
import {
  ActorType,
  OrderStatus,
  PickupTimeType,
  Prisma,
} from '@prisma/client';
import { AppError } from '../../../common/errors/app-error.js';
import { ERROR_CODES } from '../../../common/errors/error-codes.js';
import { getZonedNow } from '../../../common/utils/time.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { PaymentsService } from '../../payments/services/payments.service.js';
import type { AdminListOrdersDto } from '../dto/admin-list-orders.dto.js';
import type { RejectOrderDto } from '../dto/reject-order.dto.js';
import {
  toOrderPublic,
  type OrderWithRelations,
} from '../mappers/order.mapper.js';
import { AdminOrderTab } from '../types/admin-order.types.js';
import type { OrderPublic } from '../types/order.types.js';

const ACTIVE_STATUSES: OrderStatus[] = [
  OrderStatus.PAID,
  OrderStatus.ACCEPTED,
  OrderStatus.READY,
];

const STORE_VISIBLE_STATUSES: OrderStatus[] = [
  OrderStatus.PAID,
  OrderStatus.ACCEPTED,
  OrderStatus.READY,
  OrderStatus.COMPLETED,
  OrderStatus.NO_SHOW,
  OrderStatus.REFUNDING,
  OrderStatus.REFUNDED,
];

const REJECTABLE_STATUSES: OrderStatus[] = [
  OrderStatus.PAID,
  OrderStatus.ACCEPTED,
  OrderStatus.READY,
  OrderStatus.NO_SHOW,
];

@Injectable()
export class AdminOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
  ) {}

  async list(storeId: string, query: AdminListOrdersDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const filters: Prisma.OrderWhereInput[] = [
      {
        storeId,
        businessDate: this.resolveBusinessDate(query.date),
      },
    ];
    if (query.type) {
      filters.push({ pickupTimeType: query.type });
    }

    const keyword = query.keyword?.trim();
    if (keyword) {
      filters.push({
        OR: [
          { orderNo: { contains: keyword, mode: 'insensitive' } },
          { contactName: { contains: keyword, mode: 'insensitive' } },
          { contactPhone: { contains: keyword } },
          { pickupCode: { contains: keyword, mode: 'insensitive' } },
        ],
      });
    }

    const tab = query.tab ?? AdminOrderTab.ACTIVE;
    const tabWhere = this.tabWhere(tab);
    const listWhere: Prisma.OrderWhereInput = {
      AND: [...filters, tabWhere],
      ...(query.status ? { status: query.status } : {}),
    };

    const [total, orders, active, scheduled, all] =
      await this.prisma.$transaction([
        this.prisma.order.count({ where: listWhere }),
        this.prisma.order.findMany({
          where: listWhere,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            items: true,
            events: { orderBy: { createdAt: 'asc' } },
          },
        }),
        this.prisma.order.count({
          where: {
            AND: [...filters, this.tabWhere(AdminOrderTab.ACTIVE)],
          },
        }),
        this.prisma.order.count({
          where: {
            AND: [...filters, this.tabWhere(AdminOrderTab.SCHEDULED)],
          },
        }),
        this.prisma.order.count({
          where: {
            AND: [...filters, this.tabWhere(AdminOrderTab.ALL)],
          },
        }),
      ]);

    return {
      items: orders.map(toOrderPublic),
      total,
      page,
      pageSize,
      counts: { active, scheduled, all },
    };
  }

  async detail(storeId: string, orderId: string): Promise<OrderPublic> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, storeId },
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

  accept(storeId: string, orderId: string, staffId: string): Promise<OrderPublic> {
    return this.transition({
      storeId,
      orderId,
      staffId,
      fromStatuses: [OrderStatus.PAID],
      toStatus: OrderStatus.ACCEPTED,
      data: { acceptedAt: new Date() },
      note: '店员接单',
      requireReleased: true,
    });
  }

  ready(storeId: string, orderId: string, staffId: string): Promise<OrderPublic> {
    return this.transition({
      storeId,
      orderId,
      staffId,
      fromStatuses: [OrderStatus.ACCEPTED],
      toStatus: OrderStatus.READY,
      data: { readyAt: new Date() },
      note: '已出杯',
    });
  }

  complete(
    storeId: string,
    orderId: string,
    staffId: string,
  ): Promise<OrderPublic> {
    return this.transition({
      storeId,
      orderId,
      staffId,
      fromStatuses: [OrderStatus.READY],
      toStatus: OrderStatus.COMPLETED,
      data: { completedAt: new Date() },
      note: '顾客已取餐',
    });
  }

  async reject(
    storeId: string,
    orderId: string,
    staffId: string,
    dto: RejectOrderDto,
  ): Promise<OrderPublic> {
    const reason = dto.reason.trim();
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const order = await this.findStoreOrder(tx, storeId, orderId);
      if (!REJECTABLE_STATUSES.includes(order.status)) {
        throw new AppError(
          ERROR_CODES.ORDER_INVALID_STATUS,
          '当前订单不可拒单退款',
          409,
          { status: order.status },
        );
      }

      const changed = await tx.order.updateMany({
        where: { id: order.id, storeId, status: order.status },
        data: { status: OrderStatus.REFUNDING },
      });
      if (changed.count === 0) {
        throw new AppError(
          ERROR_CODES.ORDER_INVALID_STATUS,
          '订单状态已变化，请刷新后重试',
          409,
        );
      }

      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: OrderStatus.REFUNDING,
          actorType: ActorType.STAFF,
          actorId: staffId,
          note: `拒单退款：${reason}`,
        },
      });

      await this.paymentsService.refund(tx, order.id, reason, now);

      return toOrderPublic(
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: OrderStatus.REFUNDED,
            events: {
              create: {
                fromStatus: OrderStatus.REFUNDING,
                toStatus: OrderStatus.REFUNDED,
                actorType: ActorType.STAFF,
                actorId: staffId,
                note: '退款完成',
              },
            },
          },
          include: {
            items: true,
            events: { orderBy: { createdAt: 'asc' } },
          },
        }),
      );
    });
  }

  private async transition(input: {
    storeId: string;
    orderId: string;
    staffId: string;
    fromStatuses: OrderStatus[];
    toStatus: OrderStatus;
    data: Prisma.OrderUpdateManyMutationInput;
    note: string;
    requireReleased?: boolean;
  }): Promise<OrderPublic> {
    return this.prisma.$transaction(async (tx) => {
      const order = await this.findStoreOrder(tx, input.storeId, input.orderId);
      if (!input.fromStatuses.includes(order.status)) {
        throw new AppError(
          ERROR_CODES.ORDER_INVALID_STATUS,
          '当前订单状态不可执行该操作',
          409,
          { status: order.status },
        );
      }

      if (input.requireReleased && this.isUnreleasedScheduled(order)) {
        throw new AppError(
          ERROR_CODES.ORDER_NOT_RELEASED,
          '预约单尚未到释放时间，暂时不能接单',
          409,
          { releaseAt: order.releaseAt?.toISOString() ?? null },
        );
      }

      const changed = await tx.order.updateMany({
        where: {
          id: order.id,
          storeId: input.storeId,
          status: order.status,
          ...(input.requireReleased
            ? {
                OR: [
                  { pickupTimeType: PickupTimeType.ASAP },
                  { releasedAt: { not: null } },
                ],
              }
            : {}),
        },
        data: {
          ...input.data,
          status: input.toStatus,
        },
      });

      if (changed.count === 0) {
        const current = await this.findStoreOrder(
          tx,
          input.storeId,
          input.orderId,
        );
        if (input.requireReleased && this.isUnreleasedScheduled(current)) {
          throw new AppError(
            ERROR_CODES.ORDER_NOT_RELEASED,
            '预约单尚未到释放时间，暂时不能接单',
            409,
            { releaseAt: current.releaseAt?.toISOString() ?? null },
          );
        }
        throw new AppError(
          ERROR_CODES.ORDER_INVALID_STATUS,
          '订单状态已变化，请刷新后重试',
          409,
          { status: current.status },
        );
      }

      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: input.toStatus,
          actorType: ActorType.STAFF,
          actorId: input.staffId,
          note: input.note,
        },
      });

      const updated = await tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: {
          items: true,
          events: { orderBy: { createdAt: 'asc' } },
        },
      });
      return toOrderPublic(updated);
    });
  }

  private findStoreOrder(
    tx: Prisma.TransactionClient,
    storeId: string,
    orderId: string,
  ): Promise<OrderWithRelations> {
    return tx.order
      .findFirst({
        where: { id: orderId, storeId },
        include: {
          items: true,
          events: { orderBy: { createdAt: 'asc' } },
        },
      })
      .then((order) => {
        if (!order) {
          throw new AppError(ERROR_CODES.NOT_FOUND, '订单不存在', 404);
        }
        return order;
      });
  }

  private isUnreleasedScheduled(order: {
    pickupTimeType: PickupTimeType;
    releasedAt: Date | null;
  }): boolean {
    return order.pickupTimeType === PickupTimeType.SCHEDULED && !order.releasedAt;
  }

  private tabWhere(tab: AdminOrderTab): Prisma.OrderWhereInput {
    if (tab === AdminOrderTab.ACTIVE) {
      return {
        status: { in: ACTIVE_STATUSES },
        OR: [
          { pickupTimeType: PickupTimeType.ASAP },
          { releasedAt: { not: null } },
        ],
      };
    }
    if (tab === AdminOrderTab.SCHEDULED) {
      return {
        status: OrderStatus.PAID,
        pickupTimeType: PickupTimeType.SCHEDULED,
        releasedAt: null,
      };
    }
    return { status: { in: STORE_VISIBLE_STATUSES } };
  }

  private resolveBusinessDate(date?: string): Date {
    const value = date ?? getZonedNow(new Date()).date;
    return new Date(`${value}T00:00:00.000Z`);
  }
}
