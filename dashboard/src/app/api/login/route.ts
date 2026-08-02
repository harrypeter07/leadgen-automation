// dashboard/src/app/api/login/route.ts
import { withApiHandler } from '@/server/api/handler';
import { ok, unauthorized } from '@/server/api/response';
import { AuthService } from '@/modules/auth/services/auth-service';
import { SessionService } from '@/modules/auth/services/session-service';

export const POST = withApiHandler(async (req: Request) => {
  const { password } = await req.json();

  try {
    AuthService.authenticatePassword(password);
    const response = ok({ success: true, message: 'Authenticated successfully' });
    SessionService.attachSessionCookie(response);
    return response;
  } catch (err: any) {
    return unauthorized(err.message || 'Invalid password credentials');
  }
});
