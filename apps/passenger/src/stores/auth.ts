import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { fetchCustomerMe, loginCustomer, requestCustomerCode } from '@/api/auth'
import { ApiClientError } from '@/api/client'
import { CUSTOMER_MEMBER_KEY, CUSTOMER_TOKEN_KEY } from '@/constants/auth'
import type { LoginResult, Member, RequestCodeResult } from '@/types/order'

function readToken(): string {
  try {
    return (uni.getStorageSync(CUSTOMER_TOKEN_KEY) as string) || ''
  } catch {
    return ''
  }
}

function readMember(): Member | null {
  try {
    const value = uni.getStorageSync(CUSTOMER_MEMBER_KEY) as Member | ''
    return value && typeof value === 'object' ? value : null
  } catch {
    return null
  }
}

export const useAuthStore = defineStore('customer-auth', () => {
  const token = ref(readToken())
  const member = ref<Member | null>(readMember())
  const loading = ref(false)

  const isLoggedIn = computed(() => Boolean(token.value))
  const displayName = computed(() => {
    return member.value?.nickname || `顾客${member.value?.phone.slice(-4) ?? ''}`
  })

  function setSession(result: LoginResult): void {
    token.value = result.token
    member.value = result.member
    uni.setStorageSync(CUSTOMER_TOKEN_KEY, result.token)
    uni.setStorageSync(CUSTOMER_MEMBER_KEY, result.member)
  }

  function logout(): void {
    token.value = ''
    member.value = null
    uni.removeStorageSync(CUSTOMER_TOKEN_KEY)
    uni.removeStorageSync(CUSTOMER_MEMBER_KEY)
  }

  async function requestCode(phone: string): Promise<RequestCodeResult> {
    return requestCustomerCode(phone)
  }

  async function login(phone: string, code: string): Promise<LoginResult> {
    loading.value = true
    try {
      const result = await loginCustomer(phone, code)
      setSession(result)
      return result
    } finally {
      loading.value = false
    }
  }

  async function loadMe(): Promise<void> {
    if (!token.value) return
    try {
      member.value = await fetchCustomerMe()
      uni.setStorageSync(CUSTOMER_MEMBER_KEY, member.value)
    } catch (error) {
      if (error instanceof ApiClientError && error.statusCode === 401) logout()
    }
  }

  return {
    token,
    member,
    loading,
    isLoggedIn,
    displayName,
    requestCode,
    login,
    loadMe,
    logout,
  }
})
