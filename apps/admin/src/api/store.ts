import client from './client'
import type { AdminStore, UpdateStoreInput } from '../types/store'

export async function fetchAdminStore(): Promise<AdminStore> {
  const { data } = await client.get<AdminStore>('/admin/store')
  return data
}

export async function updateAdminStore(input: UpdateStoreInput): Promise<AdminStore> {
  const { data } = await client.patch<AdminStore>('/admin/store', input)
  return data
}
