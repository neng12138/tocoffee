let defaultBaseUrl = '/api'

// 小程序没有 Vite 代理，开发时直连本机 API。
// #ifndef H5
defaultBaseUrl = 'http://127.0.0.1:3000/api'
// #endif

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || defaultBaseUrl).replace(/\/$/, '')

export class ApiClientError extends Error {
  readonly code: string
  readonly statusCode: number
  readonly details?: unknown

  constructor(code: string, message: string, statusCode: number, details?: unknown) {
    super(message)
    this.name = 'ApiClientError'
    this.code = code
    this.statusCode = statusCode
    this.details = details
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: string | Record<string, unknown> | ArrayBuffer
  header?: Record<string, string>
  timeout?: number
}

interface ErrorBody {
  code?: string
  message?: string
  details?: unknown
}

export function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`

  return new Promise<T>((resolve, reject) => {
    uni.request({
      url,
      method: options.method ?? 'GET',
      data: options.data,
      header: options.header,
      timeout: options.timeout ?? 10000,
      success: (response) => {
        const { statusCode } = response
        if (statusCode >= 200 && statusCode < 300) {
          resolve(response.data as T)
          return
        }

        const body = (response.data ?? {}) as ErrorBody
        reject(
          new ApiClientError(
            body.code ?? 'REQUEST_FAILED',
            body.message ?? `请求失败（${statusCode}）`,
            statusCode,
            body.details,
          ),
        )
      },
      fail: (error) => {
        reject(new ApiClientError('NETWORK_ERROR', '网络连接失败，请确认 API 已启动', 0, error))
      },
    })
  })
}
