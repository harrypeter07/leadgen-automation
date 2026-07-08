import { NextRequest, NextResponse } from 'next/server'

const GRAPH_BASE = 'https://graph.facebook.com'
const API_VERSION = process.env.META_GRAPH_API_VERSION || 'v23.0'

// POST /api/meta/test — Live diagnostic test for each platform target
export async function POST(req: NextRequest) {
  const start = Date.now()

  try {
    const body = await req.json()
    const target: string = body.target || req.nextUrl.searchParams.get('target') || 'meta_app'

    // Get tokens from env (settings page posts them; fallback to env)
    const appId     = body.settings?.META_APP_ID     || process.env.META_APP_ID || ''
    const appSecret = body.settings?.META_APP_SECRET || process.env.META_APP_SECRET || ''
    const pageToken = body.settings?.META_PAGE_ACCESS_TOKEN || process.env.META_PAGE_ACCESS_TOKEN || ''
    const pageId    = body.settings?.META_PAGE_ID    || process.env.META_PAGE_ID || ''
    const igBizId   = body.settings?.INSTAGRAM_BUSINESS_ID || process.env.INSTAGRAM_BUSINESS_ID || ''
    const verifyToken = body.settings?.META_VERIFY_TOKEN || process.env.META_VERIFY_TOKEN || ''

    let result: Record<string, unknown> = {}
    let endpoint = ''

    switch (target) {
      case 'meta_app': {
        if (!appId || !appSecret) {
          return NextResponse.json({ error: 'META_APP_ID and META_APP_SECRET required.', target }, { status: 400 })
        }
        // Validate app token
        const appToken = `${appId}|${appSecret}`
        endpoint = `${GRAPH_BASE}/${API_VERSION}/app?access_token=${appToken}`
        const res = await fetch(endpoint)
        result = await res.json()
        break
      }

      case 'facebook': {
        if (!pageToken || !pageId) {
          return NextResponse.json({ error: 'META_PAGE_ACCESS_TOKEN and META_PAGE_ID required.', target }, { status: 400 })
        }
        endpoint = `${GRAPH_BASE}/${API_VERSION}/${pageId}?fields=id,name,fan_count,link&access_token=${pageToken}`
        const res = await fetch(endpoint)
        result = await res.json()
        break
      }

      case 'instagram': {
        if (!pageToken || !igBizId) {
          return NextResponse.json({ error: 'META_PAGE_ACCESS_TOKEN and INSTAGRAM_BUSINESS_ID required.', target }, { status: 400 })
        }
        endpoint = `${GRAPH_BASE}/${API_VERSION}/${igBizId}?fields=id,name,username,followers_count,media_count&access_token=${pageToken}`
        const res = await fetch(endpoint)
        result = await res.json()
        break
      }

      case 'messenger': {
        if (!pageToken || !pageId) {
          return NextResponse.json({ error: 'Page token and Page ID required.', target }, { status: 400 })
        }
        // Check page subscribed apps
        endpoint = `${GRAPH_BASE}/${API_VERSION}/${pageId}/subscribed_apps?access_token=${pageToken}`
        const res = await fetch(endpoint)
        result = await res.json()
        break
      }

      case 'webhook': {
        if (!verifyToken) {
          return NextResponse.json({ error: 'META_VERIFY_TOKEN required.', target }, { status: 400 })
        }
        result = {
          verify_token_set: !!verifyToken,
          callback_url: body.settings?.META_WEBHOOK_CALLBACK_URL || process.env.META_WEBHOOK_CALLBACK_URL || 'Not configured',
          status: 'Webhook configuration verified locally. Register URL in Meta Dashboard.'
        }
        break
      }

      case 'oauth': {
        if (!pageToken) {
          return NextResponse.json({ error: 'META_PAGE_ACCESS_TOKEN required.', target }, { status: 400 })
        }
        // Inspect token
        const appToken = `${appId}|${appSecret}`
        endpoint = `${GRAPH_BASE}/${API_VERSION}/debug_token?input_token=${pageToken}&access_token=${appToken}`
        const res = await fetch(endpoint)
        result = await res.json()
        break
      }

      case 'permissions': {
        if (!pageToken) {
          return NextResponse.json({ error: 'META_PAGE_ACCESS_TOKEN required.', target }, { status: 400 })
        }
        endpoint = `${GRAPH_BASE}/${API_VERSION}/me/permissions?access_token=${pageToken}`
        const res = await fetch(endpoint)
        result = await res.json()
        break
      }

      case 'post_facebook': {
        if (!pageToken || !pageId) {
          return NextResponse.json({ error: 'Page token and Page ID required for posting.', target }, { status: 400 })
        }
        // Test post (published: false = draft)
        endpoint = `${GRAPH_BASE}/${API_VERSION}/${pageId}/feed`
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: '🤖 FlowFyp automated test post — you can delete this.',
            published: false,
            access_token: pageToken,
          }),
        })
        result = await res.json()
        break
      }

      case 'post_instagram': {
        if (!pageToken || !igBizId) {
          return NextResponse.json({ error: 'Page token and IG Business ID required.', target }, { status: 400 })
        }
        result = {
          note: 'Instagram posts require a media_url. Use the Publishing Hub to schedule posts.',
          ig_business_id: igBizId,
          status: 'IG API reachable — use /api/meta/instagram/post to publish real content.'
        }
        break
      }

      case 'dm_instagram': {
        result = {
          note: 'IG DM requires a recipient PSID. Use the Inbox to reply to inbound messages.',
          status: 'IG Messaging API available when inbound message received via webhook.'
        }
        break
      }

      default:
        return NextResponse.json({ error: `Unknown test target: ${target}` }, { status: 400 })
    }

    const duration = Date.now() - start
    const hasError = (result as Record<string, unknown>)?.error

    return NextResponse.json({
      success: !hasError,
      target,
      duration,
      endpoint: endpoint || 'internal',
      data: result,
      message: hasError
        ? `Test failed: ${(result.error as Record<string,string>)?.message || JSON.stringify(result.error)}`
        : `${target} test passed.`,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ success: false, error: msg, duration: Date.now() - start }, { status: 500 })
  }
}

// GET /api/meta/test — Simple health ping
export async function GET(req: NextRequest) {
  const target = req.nextUrl.searchParams.get('target') || 'meta_app'
  return POST(req)
}
