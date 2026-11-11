import type { INestApplication } from '@nestjs/common';
import { OrderStatus, PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getZonedNow } from '../../src/common/utils/time.js';
import { createTestApp } from '../setup/create-test-app.js';

const PRODUCT_ID = '00000000-0000-4000-8000-000000000201';
const LARGE_CUP = '00000000-0000-4000-8000-000000000402';
const HOT = '00000000-0000-4000-8000-000000000403';
const STANDARD_SUGAR = '00000000-0000-4000-8000-000000000407';
const WHOLE_MILK = '00000000-0000-4000-8000-000000000410';

interface QuoteBody {
  payableCents: number;
  itemsAmountCents: number;
  items: Array<{ unitPriceCents: number; totalCents: number }>;
}

interface OrderBody {
  id: string;
  status: string;
  pickupCode: string | null;
  businessDate: string;
  payableCents: number;
  paidCents: number;
  paidAt: string | null;
  estimatedReadyAt: string | null;
  releaseAt: string | null;
  releasedAt: string | null;
  events: Array<{ toStatus: string; note: string }>;
}

function items() {
  return [
    {
      productId: PRODUCT_ID,
      quantity: 1,
      optionIds: [LARGE_CUP, HOT, STANDARD_SUGAR, WHOLE_MILK],
    },
  ];
}

