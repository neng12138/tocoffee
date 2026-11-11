import type { OrderStatus, PickupTimeType } from '@prisma/client';

export interface DashboardRecentOrder {
  id: string;
  orderNo: string;
  status: OrderStatus;
  pickupTimeType: PickupTimeType;
  pickupCode: string | null;
  paidCents: number;
  paidAt: string | null;
  createdAt: string;
  contactName: string | null;
}

export interface DashboardSummary {
  date: string;
  revenueCents: number;
  orderCount: number;
  averageOrderCents: number | null;
  pendingAcceptCount: number;
  pendingPickupCount: number;
  recentOrders: DashboardRecentOrder[];
}
