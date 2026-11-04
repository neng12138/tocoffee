import client from './client'
import type { AdminCategory, CategoryInput } from '../types/catalog'

export async function fetchCategories(): Promise<AdminCategory[]> {
  const { data } = await client.get<{ categories: AdminCategory[] }>('/admin/categories')
  return data.categories
}

export async function createCategory(input: CategoryInput): Promise<AdminCategory> {
  const { data } = await client.post<AdminCategory>('/admin/categories', input)
  return data
}

export async function updateCategory(id: string, input: CategoryInput): Promise<AdminCategory> {
  const { data } = await client.patch<AdminCategory>(`/admin/categories/${id}`, input)
  return data
}

export async function archiveCategory(id: string): Promise<void> {
  await client.delete(`/admin/categories/${id}`)
}
