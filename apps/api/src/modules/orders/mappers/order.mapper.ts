import type {
  Order,
  OrderEvent,
  OrderItem,
} from '@prisma/client';
import type {
  OrderEventPublic,
  OrderItemPublic,
  OrderPublic,
} from '../types/order.types.js';

export type OrderWithRelations = Order & {
  items: OrderItem[];
  events: OrderEvent[];
};

function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function toOrderItemPublic(item: OrderItem): OrderItemPublic {
  return {
    id: item.id,
    productId: item.productId,
    productName: item.productName,
    productImage: item.productImage,
    specSnapshot: item.specSnapshot,
    specText: item.specText,
    unitPriceCents: item.unitPriceCents,
    quantity: item.quantity,
    totalCents: item.totalCents,
    remark: item.remark,
  };
}

function toOrderEventPublic(event: OrderEvent): OrderEventPublic {
  return {
    id: event.id,
    fromStatus: event.fromStatus,
    toStatus: event.toStatus,
    actorType: event.actorType,
    actorId: event.actorId,
    note: event.note,
    createdAt: event.createdAt.toISOString(),
  };
}

export function toOrderPublic(order: OrderWithRelations): OrderPublic {
  return {
    id: order.id,
    orderNo: order.orderNo,
    status: order.status,
    pickupType: order.pickupType,
    pickupTimeType: order.pickupTimeType,
    scheduledAt: iso(order.scheduledAt),
    releaseAt: iso(order.releaseAt),
    releasedAt: iso(order.releasedAt),
    pickupCode: order.pickupCode,
    businessDate: dateOnly(order.businessDate),
    itemsAmountCents: order.itemsAmountCents,
    discountCents: order.discountCents,
    payableCents: order.payableCents,
    paidCents: order.paidCents,
    remark: order.remark,
    contactName: order.contactName,
    contactPhone: order.contactPhone,
    estimatedReadyAt: iso(order.estimatedReadyAt),
    expiresAt: order.expiresAt.toISOString(),
    paidAt: iso(order.paidAt),
    acceptedAt: iso(order.acceptedAt),
    readyAt: iso(order.readyAt),
    completedAt: iso(order.completedAt),
    noShowAt: iso(order.noShowAt),
    canceledAt: iso(order.canceledAt),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    items: order.items.map(toOrderItemPublic),
    events: order.events.map(toOrderEventPublic),
  };
}
