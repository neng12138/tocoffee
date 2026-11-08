import { authRequest, request } from './client'
import type { LoginResult, RequestCodeResult } from '@/types/order'

export function requestCustomerCode(phone: string): Promise<RequestCodeResult> {
  return request<RequestCodeResult>('/auth/code', {
    method: 'POST',
    data: { phone },
  })
}

export function loginCustomer(phone: string, code: string): Promise<LoginResult> {
  return request<LoginResult>('/auth/login', {
    method: 'POST',
    data: { phone, code },
  })
}

export function fetchCustomerMe() {
  return authRequest<LoginResult['member']>('/auth/me')
}
