// lib/meta/meta-logger.ts
// Logs Meta Graph API requests/responses both to console AND
// to the Supabase meta_request_logs table (fire-and-forget, non-blocking).
export type LogLevel = 'info' | 'warn' | 'error' | 'debug'

export interface MetaLogEntry {
  level: LogLevel
  timestamp: string
  source: string
  event: string
  requestId?: string
  endpoint?: string
  method?: string
  statusCode?: number
  duration?: number
  retryCount?: number
  workflowSource?: string
  payload?: Record<string, unknown>
  response?: Record<string, unknown>
  headers?: Record<string, string>
  error?: string
  graphError?: { message: string; type: string; code: number }
}

function scrubSecrets(obj: Record<string, unknown>): Record<string, unknown> {
  if (!obj || typeof obj !== 'object') return obj
  const scrubbed = { ...obj }
  const secretKeys = ['access_token', 'app_secret', 'password', 'token', 'verify_token', 'webhook_secret']
  for (const key of Object.keys(scrubbed)) {
    if (secretKeys.some(s => key.toLowerCase().includes(s))) scrubbed[key] = '***'
    else if (typeof scrubbed[key] === 'object' && scrubbed[key] !== null)
      scrubbed[key] = scrubSecrets(scrubbed[key] as Record<string, unknown>)
  }
  return scrubbed
}

/** Persist a single log entry to Supabase (fire-and-forget) */
function persistToSupabase(entry: MetaLogEntry): void {
  import('@/lib/supabase').then(({ supabaseAdmin }) => {
    Promise.resolve(supabaseAdmin.from('meta_request_logs').insert({
      timestamp: entry.timestamp,
      level: entry.level,
      source: entry.source,
      event: entry.event,
      method: entry.method,
      endpoint: entry.endpoint,
      status_code: entry.statusCode,
      duration_ms: entry.duration,
      request_id: entry.requestId,
      workflow_source: entry.workflowSource,
      graph_error: entry.graphError ? JSON.parse(JSON.stringify(entry.graphError)) : null,
      payload: entry.payload ? JSON.parse(JSON.stringify(scrubSecrets(entry.payload))) : null,
      response: entry.response ? JSON.parse(JSON.stringify(scrubSecrets(entry.response as Record<string, unknown>))) : null,
      retry_count: entry.retryCount ?? 0,
      error: entry.error ?? null,
    })).then(res => {
      if (res.error) console.warn('[MetaLogger] Supabase DB Insert error:', res.error)
    }).catch((err: unknown) => {
      console.warn('[MetaLogger] Supabase DB catch error:', err)
    })
  }).catch(err => {
    console.warn('[MetaLogger] Supabase import error:', err)
  })
}

function log(entry: MetaLogEntry): void {
  const clean = {
    ...entry,
    payload: entry.payload ? scrubSecrets(entry.payload) : undefined,
    headers: entry.headers ? scrubSecrets(entry.headers as Record<string, unknown>) as Record<string, string> : undefined,
  }
  const prefix = `[MetaLogger:${entry.level.toUpperCase()}]`
  const line = `${prefix} [${entry.source}] ${entry.event}${entry.duration ? ` (${entry.duration}ms)` : ''}${entry.error ? ` ERROR: ${entry.error}` : ''}`
  if (entry.level === 'error') console.error(line, JSON.stringify(clean))
  else if (entry.level === 'warn') console.warn(line, JSON.stringify(clean))
  else console.log(line, JSON.stringify(clean))

  // Async persist to Supabase (non-blocking)
  persistToSupabase(entry)
}

export const MetaLogger = {
  info:  (source: string, event: string, extra?: Partial<MetaLogEntry>) =>
    log({ level: 'info',  timestamp: new Date().toISOString(), source, event, ...extra }),
  warn:  (source: string, event: string, extra?: Partial<MetaLogEntry>) =>
    log({ level: 'warn',  timestamp: new Date().toISOString(), source, event, ...extra }),
  error: (source: string, event: string, extra?: Partial<MetaLogEntry>) =>
    log({ level: 'error', timestamp: new Date().toISOString(), source, event, ...extra }),
  debug: (source: string, event: string, extra?: Partial<MetaLogEntry>) =>
    log({ level: 'debug', timestamp: new Date().toISOString(), source, event, ...extra }),
  request: (source: string, method: string, endpoint: string, payload?: Record<string, unknown>) =>
    log({ level: 'info', timestamp: new Date().toISOString(), source, event: 'API_REQUEST', method, endpoint: endpoint.replace(/access_token=[^&]*/g, 'access_token=***'), payload }),
  response: (source: string, endpoint: string, statusCode: number, duration: number, graphError?: MetaLogEntry['graphError']) =>
    log({ level: graphError ? 'error' : 'info', timestamp: new Date().toISOString(), source, event: 'API_RESPONSE', endpoint: endpoint.replace(/access_token=[^&]*/g, 'access_token=***'), statusCode, duration, graphError }),
}
