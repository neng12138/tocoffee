import { Injectable } from '@nestjs/common';
import {
  ActorType,
  OrderStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service.js';
import { isClosingTime, toUtcBusinessDate } from '../utils/jobs-time.js';

const BATCH_SIZE = 200;

@Injectable()
export class NoShowJob {
  constructor(private readonly prisma: PrismaService) {}

  async run(now = new Date()): Promise<number> {
    const today = toUtcBusinessDate(now);
    const businessDateFilter: Prisma.OrderWhereInput[] = [
      { businessDate: { lt: today } },
    ];

    // 定时器在 23:59 触发；延迟到次日凌晨时，前一天会落入 lt(today)。
    if (isClosingTime(now)) {
      businessDateFilter.push({ businessDate: today });
    }

    let closed = 0;

    for (;;) {
      const candidates = await this.prisma.order.findMany({
        where: {
          status: OrderStatus.READY,
          OR: businessDateFilter,
        },
        select: { id: true },
        orderBy: { readyAt: 'asc' },
        take: BATCH_SIZE,
      });

      if (candidates.length === 0) {
        break;
      }

      let closedInBatch = 0;

      for (const candidate of candidates) {
        const didClose = await this.prisma.$transaction(async (tx) => {
          const updated = await tx.order.updateMany({
            where: {
              id: candidate.id,
              status: OrderStatus.READY,
            },
            data: {
              status: OrderStatus.NO_SHOW,
              noShowAt: now,
            },
          });

          if (updated.count === 0) {
            return false;
          }

          await tx.orderEvent.create({
            data: {
              orderId: candidate.id,
              fromStatus: OrderStatus.READY,
              toStatus: OrderStatus.NO_SHOW,
              actorType: ActorType.SYSTEM,
              note: '打烊超时未取，系统自动关闭',
            },
          });

          return true;
        });

        if (didClose) {
          closed += 1;
          closedInBatch += 1;
        }
      }

      if (candidates.length < BATCH_SIZE || closedInBatch === 0) {
        break;
      }
    }

    return closed;
  }
}
