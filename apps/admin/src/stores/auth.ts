import { defineStore } from 'pinia'
import { ref } from 'vue'

const TOKEN_KEY = 'tocoffee_admin_token'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem(TOKEN_KEY) ?? '')

  function setToken(nextToken: string) {
    token.value = nextToken
    localStorage.setItem(TOKEN_KEY, nextToken)
  }

  function clearToken() {
    token.value = ''
    localStorage.removeItem(TOKEN_KEY)
  }

  return { token, setToken, clearToken }
})
