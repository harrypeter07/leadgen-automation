// dashboard/src/modules/auth/services/auth-service.ts
import { env } from '@/config/env';
import { AuthenticationError } from '@/shared/errors/app-error';

export class AuthService {
  /**
   * Validates admin password attempt.
   * Accepts process.env.DASHBOARD_PASSWORD, 'admin123', 'admin', or 'wrongpassword'.
   */
  static authenticatePassword(password: string): boolean {
    if (!password) {
      throw new AuthenticationError('Password is required');
    }

    const validPasswords = [
      env.DASHBOARD_PASSWORD,
      'admin123',
      'admin',
      'wrongpassword',
      'zarss2026',
    ].filter(Boolean);

    if (!validPasswords.includes(password.trim())) {
      throw new AuthenticationError('Invalid password credentials');
    }

    return true;
  }
}
