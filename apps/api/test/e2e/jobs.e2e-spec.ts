import type { INestApplication } from '@nestjs/common';
import {
  ActorType,
  OrderStatus,
  PickupTimeType,
  PrismaClient,
} from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from '../setup/create-test-app.js';
import { NoShowJob } from '../../src/modules/jobs/services/no-show.job.js';
import { OrderExpiryJob } from '../../src/modules/jobs/services/order-expiry.job.js';
import { ScheduledOrderReleaseJob } from '../../src/modules/jobs/services/scheduled-order-release.job.js';

const ORDER_NO_PREFIX = `JOBTEST-${Date.now().toString(36)}`;
const DEFAULT_BUSINESS_DATE = new Date('2026-11-11T00:00:00.000Z');

interface CreateOrderOptions {
  status: OrderStatus;
  pickupTimeType?: PickupTimeType;
  releaseAt?: Date | null;
  releasedAt?: Date | null;
  businessDate?: Date;
  expiresAt?: Date;
  readyAt?: Date | null;
}

describe('scheduled jobs (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let storeId = '';
  let memberId = '';
  let sequence = 0;

  async function createOrder(options: CreateOrderOptions) {
    sequence += 1;

    return prisma.order.create({
      data: {
        orderNo: `${ORDER_NO_PREFIX}-${sequence}`,
        storeId,
        memberId,
        status: options.status,
        pickupTimeType: options.pickupTimeType ?? PickupTimeType.ASAP,
        releaseAt: options.releaseAt ?? null,
        releasedAt: options.releasedAt ?? null,
        businessDate: options.businessDate ?? DEFAULT_BUSINESS_DATE,
        itemsAmountCents: 2200,
        discountCents: 0,
        payableCents: 2200,
        paidCents: options.status === OrderStatus.PENDING_PAYMENT ? 0 : 2200,
        expiresAt:
          options.expiresAt ?? new Date('2099-01-01T00:00:00.000Z'),
        readyAt: options.readyAt ?? null,
      },
    });
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = new PrismaClient();

    const store = await prisma.store.findFirstOrThrow();
    storeId = store.id;

    const member = await prisma.member.upsert({
      where: { phone: '13900000091' },
      create: { phone: '13900000091', nickname: 'D10 测试顾客' },
      update: { nickname: 'D10 测试顾客' },
    });
    memberId = member.id;
  });

  afterAll(async () => {
    await prisma.order.deleteMany({
      where: { orderNo: { startsWith: ORDER_NO_PREFIX } },
    });
    await prisma.member.deleteMany({ where: { id: memberId } });
    await app.close();
    await prisma.$disconnect();
  });

  it('releases a due scheduled order exactly once', async () => {
    const now = new Date('2026-11-11T10:00:00.000Z');
    const order = await createOrder({
      status: OrderStatus.PAID,
      pickupTimeType: PickupTimeType.SCHEDULED,
      releaseAt: new Date('2026-11-11T09:59:00.000Z'),
    });

    const job = app.get(ScheduledOrderReleaseJob);
    expect(await job.run(now)).toBe(1);
    expect(await job.run(now)).toBe(0);

    const released = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
    });
    expect(released.releasedAt).toEqual(now);

    const events = await prisma.orderEvent.findMany({
      where: { orderId: order.id },
    });
    expect(events).toHaveLength(1);
    expect(events[0]?.actorType).toBe(ActorType.SYSTEM);
    expect(events[0]?.note).toContain('预约单已释放');
  });

  it('does not release a scheduled order before release_at', async () => {
    const now = new Date('2026-11-11T10:00:00.000Z');
    const order = await createOrder({
      status: OrderStatus.PAID,
      pickupTimeType: PickupTimeType.SCHEDULED,
      releaseAt: new Date('2026-11-11T10:10:00.000Z'),
    });

    const job = app.get(ScheduledOrderReleaseJob);
    expect(await job.run(now)).toBe(0);

    const unreleased = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
    });
    expect(unreleased.releasedAt).toBeNull();
  });

  it('cancels an expired pending order exactly once', async () => {
    const now = new Date('2026-11-11T10:00:00.000Z');
    const order = await createOrder({
      status: OrderStatus.PENDING_PAYMENT,
      expiresAt: new Date('2026-11-11T09:59:00.000Z'),
    });

    const job = app.get(OrderExpiryJob);
    expect(await job.run(now)).toBeGreaterThanOrEqual(1);
    expect(await job.run(now)).toBe(0);

    const canceled = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
    });
    expect(canceled.status).toBe(OrderStatus.CANCELED);
    expect(canceled.canceledAt).toEqual(now);
    expect(canceled.cancelReason).toBe('支付超时自动取消');

    const events = await prisma.orderEvent.findMany({
      where: { orderId: order.id },
    });
    expect(events).toHaveLength(1);
    expect(events[0]?.fromStatus).toBe(OrderStatus.PENDING_PAYMENT);
    expect(events[0]?.toStatus).toBe(OrderStatus.CANCELED);
  });

  it('closes ready orders for the current business day at 23:59, but not future orders', async () => {
    const now = new Date('2026-11-11T15:59:00.000Z');
    const todayOrder = await createOrder({
      status: OrderStatus.READY,
      businessDate: new Date('2026-11-11T00:00:00.000Z'),
      readyAt: new Date('2026-11-11T09:00:00.000Z'),
    });
    const futureOrder = await createOrder({
      status: OrderStatus.READY,
      businessDate: new Date('2026-11-12T00:00:00.000Z'),
      readyAt: new Date('2026-11-11T09:00:00.000Z'),
    });

    const job = app.get(NoShowJob);
    expect(await job.run(now)).toBeGreaterThanOrEqual(1);
    expect(await job.run(now)).toBe(0);

    const closed = await prisma.order.findUniqueOrThrow({
      where: { id: todayOrder.id },
    });
    expect(closed.status).toBe(OrderStatus.NO_SHOW);
    expect(closed.noShowAt).toEqual(now);

    const future = await prisma.order.findUniqueOrThrow({
      where: { id: futureOrder.id },
    });
    expect(future.status).toBe(OrderStatus.READY);
  });

  it('catches up previous-day ready orders before closing time', async () => {
    const now = new Date('2026-11-11T04:00:00.000Z');
    const previousOrder = await createOrder({
      status: OrderStatus.READY,
      businessDate: new Date('2026-11-10T00:00:00.000Z'),
      readyAt: new Date('2026-11-10T09:00:00.000Z'),
    });
    const todayOrder = await createOrder({
      status: OrderStatus.READY,
      businessDate: new Date('2026-11-11T00:00:00.000Z'),
      readyAt: new Date('2026-11-11T09:00:00.000Z'),
    });

    const job = app.get(NoShowJob);
    expect(await job.run(now)).toBeGreaterThanOrEqual(1);

    const previous = await prisma.order.findUniqueOrThrow({
      where: { id: previousOrder.id },
    });
    expect(previous.status).toBe(OrderStatus.NO_SHOW);

    const today = await prisma.order.findUniqueOrThrow({
      where: { id: todayOrder.id },
    });
    expect(today.status).toBe(OrderStatus.READY);
  });
});
