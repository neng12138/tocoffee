import client from './client'
import type {
  AdminSpecGroup,
  AdminSpecOption,
  SpecGroupInput,
  SpecOptionInput,
} from '../types/catalog'

export async function fetchSpecGroups(): Promise<AdminSpecGroup[]> {
  const { data } = await client.get<{ groups: AdminSpecGroup[] }>('/admin/spec-groups')
  return data.groups
}

export async function createSpecGroup(input: SpecGroupInput): Promise<AdminSpecGroup> {
  const { data } = await client.post<AdminSpecGroup>('/admin/spec-groups', input)
  return data
}

export async function updateSpecGroup(
  id: string,
  input: Partial<SpecGroupInput>,
): Promise<AdminSpecGroup> {
  const { data } = await client.patch<AdminSpecGroup>(`/admin/spec-groups/${id}`, input)
  return data
}

export async function deleteSpecGroup(id: string): Promise<void> {
  await client.delete(`/admin/spec-groups/${id}`)
}

export async function createSpecOption(
  groupId: string,
  input: SpecOptionInput,
): Promise<AdminSpecOption> {
  const { data } = await client.post<AdminSpecOption>(
    `/admin/spec-groups/${groupId}/options`,
    input,
  )
  return data
}

export async function updateSpecOption(
  id: string,
  input: Partial<SpecOptionInput>,
): Promise<AdminSpecOption> {
  const { data } = await client.patch<AdminSpecOption>(`/admin/spec-options/${id}`, input)
  return data
}

export async function deleteSpecOption(id: string): Promise<void> {
  await client.delete(`/admin/spec-options/${id}`)
}
