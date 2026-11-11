/**
 * 客单价按分四舍五入；没有订单时返回 null，前端显示「—」。
 */
export function calculateAverageOrderCents(
  revenueCents: number,
  orderCount: number,
): number | null {
  if (orderCount <= 0) {
    return null;
  }

  return Math.round(revenueCents / orderCount);
}
