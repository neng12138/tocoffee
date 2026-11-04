import axios from 'axios'

export function getErrorMessage(error: unknown, fallback = '操作失败，请稍后重试'): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: unknown } | undefined
    if (data && typeof data.message === 'string' && data.message) {
      return data.message
    }
    if (error.response?.status === 401) {
      return '登录已过期，请重新登录'
    }
    return error.message || fallback
  }

  return error instanceof Error ? error.message : fallback
}
