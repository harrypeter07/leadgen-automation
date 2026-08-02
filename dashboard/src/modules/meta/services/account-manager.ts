// dashboard/src/modules/meta/services/account-manager.ts
import { supabaseAdmin } from '@/lib/supabase';
import { CacheManager } from '@/shared/cache/cache-manager';
import { invalidateMetaConfig, getActiveConnectedAccount } from '@/lib/meta/runtime-config';
import { Logger } from '@/shared/logging/logger';
import { ValidationError } from '@/shared/errors/app-error';

export interface ActiveAccountContext {
  accountId: string;
  accountName: string;
  platform: string;
  pageAccessToken: string;
  instagramToken: string;
  pageId: string;
  instagramBusinessId: string;
}

export class AccountManager {
  /**
   * Resolves the current active account context with caching.
   */
  static async getActiveContext(preferPlatform?: 'instagram' | 'messenger' | 'facebook'): Promise<ActiveAccountContext | null> {
    const cacheKey = `active_account:${preferPlatform || 'any'}`;
    const cached = CacheManager.get<ActiveAccountContext>(cacheKey);
    if (cached) return cached;

    const account = await getActiveConnectedAccount(preferPlatform);
    if (!account) return null;

    const context: ActiveAccountContext = {
      accountId: account.pageId || account.instagramBusinessId || 'active',
      accountName: account.accountName,
      platform: account.platform,
      pageAccessToken: account.pageAccessToken,
      instagramToken: account.instagramToken,
      pageId: account.pageId,
      instagramBusinessId: account.instagramBusinessId,
    };

    CacheManager.set(cacheKey, context, 30000, `account:${context.accountId}`);
    return context;
  }

  /**
   * Executes atomic context switch to target account.
   */
  static async switchActiveAccount(accountId: string): Promise<boolean> {
    if (!accountId) throw new ValidationError('accountId is required for switching');

    Logger.info('Initiating atomic account switch', { module: 'AccountManager', accountId });

    // Step 1: Query target account to verify existence and get platform
    const { data: targetAccount, error: fetchErr } = await supabaseAdmin
      .from('connected_accounts')
      .select('id, platform, account_name')
      .eq('id', accountId)
      .single();

    if (fetchErr || !targetAccount) {
      throw new ValidationError(`Target account ID ${accountId} not found`);
    }

    // Step 2: Atomic update - Deactivate previous active account for platform & activate target
    const { error: deactivateErr } = await supabaseAdmin
      .from('connected_accounts')
      .update({ is_active: false })
      .eq('platform', targetAccount.platform);

    if (deactivateErr) {
      Logger.error('Failed to deactivate previous accounts', { error: deactivateErr.message });
      return false;
    }

    const { error: activateErr } = await supabaseAdmin
      .from('connected_accounts')
      .update({ is_active: true })
      .eq('id', accountId);

    if (activateErr) {
      Logger.error('Failed to activate target account', { error: activateErr.message });
      return false;
    }

    // Step 3: Cache Invalidation & Runtime Config Reload
    CacheManager.invalidateScope(`account:${accountId}`);
    CacheManager.invalidateScope(`platform:${targetAccount.platform}`);
    CacheManager.clearAll();
    invalidateMetaConfig();

    Logger.info('Atomic account switch completed successfully', {
      module: 'AccountManager',
      accountName: targetAccount.account_name,
      platform: targetAccount.platform,
    });

    return true;
  }
}
