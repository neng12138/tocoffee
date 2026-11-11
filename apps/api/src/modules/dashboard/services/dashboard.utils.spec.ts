import { describe, expect, it } from 'vitest';
import { calculateAverageOrderCents } from './dashboard.utils.js';

describe('calculateAverageOrderCents', () => {
  it('rounds to the nearest cent', () => {
    expect(calculateAverageOrderCents(10_000, 3)).toBe(3333);
    expect(calculateAverageOrderCents(8_000, 3)).toBe(2667);
  });

  it('returns null when there are no paid orders', () => {
    expect(calculateAverageOrderCents(0, 0)).toBeNull();
    expect(calculateAverageOrderCents(1000, 0)).toBeNull();
  });

  it('keeps negative net revenue when refunds exceed paid amount', () => {
    expect(calculateAverageOrderCents(-1000, 2)).toBe(-500);
  });
});
