// GET /api/meta/active-account
// Returns the currently active connected account's display info.
import { NextResponse } from 'next/server'
import { getActiveConnectedAccount } from '@/lib/meta/runtime-config'
import { ensureMetaConfig } from '@/lib/meta/runtime-config'

export async function GET() {
  try {
    const activeIg = await getActiveConnectedAccount('instagram')
    const activeFb = await getActiveConnectedAccount('messenger')

    if (activeIg || activeFb) {
      return NextResponse.json({
        found: true,
        displayName: activeIg?.accountName || activeFb?.accountName || 'Active Connection',
        platform: activeIg ? 'instagram' : 'messenger',
        pageId: activeFb?.pageId || activeIg?.pageId || '',
        instagramBusinessId: activeIg?.instagramBusinessId || '',
        source: 'connected_accounts',
      })
    }

    // Fallback: return what's in meta_config
    await ensureMetaConfig()
    return NextResponse.json({
      found: true,
      displayName: 'Default Account',
      platform: 'instagram',
      pageId: process.env.META_PAGE_ID || '',
      instagramBusinessId: process.env.INSTAGRAM_BUSINESS_ID || '',
      source: 'meta_config',
    })
  } catch (err: any) {
    return NextResponse.json({ found: false, error: err.message }, { status: 500 })
  }
}

