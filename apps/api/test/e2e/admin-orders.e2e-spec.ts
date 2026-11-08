import type { INestApplication } from '@nestjs/common';
import {
  ActorType,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  PickupTimeType,
  PrismaClient,
  RefundStatus,
} from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from '../setup/create-test-app.js';

const TEST_DATE = '2099-01-01';
const TEST_BUSINESS_DATE = new Date(`${TEST_DATE}T00:00:00.000Z`);

interface CreatedOrder {
  id: string;
  orderNo: string;
}

describe('admin order board (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let token = '';
  let storeId = '';
  let memberId = '';
  let productId = '';
  let productName = '';
  let sequence = 0;
  let asapPaid: CreatedOrder;
  let scheduledUnreleased: CreatedOrder;
  let scheduledReleased: CreatedOrder;
  let acceptedOrder: CreatedOrder;
  let readyOrder: CreatedOrder;
  let paidWithPayment: CreatedOrder;
  let rejectNoReason: CreatedOrder;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = new PrismaClient();

    const store = await prisma.store.findFirstOrThrow();
    storeId = store.id;
    const product = await prisma.product.findFirstOrThrow();
    productId = product.id;
    productName = product.name;

    const loginResponse = await request(app.getHttpServer())
      .post('/api/admin/auth/login')
      .send({ username: 'owner', password: 'admin123' })
      .expect(200);
    token = loginResponse.body.token as string;

    const member = await prisma.member.create({
      data: { phone: '13900000081', nickname: 'D9 测试顾客' },
    });
    memberId = member.id;

    asapPaid = await createOrder(OrderStatus.PAID, PickupTimeType.ASAP);
    scheduledUnreleased = await createOrder(
      OrderStatus.PAID,
      PickupTimeType.SCHEDULED,
      {
        scheduledAt: new Date('2099-01-01T10:00:00.000Z'),
        releaseAt: new Date('2099-01-01T09:50:00.000Z'),
      },
    );
    scheduledReleased = await createOrder(
      OrderStatus.PAID,
      PickupTimeType.SCHEDULED,
      {
        scheduledAt: new Date('2099-01-01T11:00:00.000Z'),
        releaseAt: new Date('2099-01-01T10:50:00.000Z'),
        releasedAt: new Date(),
      },
    );
    acceptedOrder = await createOrder(
      OrderStatus.ACCEPTED,
      PickupTimeType.ASAP,
    );
    readyOrder = await createOrder(OrderStatus.READY, PickupTimeType.ASAP);
    paidWithPayment = await createOrder(OrderStatus.PAID, PickupTimeType.ASAP, {
      withPayment: true,
    });
    rejectNoReason = await createOrder(OrderStatus.PAID, PickupTimeType.ASAP);
  });

  afterAll(async () => {
    if (prisma && memberId) {
      await prisma.order.deleteMany({ where: { memberId } });
      await prisma.member.deleteMany({ where: { id: memberId } });
    }
    await prisma?.$disconnect();
    await app?.close();
  });

  async function createOrder(
    status: OrderStatus,
    pickupTimeType: PickupTimeType,
    options: {
      scheduledAt?: Date;
      releaseAt?: Date;
      releasedAt?: Date;
      withPayment?: boolean;
    } = {},
  ): Promise<CreatedOrder> {
    sequence += 1;
    const now = new Date();
    const pickupCode = `Z${String(sequence).padStart(3, '0')}`;
    const orderNo = `T20990101${String(sequence).padStart(4, '0')}`;

    const order = await prisma.order.create({
      data: {
        orderNo,
        storeId,
        memberId,
        status,
        pickupTimeType,
        scheduledAt: options.scheduledAt ?? null,
        releaseAt: options.releaseAt ?? null,
        releasedAt: options.releasedAt ?? null,
        pickupCode,
        businessDate: TEST_BUSINESS_DATE,
        itemsAmountCents: 2200,
        payableCents: 2200,
        paidCents: status === OrderStatus.PENDING_PAYMENT ? 0 : 2200,
        expiresAt: new Date(now.getTime() + 15 * 60_000),
        paidAt: status === OrderStatus.PENDING_PAYMENT ? null : now,
        acceptedAt: status === OrderStatus.ACCEPTED ? now : null,
        readyAt: status === OrderStatus.READY ? now : null,
        items: {
          create: {
            productId,
            productName,
            productImage: null,
            specSnapshot: [],
            specText: '中杯 / 热 / 标准',
            unitPriceCents: 2200,
            quantity: 1,
            totalCents: 2200,
          },
        },
        events: {
          create: {
            fromStatus: null,
            toStatus: status,
            actorType: ActorType.SYSTEM,
            note: '测试订单',
          },
        },
      },
    });

    if (options.withPayment) {
      await prisma.payment.create({
        data: {
          orderId: order.id,
          provider: PaymentProvider.MOCK,
          transactionId: `TESTPAY-${sequence}-${Date.now()}`,
          amountCents: 2200,
          status: PaymentStatus.SUCCESS,
          paidAt: now,
        },
      });
    }

    return { id: order.id, orderNo };
  }

  function list(tab: string, extra = '') {
    return request(app.getHttpServer())
      .get(`/api/admin/orders?tab=${tab}&date=${TEST_DATE}${extra}`)
      .set('Authorization', `Bearer ${token}`);
  }

  it('rejects unauthenticated requests', async () => {
    await request(app.getHttpServer())
      .get(`/api/admin/orders?date=${TEST_DATE}`)
      .expect(401);
  });

  it('lists active orders and excludes unreleased appointments', async () => {
    const response = await list('ACTIVE').expect(200);
    const ids = response.body.items.map((item: { id: string }) => item.id);

    expect(ids).toContain(asapPaid.id);
    expect(ids).toContain(scheduledReleased.id);
    expect(ids).not.toContain(scheduledUnreleased.id);
    expect(response.body.counts.active).toBeGreaterThanOrEqual(6);
    expect(response.body.counts.scheduled).toBe(1);
  });

  it('lists unreleased appointments in the scheduled tab', async () => {
    const response = await list('SCHEDULED').expect(200);
    const ids = response.body.items.map((item: { id: string }) => item.id);

    expect(ids).toEqual([scheduledUnreleased.id]);
  });

  it('accepts an ASAP order once and records a staff event', async () => {
    const first = await request(app.getHttpServer())
      .post(`/api/admin/orders/${asapPaid.id}/accept`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(first.body.status).toBe(OrderStatus.ACCEPTED);
    expect(first.body.acceptedAt).toBeTruthy();
    expect(
      first.body.events.at(-1),
    ).toMatchObject({ toStatus: OrderStatus.ACCEPTED, actorType: ActorType.STAFF });

    const second = await request(app.getHttpServer())
      .post(`/api/admin/orders/${asapPaid.id}/accept`)
      .set('Authorization', `Bearer ${token}`)
      .expect(409);
    expect(second.body.code).toBe('ORDER_INVALID_STATUS');
  });

  it('refuses to accept an unreleased appointment', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/admin/orders/${scheduledUnreleased.id}/accept`)
      .set('Authorization', `Bearer ${token}`)
      .expect(409);

    expect(response.body.code).toBe('ORDER_NOT_RELEASED');
  });

  it('moves an accepted order to ready and then completed', async () => {
    const ready = await request(app.getHttpServer())
      .post(`/api/admin/orders/${acceptedOrder.id}/ready`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(ready.body.status).toBe(OrderStatus.READY);

    const completed = await request(app.getHttpServer())
      .post(`/api/admin/orders/${readyOrder.id}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(completed.body.status).toBe(OrderStatus.COMPLETED);
    expect(completed.body.completedAt).toBeTruthy();
  });

  it('rejects and refunds a paid order with a reason', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/admin/orders/${paidWithPayment.id}/reject`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: '咖啡豆用完' })
      .expect(200);

    expect(response.body.status).toBe(OrderStatus.REFUNDED);
    const payment = await prisma.payment.findFirstOrThrow({
      where: { orderId: paidWithPayment.id },
    });
    expect(payment.status).toBe(PaymentStatus.REFUNDED);
    const refund = await prisma.refund.findFirstOrThrow({
      where: { orderId: paidWithPayment.id },
    });
    expect(refund.status).toBe(RefundStatus.SUCCESS);
    expect(refund.amountCents).toBe(2200);
    expect(refund.reason).toBe('咖啡豆用完');
  });

  it('requires a reason when rejecting', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/admin/orders/${rejectNoReason.id}/reject`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: '   ' })
      .expect(400);

    expect(response.body.code).toBe('VALIDATION_ERROR');
  });

  it('filters by keyword and exposes event history', async () => {
    const response = await list(
      'ALL',
      `&keyword=${encodeURIComponent(scheduledReleased.orderNo)}`,
    ).expect(200);

    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].id).toBe(scheduledReleased.id);
    expect(response.body.items[0].events.length).toBeGreaterThan(0);
  });
});
