import { authRequest } from './client'
import type {
  CreateOrderInput,
  Order,
  OrderList,
  OrderListTab,
  OrderStatus,
  PickupTimeType,
  Quote,
  QuoteInput,
} from '@/types/order'

export function quoteOrder(input: QuoteInput): Promise<Quote> {
  return authRequest<Quote>('/orders/quote', {
    method: 'POST',
    data: input as unknown as Record<string, unknown>,
  })
}

export function createOrder(input: CreateOrderInput, idempotencyKey: string): Promise<Order> {
  return authRequest<Order>('/orders', {
    method: 'POST',
    header: { 'Idempotency-Key': idempotencyKey },
    data: input as unknown as Record<string, unknown>,
  })
}

export function payOrder(orderId: string): Promise<Order> {
  return authRequest<Order>(`/orders/${orderId}/pay`, {
    method: 'POST',
  })
}

export function fetchOrder(orderId: string): Promise<Order> {
  return authRequest<Order>(`/orders/${orderId}`)
}

export function fetchOrders(params: {
  tab?: OrderListTab
  status?: OrderStatus
  page?: number
  pageSize?: number
} = {}): Promise<OrderList> {
  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&')
  return authRequest<OrderList>(`/orders${query ? `?${query}` : ''}`)
}

export function cancelOrder(orderId: string, reason?: string): Promise<Order> {
  return authRequest<Order>(`/orders/${orderId}/cancel`, {
    method: 'POST',
    data: reason ? { reason } : {},
  })
}

export function pickupLabel(type: PickupTimeType): string {
  return type === 'ASAP' ? '立即取餐' : '预约取餐'
}
