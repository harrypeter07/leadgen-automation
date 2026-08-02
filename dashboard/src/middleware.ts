import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { SESSION_COOKIE_NAME, SessionService } from '@/modules/auth/services/session-service'

export function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)
  const { pathname } = request.nextUrl

  // Whitelisted endpoints bypassing session checks
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/email/send') ||
    pathname.startsWith('/api/login') ||
    pathname.startsWith('/api/meta') ||
    pathname.startsWith('/api/automation') ||
    pathname.startsWith('/api/backend-v3') ||
    pathname.startsWith('/api/scraper') ||
    pathname.startsWith('/api/instagram-audit') ||
    pathname.startsWith('/api/instagram-logs') ||
    pathname.startsWith('/api/agent-brain') ||
    pathname.startsWith('/automation') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/fonts') ||
    pathname === '/login'
  ) {
    return NextResponse.next()
  }

  // Session verification via SessionService
  if (!SessionService.isValidSession(sessionCookie?.value)) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
