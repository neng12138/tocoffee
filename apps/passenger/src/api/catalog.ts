import type { MenuResponse, Product, StoreInfo } from '@/types/catalog'
import { request } from './client'

export function fetchStore(): Promise<StoreInfo> {
  return request<StoreInfo>('/store')
}

export function fetchMenu(): Promise<MenuResponse> {
  return request<MenuResponse>('/menu')
}

export function fetchProduct(productId: string): Promise<Product> {
  return request<Product>(`/products/${productId}`)
}
