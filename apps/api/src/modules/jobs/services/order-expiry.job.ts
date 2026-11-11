import { Injectable } from '@nestjs/common';
import { ActorType, OrderStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service.js';

const BATCH_SIZE = 200;

@Injectable()
export class OrderExpiryJob {
  constructor(private readonly prisma: PrismaService) {}

  async run(now = new Date()): Promise<number> {
    let canceled = 0;

    for (;;) {
      const candidates = await this.prisma.order.findMany({
        where: {
          status: OrderStatus.PENDING_PAYMENT,
          expiresAt: { lte: now },
        },
        select: { id: true },
        orderBy: { expiresAt: 'asc' },
        take: BATCH_SIZE,
      });

      if (candidates.length === 0) {
        break;
      }

      let canceledInBatch = 0;

      for (const candidate of candidates) {
        const didCancel = await this.prisma.$transaction(async (tx) => {
          const updated = await tx.order.updateMany({
            where: {
              id: candidate.id,
              status: OrderStatus.PENDING_PAYMENT,
              expiresAt: { lte: now },
            },
            data: {
              status: OrderStatus.CANCELED,
              canceledAt: now,
              cancelReason: '支付超时自动取消',
            },
          });

          if (updated.count === 0) {
            return false;
          }

          await tx.orderEvent.create({
            data: {
              orderId: candidate.id,
              fromStatus: OrderStatus.PENDING_PAYMENT,
              toStatus: OrderStatus.CANCELED,
              actorType: ActorType.SYSTEM,
              note: '支付超时自动取消',
            },
          });

          return true;
        });

        if (didCancel) {
          canceled += 1;
          canceledInBatch += 1;
        }
      }

      if (candidates.length < BATCH_SIZE || canceledInBatch === 0) {
        break;
      }
    }

    return canceled;
  }
}
