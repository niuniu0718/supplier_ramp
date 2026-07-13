const API_BASE = '/api'

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}, userId?: string): Promise<T> {
  const headers = new Headers(options.headers)
  if (userId) headers.set('X-User-Id', userId)
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json')

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ message: '请求失败，请稍后重试。' }))
    throw new ApiError(payload.message ?? '请求失败，请稍后重试。', response.status)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const api = {
  get: <T>(path: string, userId?: string) => apiRequest<T>(path, {}, userId),
  post: <T>(path: string, body: unknown, userId: string) => apiRequest<T>(path, { method: 'POST', body: JSON.stringify(body) }, userId),
  patch: <T>(path: string, body: unknown, userId: string) => apiRequest<T>(path, { method: 'PATCH', body: JSON.stringify(body) }, userId),
  put: <T>(path: string, body: unknown, userId: string) => apiRequest<T>(path, { method: 'PUT', body: JSON.stringify(body) }, userId),
}