describe('pay, query and cancel orders (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let token = '';
  let memberId = '';
  let otherToken = '';
  let otherMemberId = '';
  let storeId = '';
  let originalBusinessHours: unknown;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = new PrismaClient();

    const store = await prisma.store.findFirstOrThrow();
    storeId = store.id;
    originalBusinessHours = store.businessHours;
    await prisma.store.update({
      where: { id: store.id },
      data: {
        businessHours: Array.from({ length: 7 }, (_, index) => ({
          day: index + 1,
          open: '00:00',
          close: '23:59',
        })),
      },
    });

    token = await login('13900000061');
    memberId = (await prisma.member.findUniqueOrThrow({ where: { phone: '13900000061' } })).id;
    otherToken = await login('13900000062');
    otherMemberId = (await prisma.member.findUniqueOrThrow({ where: { phone: '13900000062' } })).id;
  });

  afterAll(async () => {
    if (prisma && (memberId || otherMemberId)) {
      await prisma.order.deleteMany({
        where: { memberId: { in: [memberId, otherMemberId].filter(Boolean) } },
      });
      await prisma.member.deleteMany({
        where: { id: { in: [memberId, otherMemberId].filter(Boolean) } },
      });
    }
    if (prisma && storeId) {
      await prisma.store.update({
        where: { id: storeId },
        data: { businessHours: originalBusinessHours as never },
      });
    }
    await prisma?.$disconnect();
    await app?.close();
  });

  async function login(phone: string): Promise<string> {
    const codeResponse = await request(app.getHttpServer())
      .post('/api/auth/code')
      .send({ phone })
      .expect(200);
    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ phone, code: codeResponse.body.devCode })
      .expect(200);
    return loginResponse.body.token as string;
  }

  async function quote(
    pickupTimeType: 'ASAP' | 'SCHEDULED' = 'ASAP',
    scheduledAt?: string,
  ): Promise<QuoteBody> {
    const response = await request(app.getHttpServer())
      .post('/api/orders/quote')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: items(),
        pickupTimeType,
        ...(scheduledAt ? { scheduledAt } : {}),
      })
      .expect(200);
    return response.body as QuoteBody;
  }

  async function createOrder(
    pickupTimeType: 'ASAP' | 'SCHEDULED' = 'ASAP',
    scheduledAt?: string,
  ): Promise<OrderBody> {
    const quoteBody = await quote(pickupTimeType, scheduledAt);
    const response = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', `paytest-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`)
      .send({
        items: items(),
        pickupTimeType,
        ...(scheduledAt ? { scheduledAt } : {}),
        expectedTotalCents: quoteBody.payableCents,
      })
      .expect(201);
    return response.body as OrderBody;
  }

  function scheduledSlot(minutesFromNow = 60): Date {
    const value = new Date(Date.now() + minutesFromNow * 60_000);
    value.setUTCSeconds(0, 0);
    value.setUTCMinutes(Math.ceil(value.getUTCMinutes() / 15) * 15);
    return value;
  }

  function shanghaiDate(value: Date): string {
    return getZonedNow(value).date;
  }

  it('requires a customer token to pay', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/orders/00000000-0000-4000-8000-000000000999/pay')
      .expect(401);
    expect(response.body.code).toBe('UNAUTHORIZED');
  });

  it('pays a pending order and generates a pickup code and ETA', async () => {
    const order = await createOrder();
    const before = Date.now();

    const response = await request(app.getHttpServer())
      .post(`/api/orders/${order.id}/pay`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toMatchObject({
      id: order.id,
      status: 'PAID',
      paidCents: order.payableCents,
    });
    expect(response.body.pickupCode).toMatch(/^A\d{3,4}$/);
    expect(response.body.businessDate).toBe(shanghaiDate(new Date()));
    expect(response.body.paidAt).toBeTruthy();
    expect(response.body.estimatedReadyAt).toBeTruthy();
    expect(new Date(response.body.estimatedReadyAt).getTime()).toBeGreaterThanOrEqual(
      before + 8 * 60_000,
    );
    expect(new Date(response.body.estimatedReadyAt).getTime()).toBeLessThanOrEqual(
      before + 30 * 60_000,
    );
    expect(response.body.events.at(-1)).toMatchObject({
      toStatus: 'PAID',
      note: '支付成功',
    });

    const paymentCount = await prisma.payment.count({ where: { orderId: order.id } });
    expect(paymentCount).toBe(1);
  });

  it('treats repeated pay calls as idempotent', async () => {
    const order = await createOrder();
    const first = await request(app.getHttpServer())
      .post(`/api/orders/${order.id}/pay`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const second = await request(app.getHttpServer())
      .post(`/api/orders/${order.id}/pay`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(second.body.id).toBe(first.body.id);
    expect(second.body.pickupCode).toBe(first.body.pickupCode);
    expect(second.body.paidAt).toBe(first.body.paidAt);

    const paymentCount = await prisma.payment.count({ where: { orderId: order.id } });
    expect(paymentCount).toBe(1);
  });

  it('increments pickup codes within the same business date', async () => {
    const first = await createOrder();
    const firstPaid = await request(app.getHttpServer())
      .post(`/api/orders/${first.id}/pay`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const second = await createOrder();
    const secondPaid = await request(app.getHttpServer())
      .post(`/api/orders/${second.id}/pay`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const firstSeq = Number(firstPaid.body.pickupCode.slice(1));
    const secondSeq = Number(secondPaid.body.pickupCode.slice(1));
    expect(secondSeq).toBe(firstSeq + 1);
  });

  it('uses the pickup date and release lead time for a scheduled order', async () => {
    const scheduled = scheduledSlot(60);
    const order = await createOrder('SCHEDULED', scheduled.toISOString());

    const response = await request(app.getHttpServer())
      .post(`/api/orders/${order.id}/pay`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.businessDate).toBe(shanghaiDate(scheduled));
    expect(new Date(response.body.estimatedReadyAt).toISOString()).toBe(
      scheduled.toISOString(),
    );

    const store = await prisma.store.findUniqueOrThrow({ where: { id: storeId } });
    const leadMinutes = Math.max(10, store.prepMinutes + 2);
    expect(new Date(response.body.releaseAt).toISOString()).toBe(
      new Date(scheduled.getTime() - leadMinutes * 60_000).toISOString(),
    );
  });

  it('rejects payment after expiry', async () => {
    const order = await createOrder();
    await prisma.order.update({
      where: { id: order.id },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });

    const response = await request(app.getHttpServer())
      .post(`/api/orders/${order.id}/pay`)
      .set('Authorization', `Bearer ${token}`)
      .expect(409);

    expect(response.body.code).toBe('ORDER_EXPIRED');
    const stored = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(stored.status).toBe(OrderStatus.PENDING_PAYMENT);
  });

  it('cancels a pending order once and rejects paying it afterwards', async () => {
    const order = await createOrder();

    const canceled = await request(app.getHttpServer())
      .post(`/api/orders/${order.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: '临时有事' })
      .expect(200);

    expect(canceled.body.status).toBe('CANCELED');
    expect(canceled.body.events.at(-1)).toMatchObject({
      toStatus: 'CANCELED',
      note: '临时有事',
    });

    await request(app.getHttpServer())
      .post(`/api/orders/${order.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(409);

    const payResponse = await request(app.getHttpServer())
      .post(`/api/orders/${order.id}/pay`)
      .set('Authorization', `Bearer ${token}`)
      .expect(409);
    expect(payResponse.body.code).toBe('ORDER_NOT_PAYABLE');
  });

  it('scopes order queries and payment to the owner', async () => {
    const order = await createOrder();
    await request(app.getHttpServer())
      .post(`/api/orders/${order.id}/pay`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/orders/${order.id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .post(`/api/orders/${order.id}/pay`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);
  });

  it('lists and filters my orders', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/orders?status=PAID&page=1&pageSize=5')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.page).toBe(1);
    expect(response.body.pageSize).toBe(5);
    expect(response.body.total).toBeGreaterThan(0);
    expect(response.body.items.every((item: OrderBody) => item.status === 'PAID')).toBe(
      true,
    );
  });

  it('groups order list tabs by status', async () => {
    const active = await createOrder();
    await request(app.getHttpServer())
      .post(`/api/orders/${active.id}/pay`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const pending = await createOrder();
    const canceled = await createOrder();
    await request(app.getHttpServer())
      .post(`/api/orders/${canceled.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);

    const activeResponse = await request(app.getHttpServer())
      .get('/api/orders?tab=ACTIVE&pageSize=100')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(
      activeResponse.body.items.every((item: OrderBody) =>
        ['PAID', 'ACCEPTED', 'READY'].includes(item.status),
      ),
    ).toBe(true);
    expect(
      activeResponse.body.items.some((item: OrderBody) => item.id === active.id),
    ).toBe(true);

    const pendingResponse = await request(app.getHttpServer())
      .get('/api/orders?tab=PENDING_PAYMENT&pageSize=100')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(
      pendingResponse.body.items.every(
        (item: OrderBody) => item.status === 'PENDING_PAYMENT',
      ),
    ).toBe(true);
    expect(
      pendingResponse.body.items.some((item: OrderBody) => item.id === pending.id),
    ).toBe(true);

    const canceledResponse = await request(app.getHttpServer())
      .get('/api/orders?tab=CANCELED&pageSize=100')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(
      canceledResponse.body.items.every((item: OrderBody) =>
        ['CANCELED', 'REFUNDING', 'REFUNDED'].includes(item.status),
      ),
    ).toBe(true);
    expect(
      canceledResponse.body.items.some((item: OrderBody) => item.id === canceled.id),
    ).toBe(true);
  });
});
