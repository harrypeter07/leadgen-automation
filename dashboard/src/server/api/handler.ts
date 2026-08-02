// dashboard/src/server/api/handler.ts
import { NextResponse } from 'next/server';
import { internalError } from './response';

export type RequestHandler = (req: Request, context?: any) => Promise<NextResponse | Response>;

/**
 * Higher-Order Function to wrap API route handlers with unified error handling & logging.
 */
export function withApiHandler(handler: RequestHandler): RequestHandler {
  return async (req: Request, context?: any) => {
    try {
      return await handler(req, context);
    } catch (err: any) {
      console.error(`[ApiHandler Error] ${req.method} ${req.url}:`, err.message || err);
      return internalError(err.message || 'An unexpected error occurred');
    }
  };
}
