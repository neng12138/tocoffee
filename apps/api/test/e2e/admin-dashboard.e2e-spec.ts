import type { INestApplication } from '@nestjs/common';
import {
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  PickupTimeType,
  PrismaClient,
  RefundStatus,
  StaffRole,
  StaffStatus,
} from '@prisma/client';
import { hash } from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from '../setup/create-test-app.js';

const DAY_1 = '2026-11-10';
const DAY_2 = '2026-11-11';
const PASSWORD = 'D11-test-123';

interface OrderOptions {
  status: OrderStatus;
  paidCents: number;
  paidAt: Date;
  pickupTimeType?: PickupTimeType;
  releasedAt?: Date | null;
  scheduledAt?: Date | null;
  createdAt: Date;
}

describe('admin dashboard and store settings (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let storeId = '';
  let memberId = '';
  let ownerToken = '';
  let staffToken = '';
  let sequence = 0;
  const orderIds: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    prisma = new PrismaClient();

    const store = await prisma.store.create({
      data: {
        name: 'D11 测试门店',
        address: '测试路 11 号',
        phone: '020-88886666',
        businessHours: [1, 2, 3, 4, 5, 6, 7].map((day) => ({
          day,
          open: '08:00',
          close: '20:00',
        })),
        isAcceptingOrders: true,
        prepMinutes: 8,
        perOrderMinutes: 2,
        pickupNotice: '测试取餐提示',
        pickupCodePrefix: 'D',
      },
    });
    storeId = store.id;

    const passwordHash = await hash(PASSWORD, 10);
    await prisma.staff.createMany({
      data: [
        {
          storeId,
          username: 'd11-owner',
          passwordHash,
          name: 'D11 店主',
          role: StaffRole.OWNER,
          status: StaffStatus.ACTIVE,
        },
        {
          storeId,
          username: 'd11-staff',
          passwordHash,
          name: 'D11 店员',
          role: StaffRole.STAFF,
          status: StaffStatus.ACTIVE,
        },
      ],
    });

    const ownerLogin = await request(app.getHttpServer())
      .post('/api/admin/auth/login')
      .send({ username: 'd11-owner', password: PASSWORD })
      .expect(200);
    ownerToken = ownerLogin.body.token as string;

    const staffLogin = await request(app.getHttpServer())
      .post('/api/admin/auth/login')
      .send({ username: 'd11-staff', password: PASSWORD })
      .expect(200);
    staffToken = staffLogin.body.token as string;

    const member = await prisma.member.create({
      data: { phone: '13900000111', nickname: 'D11 测试顾客' },
    });
    memberId = member.id;
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.staff.deleteMany({ where: { storeId } });
      await prisma.order.deleteMany({ where: { storeId } });
      await prisma.member.deleteMany({ where: { id: memberId } });
      await prisma.store.deleteMany({ where: { id: storeId } });
      await prisma.$disconnect();
    }
    await app?.close();
  });

  async function createOrder(options: OrderOptions): Promise<{ id: string; orderNo: string }> {
    const orderNo = `D11-${Date.now().toString(36)}-${++sequence}`;
    const order = await prisma.order.create({
      data: {
        orderNo,
        storeId,
        memberId,
        status: options.status,
        pickupTimeType: options.pickupTimeType ?? PickupTimeType.ASAP,
        scheduledAt: options.scheduledAt ?? null,
        releasedAt: options.releasedAt ?? null,
        businessDate: new Date(`${DAY_2}T00:00:00.000Z`),
        itemsAmountCents: options.paidCents,
        payableCents: options.paidCents,
        paidCents: options.paidCents,
        contactName: 'D11 测试顾客',
        contactPhone: '13900000111',
        expiresAt: new Date('2026-11-11T16:00:00.000Z'),
        paidAt: options.paidAt,
        createdAt: options.createdAt,
        idempotencyKey: null,
      },
      select: { id: true, orderNo: true },
    });
    orderIds.push(order.id);
    return order;
  }

  it('rejects the dashboard without a staff token', async () => {
    await request(app.getHttpServer()).get('/api/admin/dashboard').expect(401);
  });

  it('returns empty metrics for a day without orders', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/admin/dashboard')
      .query({ date: DAY_1 })
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      date: DAY_1,
      revenueCents: 0,
      orderCount: 0,
      averageOrderCents: null,
      pendingAcceptCount: 0,
      pendingPickupCount: 0,
      recentOrders: [],
    });
  });

  it('matches paid/refund/no-show/cross-day SQL semantics', async () => {
    const refunded = await createOrder({
      status: OrderStatus.REFUNDED,
      paidCents: 1000,
      paidAt: new Date('2026-11-10T15:59:30.000Z'),
      createdAt: new Date('2026-11-10T15:59:30.000Z'),
    });

    const payment = await prisma.payment.create({
      data: {
        orderId: refunded.id,
        provider: PaymentProvider.MOCK,
        transactionId: `D11-PAY-${Date.now()}`,
        amountCents: 1000,
        status: PaymentStatus.SUCCESS,
        paidAt: new Date('2026-11-10T15:59:30.000Z'),
      },
    });

    await prisma.refund.create({
      data: {
        orderId: refunded.id,
        paymentId: payment.id,
        amountCents: 1000,
        reason: 'D11 测试退款',
        status: RefundStatus.SUCCESS,
        providerRefundId: `D11-REF-${Date.now()}`,
        completedAt: new Date('2026-11-10T16:05:00.000Z'),
      },
    });

    await createOrder({
      status: OrderStatus.COMPLETED,
      paidCents: 2000,
      paidAt: new Date('2026-11-10T16:00:30.000Z'),
      createdAt: new Date('2026-11-10T16:00:30.000Z'),
    });
    await createOrder({
      status: OrderStatus.NO_SHOW,
      paidCents: 3000,
      paidAt: new Date('2026-11-10T16:01:00.000Z'),
      createdAt: new Date('2026-11-10T16:01:00.000Z'),
    });
    await createOrder({
      status: OrderStatus.READY,
      paidCents: 4000,
      paidAt: new Date('2026-11-10T16:02:00.000Z'),
      createdAt: new Date('2026-11-10T16:02:00.000Z'),
    });
    await createOrder({
      status: OrderStatus.PAID,
      paidCents: 5000,
      paidAt: new Date('2026-11-10T16:03:00.000Z'),
      createdAt: new Date('2026-11-10T16:03:00.000Z'),
    });
    await createOrder({
      status: OrderStatus.PAID,
      paidCents: 6000,
      paidAt: new Date('2026-11-10T16:04:00.000Z'),
      pickupTimeType: PickupTimeType.SCHEDULED,
      scheduledAt: new Date('2026-11-11T10:00:00.000Z'),
      createdAt: new Date('2026-11-10T16:04:00.000Z'),
    });

    const day1 = await request(app.getHttpServer())
      .get('/api/admin/dashboard')
      .query({ date: DAY_1 })
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(day1.body).toMatchObject({
      revenueCents: 1000,
      orderCount: 1,
      averageOrderCents: 1000,
      pendingAcceptCount: 1,
      pendingPickupCount: 1,
    });

    const day2 = await request(app.getHttpServer())
      .get('/api/admin/dashboard')
      .query({ date: DAY_2 })
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(day2.body).toMatchObject({
      revenueCents: 19000,
      orderCount: 5,
      averageOrderCents: 3800,
      pendingAcceptCount: 1,
      pendingPickupCount: 1,
    });
    expect(day2.body.recentOrders).toHaveLength(6);
    expect(day2.body.recentOrders[0].orderNo).toContain('D11-');
  });

  it('rejects an invalid dashboard date', async () => {
    await request(app.getHttpServer())
      .get('/api/admin/dashboard')
      .query({ date: '2026-02-31' })
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(400)
      .expect(({ body }) => {
        expect(body.code).toBe('VALIDATION_ERROR');
      });
  });

  it('reads the full store settings', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/admin/store')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      id: storeId,
      name: 'D11 测试门店',
      isAcceptingOrders: true,
      prepMinutes: 8,
      perOrderMinutes: 2,
      pickupCodePrefix: 'D',
    });
    expect(response.body.businessHours).toHaveLength(7);
  });

  it('updates store settings and normalizes the pickup prefix', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/admin/store')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'D11 更新门店',
        isAcceptingOrders: false,
        prepMinutes: 12,
        perOrderMinutes: 3,
        pickupNotice: '更新后的取餐提示',
        pickupCodePrefix: 'b',
        businessHours: [1, 2, 3, 4, 5].map((day) => ({
          day,
          open: '09:00',
          close: '18:00',
        })),
      })
      .expect(200);

    expect(response.body).toMatchObject({
      name: 'D11 更新门店',
      isAcceptingOrders: false,
      prepMinutes: 12,
      perOrderMinutes: 3,
      pickupNotice: '更新后的取餐提示',
      pickupCodePrefix: 'B',
    });
    expect(response.body.businessHours).toHaveLength(5);
  });

  it('rejects duplicate business days and inverted hours', async () => {
    await request(app.getHttpServer())
      .patch('/api/admin/store')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        businessHours: [
          { day: 1, open: '08:00', close: '20:00' },
          { day: 1, open: '09:00', close: '18:00' },
        ],
      })
      .expect(400);

    await request(app.getHttpServer())
      .patch('/api/admin/store')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        businessHours: [{ day: 1, open: '20:00', close: '08:00' }],
      })
      .expect(400);
  });

  it('rejects invalid prep time and staff updates', async () => {
    await request(app.getHttpServer())
      .patch('/api/admin/store')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ prepMinutes: 0 })
      .expect(400);

    await request(app.getHttpServer())
      .get('/api/admin/store')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .patch('/api/admin/store')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: '店员不能改' })
      .expect(403)
      .expect(({ body }) => {
        expect(body.code).toBe('FORBIDDEN');
      });
  });
});
