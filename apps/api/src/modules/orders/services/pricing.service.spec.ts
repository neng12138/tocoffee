import { describe, expect, it } from 'vitest';
import { AppError } from '../../../common/errors/app-error.js';
import { PricingService } from './pricing.service.js';
import type {
  PricingProduct,
  PricingStore,
  QuotePricingInput,
  QuoteResult,
} from '../types/pricing.types.js';

const store: PricingStore = {
  businessHours: Array.from({ length: 7 }, (_, index) => ({
    day: index + 1,
    open: '08:00',
    close: '20:00',
  })),
  isAcceptingOrders: true,
  prepMinutes: 8,
  perOrderMinutes: 2,
};

const latte: PricingProduct = {
  id: 'product-latte',
  name: '拿铁',
  imageUrl: 'http://localhost:3000/uploads/seed/coffee-1.png',
  basePriceCents: 2200,
  status: 'ON_SALE',
  specGroups: [
    {
      id: 'group-cup',
      name: '杯型',
      required: true,
      multiSelect: false,
      minSelect: 1,
      maxSelect: 1,
      options: [
        { id: 'cup-medium', name: '中杯', priceDeltaCents: 0, isAvailable: true },
        { id: 'cup-large', name: '大杯', priceDeltaCents: 300, isAvailable: true },
      ],
    },
    {
      id: 'group-temperature',
      name: '温度',
      required: true,
      multiSelect: false,
      minSelect: 1,
      maxSelect: 1,
      options: [
        { id: 'temp-hot', name: '热', priceDeltaCents: 0, isAvailable: true },
        { id: 'temp-iced', name: '冰', priceDeltaCents: 0, isAvailable: true },
      ],
    },
    {
      id: 'group-milk',
      name: '奶基',
      required: true,
      multiSelect: false,
      minSelect: 1,
      maxSelect: 1,
      options: [
        { id: 'milk-whole', name: '牛奶', priceDeltaCents: 0, isAvailable: true },
        { id: 'milk-oat', name: '燕麦奶', priceDeltaCents: 300, isAvailable: true },
      ],
    },
    {
      id: 'group-extras',
      name: '加料',
      required: false,
      multiSelect: true,
      minSelect: 0,
      maxSelect: 2,
      options: [
        { id: 'extra-espresso', name: '浓缩', priceDeltaCents: 400, isAvailable: true },
        { id: 'extra-syrup', name: '糖浆', priceDeltaCents: 200, isAvailable: true },
        { id: 'extra-vanilla', name: '香草', priceDeltaCents: 200, isAvailable: true },
      ],
    },
  ],
};

const now = new Date('2026-11-08T02:00:00.000Z');

function input(overrides: Partial<QuotePricingInput> = {}): QuotePricingInput {
  return {
    items: [
      {
        productId: latte.id,
        quantity: 2,
        optionIds: [
          'cup-large',
          'temp-hot',
          'milk-oat',
          'extra-espresso',
          'extra-syrup',
        ],
      },
    ],
    products: [latte],
    store,
    pickupTimeType: 'ASAP',
    scheduledAt: null,
    now,
    queueCount: 3,
    ...overrides,
  };
}

function quote(overrides: Partial<QuotePricingInput> = {}): QuoteResult {
  return new PricingService().quote(input(overrides));
}

function expectAppError(fn: () => unknown, code: string): void {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(code);
    return;
  }

  throw new Error(`Expected AppError ${code}`);
}

const requiredOptions = ['cup-medium', 'temp-hot', 'milk-whole'];

