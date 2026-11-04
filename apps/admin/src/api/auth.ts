import client from './client'
import type { StaffProfile } from '../types/catalog'

interface StaffLoginResponse {
  token: string
  staff: StaffProfile
}

export async function loginStaff(username: string, password: string): Promise<StaffLoginResponse> {
  const { data } = await client.post<StaffLoginResponse>('/admin/auth/login', {
    username,
    password,
  })
  return data
}

export async function fetchStaffMe(): Promise<StaffProfile> {
  const { data } = await client.get<StaffProfile>('/admin/auth/me')
  return data
}
