import type { ActorType, OrderStatus } from '@prisma/client';

export interface OrderItemPublic {
  id: string;
  productId: string;
  productName: string;
  productImage: string | null;
  specSnapshot: unknown;
  specText: string;
  unitPriceCents: number;
  quantity: number;
  totalCents: number;
  remark: string | null;
}

export interface OrderEventPublic {
  id: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  actorType: ActorType;
  actorId: string | null;
  note: string | null;
  createdAt: string;
}

export interface OrderPublic {
  id: string;
  orderNo: string;
  status: OrderStatus;
  pickupType: string;
  pickupTimeType: string;
  scheduledAt: string | null;
  releaseAt: string | null;
  releasedAt: string | null;
  pickupCode: string | null;
  businessDate: string;
  itemsAmountCents: number;
  discountCents: number;
  payableCents: number;
  paidCents: number;
  remark: string | null;
  contactName: string | null;
  contactPhone: string | null;
  estimatedReadyAt: string | null;
  expiresAt: string;
  paidAt: string | null;
  acceptedAt: string | null;
  readyAt: string | null;
  completedAt: string | null;
  noShowAt: string | null;
  canceledAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItemPublic[];
  events: OrderEventPublic[];
}
