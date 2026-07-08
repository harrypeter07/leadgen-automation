// lib/meta/oauth-service.ts
import { MetaClient, GRAPH_BASE, API_VERSION } from './meta-client'
import { MetaLogger } from './meta-logger'
const SOURCE = 'OAuthService'
function getAppId() { return process.env.META_APP_ID || '' }
function getAppSecret() { return process.env.META_APP_SECRET || '' }
function getRedirectUri() { return process.env.META_OAUTH_REDIRECT_URI || '' }
export const OAuthService = {
  getAuthUrl(scopes = ['pages_show_list', 'pages_read_engagement', 'pages_messaging', 'instagram_basic', 'instagram_manage_messages']) {
    const params = new URLSearchParams({ client_id: getAppId(), redirect_uri: getRedirectUri(), scope: scopes.join(','), response_type: 'code', state: `flowfyp_${Date.now()}` })
    return `${GRAPH_BASE}/dialog/oauth?${params.toString()}`
  },
  async exchangeCode(code: string) {
    MetaLogger.info(SOURCE, 'CODE_EXCHANGE_START', { payload: { code: '***' } })
    const params = new URLSearchParams({ client_id: getAppId(), client_secret: getAppSecret(), redirect_uri: getRedirectUri(), code })
    const res = await fetch(`${GRAPH_BASE}/${API_VERSION}/oauth/access_token?${params.toString()}`)
    const data = await res.json() as Record<string, unknown>
    MetaLogger.info(SOURCE, 'CODE_EXCHANGE_DONE', { statusCode: res.status })
    return { success: res.ok, data }
  },
  async getLongLivedToken(shortLivedToken: string) {
    MetaLogger.info(SOURCE, 'LONG_LIVED_TOKEN_EXCHANGE')
    const params = new URLSearchParams({ grant_type: 'fb_exchange_token', client_id: getAppId(), client_secret: getAppSecret(), fb_exchange_token: shortLivedToken })
    const res = await fetch(`${GRAPH_BASE}/${API_VERSION}/oauth/access_token?${params.toString()}`)
    const data = await res.json() as Record<string, unknown>
    return { success: res.ok, data }
  },
  async debugToken(inputToken: string) {
    const appToken = `${getAppId()}|${getAppSecret()}`
    const endpoint = `/debug_token?input_token=${inputToken}&access_token=${appToken}`
    MetaLogger.request(SOURCE, 'GET', endpoint)
    const res = await MetaClient.get<Record<string, unknown>>(endpoint, { source: SOURCE })
    MetaLogger.response(SOURCE, endpoint, res.statusCode, res.duration, res.error as import('./meta-client').MetaApiResponse['error'])
    return res
  },
  async validateToken(token?: string) {
    const useToken = token || process.env.META_PAGE_ACCESS_TOKEN || ''
    if (!useToken) return { valid: false, reason: 'No token provided' }
    const res = await OAuthService.debugToken(useToken)
    const info = res.data as Record<string, unknown> | undefined
    return { valid: info?.data ? (info.data as Record<string, boolean>).is_valid : false, expires_at: info?.data ? (info.data as Record<string, number>).expires_at : null, scopes: info?.data ? (info.data as Record<string, string[]>).scopes : [], app_id: info?.data ? (info.data as Record<string, string>).app_id : null }
  },
}
