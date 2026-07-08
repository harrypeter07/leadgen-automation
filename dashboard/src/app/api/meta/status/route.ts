import { NextRequest, NextResponse } from 'next/server'

const GRAPH_BASE = 'https://graph.facebook.com'
const API_VERSION = process.env.META_GRAPH_API_VERSION || 'v23.0'

// GET /api/meta/status — Live connection status for all providers
export async function GET(_req: NextRequest) {
  const pageToken = process.env.META_PAGE_ACCESS_TOKEN || ''
  const pageId    = process.env.META_PAGE_ID || ''
  const igBizId   = process.env.INSTAGRAM_BUSINESS_ID || ''
  const appId     = process.env.META_APP_ID || ''
  const appSecret = process.env.META_APP_SECRET || ''
  const verifyToken = process.env.META_VERIFY_TOKEN || ''

  const results: Record<string, {
    connected: boolean
    status: string
    detail?: string
  }> = {}

  // Test Meta App
  if (appId && appSecret) {
    try {
      const appToken = `${appId}|${appSecret}`
      const res = await fetch(`${GRAPH_BASE}/${API_VERSION}/app?access_token=${appToken}`)
      const data = await res.json()
      results.meta_app = {
        connected: !data.error,
        status: data.error ? 'error' : 'connected',
        detail: data.error ? data.error.message : `App: ${data.name || appId}`
      }
    } catch {
      results.meta_app = { connected: false, status: 'error', detail: 'Request failed' }
    }
  } else {
    results.meta_app = { connected: false, status: 'not_configured', detail: 'META_APP_ID / META_APP_SECRET missing' }
  }

  // Test Facebook Page
  if (pageToken && pageId) {
    try {
      const res = await fetch(`${GRAPH_BASE}/${API_VERSION}/${pageId}?fields=id,name&access_token=${pageToken}`)
      const data = await res.json()
      results.facebook = {
        connected: !data.error,
        status: data.error ? 'error' : 'connected',
        detail: data.error ? data.error.message : `Page: ${data.name || pageId}`
      }
    } catch {
      results.facebook = { connected: false, status: 'error', detail: 'Request failed' }
    }
  } else {
    results.facebook = { connected: false, status: 'not_configured', detail: 'META_PAGE_ACCESS_TOKEN / META_PAGE_ID missing' }
  }

  // Test Instagram
  if (pageToken && igBizId) {
    try {
      const res = await fetch(`${GRAPH_BASE}/${API_VERSION}/${igBizId}?fields=id,username&access_token=${pageToken}`)
      const data = await res.json()
      results.instagram = {
        connected: !data.error,
        status: data.error ? 'error' : 'connected',
        detail: data.error ? data.error.message : `IG: @${data.username || igBizId}`
      }
    } catch {
      results.instagram = { connected: false, status: 'error', detail: 'Request failed' }
    }
  } else {
    results.instagram = { connected: false, status: 'not_configured', detail: 'INSTAGRAM_BUSINESS_ID missing' }
  }

  // Messenger (same credentials as Facebook Page)
  results.messenger = {
    connected: results.facebook.connected,
    status: results.facebook.status,
    detail: results.facebook.connected ? 'Messenger uses Page token — connected' : 'Page token required'
  }

  // Webhooks (local config check)
  results.webhooks = {
    connected: !!verifyToken,
    status: verifyToken ? 'configured' : 'not_configured',
    detail: verifyToken
      ? `Verify token set. Callback: ${process.env.META_WEBHOOK_CALLBACK_URL || 'not set'}`
      : 'META_VERIFY_TOKEN missing'
  }

  const allConnected = Object.values(results).every(r => r.connected)

  return NextResponse.json({
    all_connected: allConnected,
    providers: results,
    graph_api_version: API_VERSION,
    timestamp: new Date().toISOString()
  })
}
