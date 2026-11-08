import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getZonedNow } from '../../src/common/utils/time.js';
import { createTestApp } from '../setup/create-test-app.js';

const SEED_PRODUCT_ID = '00000000-0000-4000-8000-000000000201';
const LARGE_CUP = '00000000-0000-4000-8000-000000000402';
const HOT = '00000000-0000-4000-8000-000000000403';
const STANDARD_SUGAR = '00000000-0000-4000-8000-000000000407';
const WHOLE_MILK = '00000000-0000-4000-8000-000000000410';

interface QuoteBody {
  items: Array<{
    productId: string;
    name: string;
    quantity: number;
    unitPriceCents: number;
    totalCents: number;
    specText: string;
  }>;
  itemsAmountCents: number;
  discountCents: number;
  payableCents: number;
}

function orderPayload(expectedTotalCents: number) {
  return {
    items: [
      {
        productId: SEED_PRODUCT_ID,
        quantity: 1,
        optionIds: [LARGE_CUP, HOT, STANDARD_SUGAR, WHOLE_MILK],
      },
    ],
    pickupTimeType: 'ASAP',
    expectedTotalCents,
  };
}

describe('create order (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let customerToken = '';
  let memberId = '';
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

    const phone = '13900000041';
    const codeResponse = await request(app.getHttpServer())
      .post('/api/auth/code')
      .send({ phone })
      .expect(200);
    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ phone, code: codeResponse.body.devCode })
      .expect(200);

    customerToken = loginResponse.body.token as string;
    memberId = loginResponse.body.member.id as string;
  });

  afterAll(async () => {
    if (prisma && memberId) {
      await prisma.order.deleteMany({ where: { memberId } });
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

  async function quoteAsap(): Promise<QuoteBody> {
    const response = await request(app.getHttpServer())
      .post('/api/orders/quote')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        items: [
          {
            productId: SEED_PRODUCT_ID,
            quantity: 1,
            optionIds: [LARGE_CUP, HOT, STANDARD_SUGAR, WHOLE_MILK],
          },
        ],
        pickupTimeType: 'ASAP',
      })
      .expect(200);

    return response.body as QuoteBody;
  }

  it('requires a customer token', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Idempotency-Key', randomUUID())
      .send(orderPayload(2600))
      .expect(401);

    expect(response.body.code).toBe('UNAUTHORIZED');
  });

  it('requires an Idempotency-Key header', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send(orderPayload(2600))
      .expect(400);

    expect(response.body.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a malformed Idempotency-Key', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .set('Idempotency-Key', 'short')
      .send(orderPayload(2600))
      .expect(400);

    expect(response.body.code).toBe('VALIDATION_ERROR');
  });

  it('creates a pending-payment order with snapshots and an event', async () => {
    const quote = await quoteAsap();
    const before = Date.now();

    const response = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .set('Idempotency-Key', randomUUID())
      .send(orderPayload(quote.payableCents))
      .expect(201);

    expect(response.body).toMatchObject({
      status: 'PENDING_PAYMENT',
      pickupTimeType: 'ASAP',
      itemsAmountCents: quote.itemsAmountCents,
      discountCents: 0,
      payableCents: quote.payableCents,
      paidCents: 0,
      pickupCode: null,
      paidAt: null,
    });
    expect(response.body.orderNo).toMatch(/^T\d{16}$/);
    expect(response.body.businessDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0]).toMatchObject({
      productId: SEED_PRODUCT_ID,
      productName: '生椰拿铁',
      specText: '大杯 / 热 / 标准 / 牛奶',
      quantity: 1,
      unitPriceCents: quote.items[0].unitPriceCents,
      totalCents: quote.items[0].totalCents,
    });
    expect(response.body.items[0].specSnapshot).toHaveLength(4);
    expect(response.body.events[0]).toMatchObject({
      fromStatus: null,
      toStatus: 'PENDING_PAYMENT',
      actorType: 'CUSTOMER',
      note: '创建订单',
    });

    const expiresAt = new Date(response.body.expiresAt).getTime();
    expect(expiresAt).toBeGreaterThanOrEqual(before + 14 * 60_000);
    expect(expiresAt).toBeLessThanOrEqual(before + 16 * 60_000);
  });

  it('returns the same order for a repeated Idempotency-Key', async () => {
    const quote = await quoteAsap();
    const key = randomUUID();

    const first = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .set('Idempotency-Key', key)
      .send(orderPayload(quote.payableCents))
      .expect(201);

    const second = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .set('Idempotency-Key', key)
      .send(orderPayload(quote.payableCents))
      .expect(201);

    expect(second.body.id).toBe(first.body.id);
    expect(second.body.orderNo).toBe(first.body.orderNo);

    const count = await prisma.order.count({
      where: { memberId, idempotencyKey: key },
    });
    expect(count).toBe(1);
  });

  it('rejects a stale expected total with PRICE_CHANGED and a fresh quote', async () => {
    const quote = await quoteAsap();

    const response = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .set('Idempotency-Key', randomUUID())
      .send(orderPayload(quote.payableCents - 1))
      .expect(409);

    expect(response.body.code).toBe('PRICE_CHANGED');
    expect(response.body.details.quote.payableCents).toBe(quote.payableCents);
  });

  it('calculates business_date and release_at for a scheduled order', async () => {
    const scheduled = new Date(Date.now() + 60 * 60_000);
    scheduled.setUTCSeconds(0, 0);
    scheduled.setUTCMinutes(Math.ceil(scheduled.getUTCMinutes() / 15) * 15);

    const quoteResponse = await request(app.getHttpServer())
      .post('/api/orders/quote')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        items: [
          {
            productId: SEED_PRODUCT_ID,
            quantity: 1,
            optionIds: [LARGE_CUP, HOT, STANDARD_SUGAR, WHOLE_MILK],
          },
        ],
        pickupTimeType: 'SCHEDULED',
        scheduledAt: scheduled.toISOString(),
      })
      .expect(200);

    const response = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        items: [
          {
            productId: SEED_PRODUCT_ID,
            quantity: 1,
            optionIds: [LARGE_CUP, HOT, STANDARD_SUGAR, WHOLE_MILK],
          },
        ],
        pickupTimeType: 'SCHEDULED',
        scheduledAt: scheduled.toISOString(),
        expectedTotalCents: quoteResponse.body.payableCents,
      })
      .expect(201);

    expect(new Date(response.body.scheduledAt).getTime()).toBe(
      scheduled.getTime(),
    );
    expect(new Date(response.body.releaseAt).getTime()).toBe(
      scheduled.getTime() - 10 * 60_000,
    );
    expect(response.body.businessDate).toBe(getZonedNow(scheduled).date);
  });
});