describe('PricingService', () => {
  it('prices base + option deltas, multiplies by quantity, and orders spec text by group', () => {
    const result = quote();

    expect(result.items).toHaveLength(1);
    expect(result.items[0].unitPriceCents).toBe(3400);
    expect(result.items[0].totalCents).toBe(6800);
    expect(result.items[0].specText).toBe('大杯 / 热 / 燕麦奶 / 浓缩 / 糖浆');
    expect(result.itemsAmountCents).toBe(6800);
    expect(result.payableCents).toBe(6800);
    expect(result.discountCents).toBe(0);
    expect(result.estimatedReadyAt.toISOString()).toBe(
      '2026-11-08T02:14:00.000Z',
    );
  });

  it('rejects a missing required spec group', () => {
    expectAppError(
      () =>
        quote({
          items: [
            {
              productId: latte.id,
              quantity: 1,
              optionIds: ['temp-hot', 'milk-whole'],
            },
          ],
        }),
      'SPEC_REQUIRED',
    );
  });

  it('rejects more options than a multi-select group allows', () => {
    expectAppError(
      () =>
        quote({
          items: [
            {
              productId: latte.id,
              quantity: 1,
              optionIds: [
                'cup-medium',
                'temp-hot',
                'milk-whole',
                'extra-espresso',
                'extra-syrup',
                'extra-vanilla',
              ],
            },
          ],
        }),
      'SPEC_REQUIRED',
    );
  });

  it('rejects a sold-out product', () => {
    const soldOut = structuredClone(latte);
    soldOut.status = 'SOLD_OUT';

    expectAppError(
      () =>
        quote({
          products: [soldOut],
          items: [
            {
              productId: soldOut.id,
              quantity: 1,
              optionIds: requiredOptions,
            },
          ],
        }),
      'PRODUCT_UNAVAILABLE',
    );
  });

  it('rejects an unavailable option', () => {
    const withUnavailableOat = structuredClone(latte);
    const oat = withUnavailableOat.specGroups
      .find((group) => group.id === 'group-milk')
      ?.options.find((option) => option.id === 'milk-oat');
    expect(oat).toBeDefined();
    oat!.isAvailable = false;

    expectAppError(
      () =>
        quote({
          products: [withUnavailableOat],
          items: [
            {
              productId: withUnavailableOat.id,
              quantity: 1,
              optionIds: ['cup-medium', 'temp-hot', 'milk-oat'],
            },
          ],
        }),
      'PRODUCT_UNAVAILABLE',
    );
  });

  it('rejects an option that does not belong to the product', () => {
    expectAppError(
      () =>
        quote({
          items: [
            {
              productId: latte.id,
              quantity: 1,
              optionIds: [...requiredOptions, 'unknown-option'],
            },
          ],
        }),
      'SPEC_REQUIRED',
    );
  });

  it('rejects duplicate cart lines', () => {
    expectAppError(
      () =>
        quote({
          items: [
            {
              productId: latte.id,
              quantity: 1,
              optionIds: requiredOptions,
            },
            {
              productId: latte.id,
              quantity: 1,
              optionIds: [...requiredOptions].reverse(),
            },
          ],
        }),
      'VALIDATION_ERROR',
    );
  });

  it('rejects a quantity outside 1–20', () => {
    expectAppError(
      () =>
        quote({
          items: [
            {
              productId: latte.id,
              quantity: 0,
              optionIds: requiredOptions,
            },
          ],
        }),
      'VALIDATION_ERROR',
    );
  });

  it('caps ASAP ready time at 30 minutes', () => {
    const result = quote({ queueCount: 20 });

    expect(result.estimatedReadyAt.toISOString()).toBe(
      '2026-11-08T02:30:00.000Z',
    );
  });

  it('uses the scheduled time as estimated ready time', () => {
    const scheduledNow = new Date('2026-11-08T05:00:00.000Z');
    const scheduledAt = new Date('2026-11-08T06:30:00.000Z');

    const result = quote({
      now: scheduledNow,
      pickupTimeType: 'SCHEDULED',
      scheduledAt,
    });

    expect(result.scheduledAt).toEqual(scheduledAt);
    expect(result.estimatedReadyAt).toEqual(scheduledAt);
  });

  it('rejects a scheduled time earlier than 15 minutes from now', () => {
    expectAppError(
      () =>
        quote({
          now: new Date('2026-11-08T05:00:00.000Z'),
          pickupTimeType: 'SCHEDULED',
          scheduledAt: new Date('2026-11-08T05:10:00.000Z'),
        }),
      'VALIDATION_ERROR',
    );
  });

  it('rejects a scheduled time more than 2 hours ahead', () => {
    expectAppError(
      () =>
        quote({
          now: new Date('2026-11-08T05:00:00.000Z'),
          pickupTimeType: 'SCHEDULED',
          scheduledAt: new Date('2026-11-08T07:15:00.000Z'),
        }),
      'VALIDATION_ERROR',
    );
  });

  it('rejects a scheduled time that is not on a 15-minute boundary', () => {
    expectAppError(
      () =>
        quote({
          now: new Date('2026-11-08T05:00:00.000Z'),
          pickupTimeType: 'SCHEDULED',
          scheduledAt: new Date('2026-11-08T06:37:00.000Z'),
        }),
      'VALIDATION_ERROR',
    );
  });

  it('rejects a scheduled time outside business hours', () => {
    expectAppError(
      () =>
        quote({
          now: new Date('2026-11-08T10:00:00.000Z'),
          pickupTimeType: 'SCHEDULED',
          scheduledAt: new Date('2026-11-08T12:00:00.000Z'),
        }),
      'STORE_CLOSED',
    );
  });

  it('rejects ASAP pickup while the store is closed', () => {
    expectAppError(
      () =>
        quote({
          now: new Date('2026-11-08T13:00:00.000Z'),
        }),
      'STORE_CLOSED',
    );
  });

  it('rejects a scheduled quote without a scheduled time', () => {
    expectAppError(
      () =>
        quote({
          pickupTimeType: 'SCHEDULED',
          scheduledAt: null,
        }),
      'VALIDATION_ERROR',
    );
  });
});
