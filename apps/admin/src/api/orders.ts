import client from './client'
import type {
  AdminOrder,
  AdminOrderList,
  AdminOrderListParams,
} from '../types/order'

export async function fetchOrders(
  params: AdminOrderListParams,
): Promise<AdminOrderList> {
  const { data } = await client.get<AdminOrderList>('/admin/orders', { params })
  return data
}

export async function fetchOrder(id: string): Promise<AdminOrder> {
  const { data } = await client.get<AdminOrder>(`/admin/orders/${id}`)
  return data
}

export async function acceptOrder(id: string): Promise<AdminOrder> {
  const { data } = await client.post<AdminOrder>(`/admin/orders/${id}/accept`)
  return data
}

export async function readyOrder(id: string): Promise<AdminOrder> {
  const { data } = await client.post<AdminOrder>(`/admin/orders/${id}/ready`)
  return data
}

export async function completeOrder(id: string): Promise<AdminOrder> {
  const { data } = await client.post<AdminOrder>(`/admin/orders/${id}/complete`)
  return data
}

export async function rejectOrder(
  id: string,
  reason: string,
): Promise<AdminOrder> {
  const { data } = await client.post<AdminOrder>(`/admin/orders/${id}/reject`, {
    reason,
  })
  return data
}
