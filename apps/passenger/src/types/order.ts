export type PickupTimeType = 'ASAP' | 'SCHEDULED'

export type OrderListTab =
  | 'ALL'
  | 'PENDING_PAYMENT'
  | 'ACTIVE'
  | 'FINISHED'
  | 'CANCELED'

export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'ACCEPTED'
  | 'READY'
  | 'COMPLETED'
  | 'NO_SHOW'
  | 'CANCELED'
  | 'REFUNDING'
  | 'REFUNDED'

export interface Member {
  id: string
  phone: string
  nickname: string | null
  avatarUrl: string | null
  createdAt: string
}

export interface LoginResult {
  token: string
  member: Member
}

export interface RequestCodeResult {
  expiresInSeconds: number
  devCode?: string
}

export interface QuoteItemInput {
  productId: string
  quantity: number
  optionIds: string[]
}

export interface QuoteInput {
  items: QuoteItemInput[]
  pickupTimeType: PickupTimeType
  scheduledAt?: string
}

export interface QuoteOptionSnapshot {
  groupId: string
  groupName: string
  optionId: string
  optionName: string
  priceDeltaCents: number
}

export interface QuoteLine {
  productId: string
  name: string
  imageUrl: string | null
  quantity: number
  unitPriceCents: number
  totalCents: number
  options: QuoteOptionSnapshot[]
  specText: string
}

export interface Quote {
  items: QuoteLine[]
  itemsAmountCents: number
  discountCents: number
  payableCents: number
  pickupTimeType: PickupTimeType
  scheduledAt: string | null
  estimatedReadyAt: string
}

export interface CreateOrderInput extends QuoteInput {
  expectedTotalCents: number
  contactName?: string
  contactPhone?: string
  remark?: string
}

export interface OrderItem {
  id: string
  productId: string
  productName: string
  productImage: string | null
  specSnapshot: QuoteOptionSnapshot[]
  specText: string
  unitPriceCents: number
  quantity: number
  totalCents: number
  remark: string | null
}

export interface OrderEvent {
  id: string
  fromStatus: OrderStatus | null
  toStatus: OrderStatus
  actorType: string
  actorId: string | null
  note: string
  createdAt: string
}

export interface Order {
  id: string
  orderNo: string
  status: OrderStatus
  pickupType: string
  pickupTimeType: PickupTimeType
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
  contactName: string
  contactPhone: string
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
  items: OrderItem[]
  events: OrderEvent[]
}

export interface OrderList {
  items: Order[]
  total: number
  page: number
  pageSize: number
}
