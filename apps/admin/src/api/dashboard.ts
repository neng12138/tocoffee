import client from './client'
import type { DashboardSummary } from '../types/dashboard'

export async function fetchDashboard(date?: string): Promise<DashboardSummary> {
  const { data } = await client.get<DashboardSummary>('/admin/dashboard', {
    params: date ? { date } : undefined,
  })
  return data
}
