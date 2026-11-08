export type AdminOrderStatus =
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'ACCEPTED'
  | 'READY'
  | 'COMPLETED'
  | 'NO_SHOW'
  | 'CANCELED'
  | 'REFUNDING'
  | 'REFUNDED'

export type AdminPickupTimeType = 'ASAP' | 'SCHEDULED'
export type AdminOrderTab = 'ACTIVE' | 'SCHEDULED' | 'ALL'

export interface AdminOrderItem {
  id: string
  productId: string
  productName: string
  productImage: string | null
  specSnapshot: unknown
  specText: string
  unitPriceCents: number
  quantity: number
  totalCents: number
  remark: string | null
}

export interface AdminOrderEvent {
  id: string
  fromStatus: AdminOrderStatus | null
  toStatus: AdminOrderStatus
  actorType: 'CUSTOMER' | 'STAFF' | 'SYSTEM'
  actorId: string | null
  note: string | null
  createdAt: string
}

export interface AdminOrder {
  id: string
  orderNo: string
  status: AdminOrderStatus
  pickupType: 'SELF_PICKUP'
  pickupTimeType: AdminPickupTimeType
  scheduledAt: string | null
  releaseAt: string | null
  releasedAt: string | null
  pickupCode: string | null
  businessDate: string
  itemsAmountCents: number
  discountCents: number
  payableCents: number
  paidCents: number
  remark: string | null
  contactName: string | null
  contactPhone: string | null
  estimatedReadyAt: string | null
  expiresAt: string
  paidAt: string | null
  acceptedAt: string | null
  readyAt: string | null
  completedAt: string | null
  noShowAt: string | null
  canceledAt: string | null
  createdAt: string
  updatedAt: string
  items: AdminOrderItem[]
  events: AdminOrderEvent[]
}

export interface AdminOrderCounts {
  active: number
  scheduled: number
  all: number
}

export interface AdminOrderList {
  items: AdminOrder[]
  total: number
  page: number
  pageSize: number
  counts: AdminOrderCounts
}

export interface AdminOrderListParams {
  tab?: AdminOrderTab
  status?: AdminOrderStatus
  type?: AdminPickupTimeType
  date?: string
  keyword?: string
  page?: number
  pageSize?: number
}
