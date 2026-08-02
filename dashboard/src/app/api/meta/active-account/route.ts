// dashboard/src/app/api/meta/active-account/route.ts
import { withApiHandler } from '@/server/api/handler';
import { ok, fail } from '@/server/api/response';
import { AccountManager } from '@/modules/meta/services/account-manager';

export const GET = withApiHandler(async () => {
  const activeIg = await AccountManager.getActiveContext('instagram');
  const activeFb = await AccountManager.getActiveContext('messenger');

  if (activeIg || activeFb) {
    return ok({
      found: true,
      displayName: activeIg?.accountName || activeFb?.accountName || 'Active Connection',
      platform: activeIg ? 'instagram' : 'messenger',
      pageId: activeFb?.pageId || activeIg?.pageId || '',
      instagramBusinessId: activeIg?.instagramBusinessId || '',
      source: 'connected_accounts',
    });
  }

  return ok({
    found: false,
    displayName: 'Default Account',
    platform: 'instagram',
    source: 'meta_config',
  });
});

export const POST = withApiHandler(async (req: Request) => {
  const { accountId } = await req.json();
  if (!accountId) return fail('accountId is required', 'VALIDATION_ERROR', 400);

  const success = await AccountManager.switchActiveAccount(accountId);
  if (!success) return fail('Failed to switch account', 'DATABASE_ERROR', 500);

  return ok({ success: true, message: 'Account switched atomically' });
});
