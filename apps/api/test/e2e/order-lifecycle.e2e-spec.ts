import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
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
}

interface OrderBody {
  id: string;
  orderNo: string;
  status: string;
  pickupCode: string | null;
  businessDate: string;
  payableCents: number;
  paidCents: number;
  pickupTimeType: string;
  events: Array<{ fromStatus: string | null; toStatus: string }>;
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

describe('full customer-to-admin order lifecycle (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let customerToken = '';
  let adminToken = '';
  let memberId = '';
  let storeId = '';
  let originalBusinessHours: unknown;
  let sequence = 0;

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

    customerToken = await loginCustomer('13900000091');
    memberId = (await prisma.member.findUniqueOrThrow({ where: { phone: '13900000091' } })).id;
    adminToken = await loginAdmin();
  });

  afterAll(async () => {
    if (prisma && memberId) {
      await prisma.order.deleteMany({ where: { memberId } });
      await prisma.member.deleteMany({ where: { id: memberId } });
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

  async function loginCustomer(phone: string): Promise<string> {
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

  async function loginAdmin(): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/admin/auth/login')
      .send({ username: 'owner', password: 'admin123' })
      .expect(200);
    return response.body.token as string;
  }

  function customerAuth() {
    return { Authorization: `Bearer ${customerToken}` };
  }

  function adminAuth() {
    return { Authorization: `Bearer ${adminToken}` };
  }

  async function quote(): Promise<QuoteBody> {
    const response = await request(app.getHttpServer())
      .post('/api/orders/quote')
      .set(customerAuth())
      .send({ items: items(), pickupTimeType: 'ASAP' })
      .expect(200);
    return response.body as QuoteBody;
  }

  async function createOrder(key = nextKey()): Promise<OrderBody> {
    const quoteBody = await quote();
    const response = await request(app.getHttpServer())
      .post('/api/orders')
      .set(customerAuth())
      .set('Idempotency-Key', key)
      .send({
        items: items(),
        pickupTimeType: 'ASAP',
        expectedTotalCents: quoteBody.payableCents,
      })
      .expect(201);
    return response.body as OrderBody;
  }

  function nextKey(): string {
    sequence += 1;
    return `d13-lifecycle-${Date.now()}-${sequence}`;
  }

  it('runs quote → create → pay → accept → ready → complete end to end', async () => {
    const quoteBody = await quote();
    expect(quoteBody.payableCents).toBeGreaterThan(0);

    const key = nextKey();
    const createResponse = await request(app.getHttpServer())
      .post('/api/orders')
      .set(customerAuth())
      .set('Idempotency-Key', key)
      .send({
        items: items(),
        pickupTimeType: 'ASAP',
        expectedTotalCents: quoteBody.payableCents,
      })
      .expect(201);

    const created = createResponse.body as OrderBody;
    expect(created.status).toBe('PENDING_PAYMENT');
    expect(created.payableCents).toBe(quoteBody.payableCents);
    expect(created.pickupCode).toBeNull();

    const replay = await request(app.getHttpServer())
      .post('/api/orders')
      .set(customerAuth())
      .set('Idempotency-Key', key)
      .send({
        items: items(),
        pickupTimeType: 'ASAP',
        expectedTotalCents: quoteBody.payableCents,
      })
      .expect(201);
    expect(replay.body.id).toBe(created.id);

    const paidResponse = await request(app.getHttpServer())
      .post(`/api/orders/${created.id}/pay`)
      .set(customerAuth())
      .expect(200);
    const paid = paidResponse.body as OrderBody;

    expect(paid.status).toBe('PAID');
    expect(paid.paidCents).toBe(quoteBody.payableCents);
    expect(paid.pickupCode).toMatch(/^A\d{3,4}$/);
    expect(paid.businessDate).toBe(getZonedNow(new Date()).date);

    const adminList = await request(app.getHttpServer())
      .get('/api/admin/orders')
      .query({ tab: 'ACTIVE', date: paid.businessDate, pageSize: 100 })
      .set(adminAuth())
      .expect(200);
    expect(adminList.body.items.map((item: { id: string }) => item.id)).toContain(created.id);

    for (const action of ['accept', 'ready', 'complete']) {
      await request(app.getHttpServer())
        .post(`/api/admin/orders/${created.id}/${action}`)
        .set(adminAuth())
        .expect(200);
    }

    const completed = await request(app.getHttpServer())
      .get(`/api/orders/${created.id}`)
      .set(customerAuth())
      .expect(200);
    const order = completed.body as OrderBody;
    expect(order.status).toBe('COMPLETED');
    expect(order.events.map((event) => event.toStatus)).toEqual(
      expect.arrayContaining(['PENDING_PAYMENT', 'PAID', 'ACCEPTED', 'READY', 'COMPLETED']),
    );

    const again = await request(app.getHttpServer())
      .post(`/api/admin/orders/${created.id}/accept`)
      .set(adminAuth())
      .expect(409);
    expect(again.body.code).toBe('ORDER_INVALID_STATUS');

    const finished = await request(app.getHttpServer())
      .get('/api/orders')
      .query({ tab: 'FINISHED', pageSize: 100 })
      .set(customerAuth())
      .expect(200);
    expect(finished.body.items.map((item: { id: string }) => item.id)).toContain(created.id);

    const dashboard = await request(app.getHttpServer())
      .get('/api/admin/dashboard')
      .query({ date: paid.businessDate })
      .set(adminAuth())
      .expect(200);
    expect(dashboard.body.revenueCents).toBeGreaterThanOrEqual(quoteBody.payableCents);
    expect(dashboard.body.orderCount).toBeGreaterThanOrEqual(1);
  });

  it('cancels a pending order and lists it in the canceled tab', async () => {
    const created = await createOrder();

    const canceledResponse = await request(app.getHttpServer())
      .post(`/api/orders/${created.id}/cancel`)
      .set(customerAuth())
      .send({ reason: 'D13 联调取消' })
      .expect(200);
    const canceled = canceledResponse.body as OrderBody;
    expect(canceled.status).toBe('CANCELED');

    const list = await request(app.getHttpServer())
      .get('/api/orders')
      .query({ tab: 'CANCELED', pageSize: 100 })
      .set(customerAuth())
      .expect(200);
    expect(list.body.items.map((item: { id: string }) => item.id)).toContain(created.id);
  });

  it('refunds a paid order through admin rejection', async () => {
    const created = await createOrder();

    await request(app.getHttpServer())
      .post(`/api/orders/${created.id}/pay`)
      .set(customerAuth())
      .expect(200);

    const rejectedResponse = await request(app.getHttpServer())
      .post(`/api/admin/orders/${created.id}/reject`)
      .set(adminAuth())
      .send({ reason: 'D13 联调拒单退款' })
      .expect(200);
    const rejected = rejectedResponse.body as OrderBody;
    expect(rejected.status).toBe('REFUNDED');

    const detail = await request(app.getHttpServer())
      .get(`/api/orders/${created.id}`)
      .set(customerAuth())
      .expect(200);
    expect(detail.body.status).toBe('REFUNDED');
    expect(detail.body.events.map((event: { toStatus: string }) => event.toStatus)).toEqual(
      expect.arrayContaining(['REFUNDING', 'REFUNDED']),
    );

    const list = await request(app.getHttpServer())
      .get('/api/orders')
      .query({ tab: 'CANCELED', pageSize: 100 })
      .set(customerAuth())
      .expect(200);
    expect(list.body.items.map((item: { id: string }) => item.id)).toContain(created.id);
  });

  it('rejects a customer token on the admin order board', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/admin/orders')
      .set(customerAuth())
      .expect(401);
    expect(response.body.code).toBe('UNAUTHORIZED');
  });
});
