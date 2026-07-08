import { NextRequest, NextResponse } from 'next/server'
import { OAuthService } from '@/lib/meta/oauth-service'

// GET /api/meta/oauth — generate auth URL or validate current token
export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action') || 'validate'

  if (action === 'url') {
    const scopeParam = req.nextUrl.searchParams.get('scopes')
    const scopes = scopeParam ? scopeParam.split(',') : undefined
    const url = OAuthService.getAuthUrl(scopes)
    return NextResponse.json({ success: true, auth_url: url })
  }

  // Default: validate current token
  const validation = await OAuthService.validateToken()
  return NextResponse.json({ success: true, ...validation })
}

// POST /api/meta/oauth — exchange code for token, or get long-lived token
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { action, code, short_lived_token } = body

  if (!action) return NextResponse.json({ error: 'action required' }, { status: 400 })

  switch (action) {
    case 'exchange_code': {
      if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 })
      const result = await OAuthService.exchangeCode(code)
      return NextResponse.json(result)
    }
    case 'long_lived_token': {
      if (!short_lived_token) return NextResponse.json({ error: 'short_lived_token required' }, { status: 400 })
      const result = await OAuthService.getLongLivedToken(short_lived_token)
      return NextResponse.json(result)
    }
    case 'debug_token': {
      const token = body.token || process.env.META_PAGE_ACCESS_TOKEN || ''
      if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })
      const result = await OAuthService.debugToken(token)
      return NextResponse.json({ success: result.success, data: result.data, error: result.error, duration: result.duration })
    }
    case 'validate': {
      const result = await OAuthService.validateToken(body.token)
      return NextResponse.json({ success: true, ...result })
    }
    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  }
}
