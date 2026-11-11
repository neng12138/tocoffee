import { Injectable } from '@nestjs/common';
import { OrderStatus, PickupTimeType, RefundStatus } from '@prisma/client';
import { AppError } from '../../../common/errors/app-error.js';
import { ERROR_CODES } from '../../../common/errors/error-codes.js';
import { getShanghaiDayRange } from '../../../common/utils/time.js';
import { PrismaService } from '../../../database/prisma.service.js';
import type { DashboardSummary } from '../types/dashboard.types.js';
import { calculateAverageOrderCents } from './dashboard.utils.js';

const PAID_STATUSES = {
  notIn: [OrderStatus.PENDING_PAYMENT, OrderStatus.CANCELED],
};

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(storeId: string, date?: string): Promise<DashboardSummary> {
    let range;
    try {
      range = getShanghaiDayRange(date);
    } catch {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, '统计日期不正确', 400);
    }

    const paidWhere = {
      storeId,
      status: PAID_STATUSES,
      paidAt: { gte: range.start, lt: range.end },
    };

    const [paid, refunds, pendingAcceptCount, pendingPickupCount, recentOrders] =
      await Promise.all([
        this.prisma.order.aggregate({
          where: paidWhere,
          _sum: { paidCents: true },
          _count: { _all: true },
        }),
        this.prisma.refund.aggregate({
          where: {
            status: RefundStatus.SUCCESS,
            completedAt: { gte: range.start, lt: range.end },
            order: { storeId },
          },
          _sum: { amountCents: true },
        }),
        this.prisma.order.count({
          where: {
            storeId,
            status: OrderStatus.PAID,
            OR: [
              { pickupTimeType: PickupTimeType.ASAP },
              { releasedAt: { not: null } },
            ],
          },
        }),
        this.prisma.order.count({
          where: { storeId, status: OrderStatus.READY },
        }),
        this.prisma.order.findMany({
          where: { storeId, status: PAID_STATUSES },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            orderNo: true,
            status: true,
            pickupTimeType: true,
            pickupCode: true,
            paidCents: true,
            paidAt: true,
            createdAt: true,
            contactName: true,
          },
        }),
      ]);

    const revenueCents =
      (paid._sum.paidCents ?? 0) - (refunds._sum.amountCents ?? 0);
    const orderCount = paid._count._all;

    return {
      date: range.date,
      revenueCents,
      orderCount,
      averageOrderCents: calculateAverageOrderCents(revenueCents, orderCount),
      pendingAcceptCount,
      pendingPickupCount,
      recentOrders: recentOrders.map((order) => ({
        ...order,
        paidAt: order.paidAt?.toISOString() ?? null,
        createdAt: order.createdAt.toISOString(),
      })),
    };
  }
}
