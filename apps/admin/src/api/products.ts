import client from './client'
import type {
  AdminProduct,
  AdminProductDetail,
  ProductInput,
  ProductStatus,
} from '../types/catalog'

export interface ProductQuery {
  categoryId?: string
  status?: ProductStatus
  keyword?: string
}

export async function fetchProducts(query: ProductQuery = {}): Promise<AdminProduct[]> {
  const { data } = await client.get<{ products: AdminProduct[] }>('/admin/products', {
    params: query,
  })
  return data.products
}

export async function fetchProduct(id: string): Promise<AdminProductDetail> {
  const { data } = await client.get<AdminProductDetail>(`/admin/products/${id}`)
  return data
}

export async function createProduct(input: ProductInput): Promise<AdminProductDetail> {
  const { data } = await client.post<AdminProductDetail>('/admin/products', input)
  return data
}

export async function updateProduct(
  id: string,
  input: Partial<ProductInput>,
): Promise<AdminProductDetail> {
  const { data } = await client.patch<AdminProductDetail>(`/admin/products/${id}`, input)
  return data
}

export async function updateProductStatus(
  id: string,
  status: ProductStatus,
): Promise<AdminProductDetail> {
  const { data } = await client.patch<AdminProductDetail>(`/admin/products/${id}/status`, {
    status,
  })
  return data
}

export async function archiveProduct(id: string): Promise<void> {
  await client.delete(`/admin/products/${id}`)
}
