// GET /api/meta/active-account
// Returns the currently active connected account's display info.
// Used by client pages to know "which account are we showing?" so they can
// filter out the account's own messages from participant lists, etc.
import { NextResponse } from 'next/server'
import { getActiveConnectedAccount } from '@/lib/meta/runtime-config'
import { ensureMetaConfig } from '@/lib/meta/runtime-config'

export async function GET() {
  try {
    // Try to get from connected_accounts first
    const active = await getActiveConnectedAccount()
    if (active) {
      return NextResponse.json({
        found: true,
        displayName: active.displayName,
        platform: active.platform,
        pageId: active.pageId,
        instagramBusinessId: active.instagramBusinessId,
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
