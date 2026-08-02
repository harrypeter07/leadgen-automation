// dashboard/src/server/api/response.ts
import { NextResponse } from 'next/server';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: string;
  };
}

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(
    {
      success: true,
      data,
      meta: { timestamp: new Date().toISOString() },
    },
    { status }
  );
}

export function fail(message: string, code = 'BAD_REQUEST', status = 400, details?: any): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: { code, message, details },
      meta: { timestamp: new Date().toISOString() },
    },
    { status }
  );
}

export function unauthorized(message = 'Unauthorized'): NextResponse {
  return fail(message, 'UNAUTHORIZED', 401);
}

export function forbidden(message = 'Forbidden'): NextResponse {
  return fail(message, 'FORBIDDEN', 403);
}

export function notFound(message = 'Resource not found'): NextResponse {
  return fail(message, 'NOT_FOUND', 404);
}

export function internalError(message = 'Internal server error', details?: any): NextResponse {
  return fail(message, 'INTERNAL_ERROR', 500, details);
}
