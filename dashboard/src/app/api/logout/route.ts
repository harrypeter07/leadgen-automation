// dashboard/src/app/api/logout/route.ts
import { withApiHandler } from '@/server/api/handler';
import { ok } from '@/server/api/response';
import { SessionService } from '@/modules/auth/services/session-service';

export const POST = withApiHandler(async () => {
  const response = ok({ success: true, message: 'Logged out successfully' });
  SessionService.removeSessionCookie(response);
  return response;
});
