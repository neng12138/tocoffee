import { Injectable } from '@nestjs/common';
import {
  ActorType,
  OrderStatus,
  PickupTimeType,
} from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service.js';

const BATCH_SIZE = 200;

@Injectable()
export class ScheduledOrderReleaseJob {
  constructor(private readonly prisma: PrismaService) {}

  async run(now = new Date()): Promise<number> {
    let released = 0;

    for (;;) {
      const candidates = await this.prisma.order.findMany({
        where: {
          status: OrderStatus.PAID,
          pickupTimeType: PickupTimeType.SCHEDULED,
          releasedAt: null,
          releaseAt: { lte: now },
        },
        select: { id: true },
        orderBy: { releaseAt: 'asc' },
        take: BATCH_SIZE,
      });

      if (candidates.length === 0) {
        break;
      }

      let releasedInBatch = 0;

      for (const candidate of candidates) {
        const didRelease = await this.prisma.$transaction(async (tx) => {
          const updated = await tx.order.updateMany({
            where: {
              id: candidate.id,
              status: OrderStatus.PAID,
              pickupTimeType: PickupTimeType.SCHEDULED,
              releasedAt: null,
              releaseAt: { lte: now },
            },
            data: { releasedAt: now },
          });

          if (updated.count === 0) {
            return false;
          }

          await tx.orderEvent.create({
            data: {
              orderId: candidate.id,
              fromStatus: OrderStatus.PAID,
              toStatus: OrderStatus.PAID,
              actorType: ActorType.SYSTEM,
              note: '预约单已释放，进入待接单',
            },
          });

          return true;
        });

        if (didRelease) {
          released += 1;
          releasedInBatch += 1;
        }
      }

      // 多实例同时跑时，整批都可能被另一个实例处理掉，避免空转。
      if (candidates.length < BATCH_SIZE || releasedInBatch === 0) {
        break;
      }
    }

    return released;
  }
}
