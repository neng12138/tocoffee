import { describe, expect, it } from 'vitest';
import { toOrderPublic, type OrderWithRelations } from './order.mapper.js';

function buildOrder(): OrderWithRelations {
  const now = new Date('2026-11-11T10:00:00.000Z');
  return {
    id: 'order-1',
    orderNo: 'T2611111000000001',
    storeId: 'store-1',
    memberId: 'member-1',
    status: 'PAID',
    pickupType: 'SELF_PICKUP',
    pickupTimeType: 'ASAP',
    scheduledAt: null,
    releaseAt: null,
    releasedAt: null,
    pickupCode: 'A001',
    businessDate: new Date('2026-11-11T00:00:00.000Z'),
    itemsAmountCents: 2200,
    discountCents: 0,
    payableCents: 2200,
    paidCents: 2200,
    remark: '少冰',
    contactName: '测试顾客',
    contactPhone: '13900000001',
    estimatedReadyAt: new Date('2026-11-11T10:08:00.000Z'),
    expiresAt: new Date('2026-11-11T10:15:00.000Z'),
    paidAt: now,
    acceptedAt: null,
    readyAt: null,
    completedAt: null,
    noShowAt: null,
    canceledAt: null,
    cancelReason: null,
    createdAt: now,
    updatedAt: now,
    items: [
      {
        id: 'item-1',
        orderId: 'order-1',
        productId: 'product-1',
        productName: '生椰拿铁',
        productImage: null,
        specSnapshot: [],
        specText: '大杯 / 热 / 标准糖 / 牛奶',
        basePriceCents: 2200,
        unitPriceCents: 2200,
        quantity: 1,
        totalCents: 2200,
        remark: null,
        createdAt: now,
      },
    ],
    events: [
      {
        id: 'event-1',
        orderId: 'order-1',
        fromStatus: 'PENDING_PAYMENT',
        toStatus: 'PAID',
        actorType: 'CUSTOMER',
        actorId: 'member-1',
        note: '支付成功',
        createdAt: now,
      },
    ],
  } as unknown as OrderWithRelations;
}

describe('toOrderPublic', () => {
  it('formats businessDate as YYYY-MM-DD and serializes timestamps', () => {
    const order = toOrderPublic(buildOrder());

    expect(order.businessDate).toBe('2026-11-11');
    expect(order.paidAt).toBe('2026-11-11T10:00:00.000Z');
    expect(order.createdAt).toBe('2026-11-11T10:00:00.000Z');
    expect(order.expiresAt).toBe('2026-11-11T10:15:00.000Z');
  });

  it('keeps item snapshots and event timeline intact', () => {
    const order = toOrderPublic(buildOrder());

    expect(order.items).toHaveLength(1);
    expect(order.items[0]).toMatchObject({
      productName: '生椰拿铁',
      specText: '大杯 / 热 / 标准糖 / 牛奶',
      totalCents: 2200,
    });
    expect(order.events[0]).toMatchObject({
      fromStatus: 'PENDING_PAYMENT',
      toStatus: 'PAID',
      actorType: 'CUSTOMER',
    });
  });
});
