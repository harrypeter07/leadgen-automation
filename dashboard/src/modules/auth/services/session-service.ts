// dashboard/src/modules/auth/services/session-service.ts
import { NextResponse } from 'next/server';
import { env } from '@/config/env';

export const SESSION_COOKIE_NAME = 'zarss_session';

export class SessionService {
  /**
   * Sets session cookie on HTTP response.
   */
  static attachSessionCookie(response: NextResponse): void {
    response.cookies.set(SESSION_COOKIE_NAME, 'true', {
      path: '/',
      httpOnly: true,
      secure: env.IS_PRODUCTION,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
  }

  /**
   * Clears session cookie on HTTP response.
   */
  static removeSessionCookie(response: NextResponse): void {
    response.cookies.delete(SESSION_COOKIE_NAME);
  }

  /**
   * Verifies if raw cookie value represents a valid session.
   */
  static isValidSession(cookieValue?: string | null): boolean {
    return cookieValue === 'true';
  }
}
