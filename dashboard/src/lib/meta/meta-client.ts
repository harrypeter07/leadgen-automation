// lib/meta/meta-client.ts
export const GRAPH_BASE = 'https://graph.facebook.com'
export const API_VERSION = process.env.META_GRAPH_API_VERSION || 'v23.0'
export const API_ROOT = `${GRAPH_BASE}/${API_VERSION}`

export interface MetaApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: { message: string; type: string; code: number; fbtrace_id?: string }
  statusCode: number
  duration: number
  endpoint: string
  requestId: string
}

export interface MetaClientOptions {
  accessToken?: string
  timeout?: number
  retries?: number
  source?: string
}

function getDefaultToken(): string {
  return process.env.META_PAGE_ACCESS_TOKEN || ''
}

function generateRequestId(): string {
  return `meta_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

async function metaFetch<T>(
  endpoint: string,
  options: RequestInit & MetaClientOptions = {}
): Promise<MetaApiResponse<T>> {
  // Dynamically import/call ensureMetaConfig to avoid circular dependencies
  try {
    const { ensureMetaConfig } = require('./runtime-config')
    await ensureMetaConfig()
  } catch (err) {
    console.warn('[MetaClient] Failed to execute ensureMetaConfig:', err)
  }

  const start = Date.now()
  const requestId = generateRequestId()
  const token = options.accessToken || getDefaultToken()
  const timeout = options.timeout || 15000
  const maxRetries = options.retries ?? 2
  const source = options.source || 'unknown'
  const url = endpoint.includes('access_token=') ? endpoint : `${endpoint}${endpoint.includes('?') ? '&' : '?'}access_token=${token}`
  let lastError: Error | null = null
  let attempt = 0
  while (attempt <= maxRetries) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeout)
      const res = await fetch(url, { ...options, signal: controller.signal, headers: { 'Content-Type': 'application/json', 'User-Agent': 'FlowFyp/1.0', ...(options.headers as Record<string, string> || {}) } })
      clearTimeout(timer)
      const duration = Date.now() - start
      const data = await res.json() as Record<string, unknown>
      const hasError = !!data?.error
      console.log(`[MetaClient] ${JSON.stringify({ requestId, source, method: options.method || 'GET', endpoint: endpoint.replace(/access_token=[^&]*/g, 'access_token=***'), statusCode: res.status, duration, attempt: attempt + 1, error: hasError ? (data.error as Record<string,string>)?.message : null })}`)
      return { success: !hasError && res.ok, data: hasError ? undefined : (data as T), error: hasError ? (data.error as MetaApiResponse['error']) : undefined, statusCode: res.status, duration, endpoint: endpoint.replace(/access_token=[^&]*/g, 'access_token=***'), requestId }
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err))
      attempt++
      if (attempt <= maxRetries) await new Promise(r => setTimeout(r, 500 * attempt))
    }
  }
  return { success: false, error: { message: lastError?.message || 'Request failed', type: 'NetworkError', code: 0 }, statusCode: 0, duration: Date.now() - start, endpoint, requestId }
}

export const MetaClient = {
  get: <T>(path: string, opts?: MetaClientOptions) => metaFetch<T>(`${API_ROOT}${path}`, { method: 'GET', ...opts }),
  post: <T>(path: string, body: Record<string, unknown>, opts?: MetaClientOptions) => metaFetch<T>(`${API_ROOT}${path}`, { method: 'POST', body: JSON.stringify(body), ...opts }),
  delete: <T>(path: string, opts?: MetaClientOptions) => metaFetch<T>(`${API_ROOT}${path}`, { method: 'DELETE', ...opts }),
  rawGet: <T>(url: string, opts?: MetaClientOptions) => metaFetch<T>(url, { method: 'GET', ...opts }),
}
