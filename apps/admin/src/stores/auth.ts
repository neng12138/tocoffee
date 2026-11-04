import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { fetchStaffMe, loginStaff } from '../api/auth'
import { TOKEN_KEY } from '../constants/auth'
import type { StaffProfile } from '../types/catalog'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem(TOKEN_KEY) ?? '')
  const staff = ref<StaffProfile | null>(null)
  const loading = ref(false)

  const isLoggedIn = computed(() => Boolean(token.value))

  async function login(username: string, password: string): Promise<void> {
    loading.value = true
    try {
      const result = await loginStaff(username, password)
      token.value = result.token
      staff.value = result.staff
      localStorage.setItem(TOKEN_KEY, result.token)
    } finally {
      loading.value = false
    }
  }

  async function loadMe(): Promise<void> {
    if (!token.value) {
      return
    }
    staff.value = await fetchStaffMe()
  }

  function logout(): void {
    token.value = ''
    staff.value = null
    localStorage.removeItem(TOKEN_KEY)
  }

  return { token, staff, loading, isLoggedIn, login, loadMe, logout }
})
