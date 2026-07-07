import { NextRequest, NextResponse } from 'next/server'

const GRAPH_BASE = 'https://graph.facebook.com'
const API_VERSION = process.env.META_GRAPH_API_VERSION || 'v23.0'

// GET /api/meta/permissions — Lists all Graph API permissions granted to the page token
export async function GET(_req: NextRequest) {
  try {
    const { ensureMetaConfig } = require('@/lib/meta/runtime-config')
    await ensureMetaConfig()
  } catch (err) {
    console.warn('[permissions] Failed to execute ensureMetaConfig:', err)
  }

  const pageToken = process.env.META_PAGE_ACCESS_TOKEN || ''
  const appId     = process.env.META_APP_ID || ''
  const appSecret = process.env.META_APP_SECRET || ''

  if (!pageToken) {
    return NextResponse.json({ error: 'META_PAGE_ACCESS_TOKEN not configured.' }, { status: 400 })
  }

  try {
    // Inspect token to get permissions
    const appToken = `${appId}|${appSecret}`
    const debugUrl = `${GRAPH_BASE}/${API_VERSION}/debug_token?input_token=${pageToken}&access_token=${appToken}`
    const debugRes = await fetch(debugUrl)
    const debug = await debugRes.json()

    // Also fetch user permissions
    const permRes = await fetch(`${GRAPH_BASE}/${API_VERSION}/me/permissions?access_token=${pageToken}`)
    const perms = await permRes.json()

    return NextResponse.json({
      success: !debug.error,
      token_info: debug.data || debug,
      permissions: perms.data || [],
      token_valid: debug.data?.is_valid ?? false,
      expires_at: debug.data?.expires_at
        ? new Date(debug.data.expires_at * 1000).toISOString()
        : 'Permanent (System User Token)',
      scopes: debug.data?.scopes || [],
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
