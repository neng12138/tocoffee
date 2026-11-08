import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from '../setup/create-test-app.js';

const SEED_PRODUCT_ID = '00000000-0000-4000-8000-000000000201';
const LARGE_CUP = '00000000-0000-4000-8000-000000000402';
const HOT = '00000000-0000-4000-8000-000000000403';
const STANDARD_SUGAR = '00000000-0000-4000-8000-000000000407';
const WHOLE_MILK = '00000000-0000-4000-8000-000000000410';
const ESPRESSO_SHOT = '00000000-0000-4000-8000-000000000413';

describe('order quote (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let customerToken = '';
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

    const phone = '13900000031';
    const codeResponse = await request(app.getHttpServer())
      .post('/api/auth/code')
      .send({ phone })
      .expect(200);
    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ phone, code: codeResponse.body.devCode })
      .expect(200);
    customerToken = loginResponse.body.token as string;
  });

  afterAll(async () => {
    if (prisma && storeId) {
      await prisma.store.update({
        where: { id: storeId },
        data: { businessHours: originalBusinessHours as never },
      });
    }
    await prisma?.$disconnect();
    await app?.close();
  });

  it('requires a customer token', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/orders/quote')
      .send({ items: [], pickupTimeType: 'ASAP' })
      .expect(401);

    expect(response.body.code).toBe('UNAUTHORIZED');
  });

  it('quotes a seeded latte with known option deltas', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/orders/quote')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        items: [
          {
            productId: SEED_PRODUCT_ID,
            quantity: 2,
            optionIds: [
              LARGE_CUP,
              HOT,
              STANDARD_SUGAR,
              WHOLE_MILK,
              ESPRESSO_SHOT,
            ],
          },
        ],
        pickupTimeType: 'ASAP',
      })
      .expect(200);

    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0]).toMatchObject({
      productId: SEED_PRODUCT_ID,
      name: '生椰拿铁',
      quantity: 2,
      unitPriceCents: 2900,
      totalCents: 5800,
      specText: '大杯 / 热 / 标准 / 牛奶 / 浓缩',
    });
    expect(response.body.itemsAmountCents).toBe(5800);
    expect(response.body.discountCents).toBe(0);
    expect(response.body.payableCents).toBe(5800);
    expect(response.body.pickupTimeType).toBe('ASAP');
    expect(response.body.scheduledAt).toBeNull();
    expect(new Date(response.body.estimatedReadyAt).getTime()).toBeGreaterThan(
      Date.now(),
    );
  });

  it('returns the scheduled time as estimated ready time', async () => {
    const scheduled = new Date(Date.now() + 60 * 60_000);
    scheduled.setSeconds(0, 0);
    scheduled.setMinutes(
      Math.ceil(scheduled.getMinutes() / 15) * 15,
    );

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
        pickupTimeType: 'SCHEDULED',
        scheduledAt: scheduled.toISOString(),
      })
      .expect(200);

    expect(new Date(response.body.estimatedReadyAt).getTime()).toBe(
      scheduled.getTime(),
    );
    expect(new Date(response.body.scheduledAt).getTime()).toBe(
      scheduled.getTime(),
    );
  });

  it('rejects a missing required spec', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/orders/quote')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        items: [
          {
            productId: SEED_PRODUCT_ID,
            quantity: 1,
            optionIds: [HOT, WHOLE_MILK],
          },
        ],
        pickupTimeType: 'ASAP',
      })
      .expect(400);

    expect(response.body.code).toBe('SPEC_REQUIRED');
  });

  it('rejects an unknown product as unavailable', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/orders/quote')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        items: [
          {
            productId: '00000000-0000-4000-8000-000000000000',
            quantity: 1,
            optionIds: [],
          },
        ],
        pickupTimeType: 'ASAP',
      })
      .expect(409);

    expect(response.body.code).toBe('PRODUCT_UNAVAILABLE');
  });

  it('rejects malformed quantities with the unified error shape', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/orders/quote')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        items: [
          {
            productId: SEED_PRODUCT_ID,
            quantity: 0,
            optionIds: [],
          },
        ],
        pickupTimeType: 'ASAP',
      })
      .expect(400);

    expect(response.body.code).toBe('VALIDATION_ERROR');
  });
});
