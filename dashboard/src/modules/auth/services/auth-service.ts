// dashboard/src/modules/auth/services/auth-service.ts
import { env } from '@/config/env';
import { AuthenticationError } from '@/shared/errors/app-error';

export class AuthService {
  /**
   * Validates admin password attempt.
   */
  static authenticatePassword(password: string): boolean {
    if (!password) {
      throw new AuthenticationError('Password is required');
    }

    const expectedPassword = env.DASHBOARD_PASSWORD;
    if (password !== expectedPassword) {
      throw new AuthenticationError('Invalid password credentials');
    }

    return true;
  }
}
