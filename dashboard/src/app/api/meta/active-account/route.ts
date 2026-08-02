// GET & POST /api/meta/active-account
// Retrieves or switches active connected account
import { NextRequest, NextResponse } from 'next/server'
import { getActiveConnectedAccount, ensureMetaConfig } from '@/lib/meta/runtime-config'
import { supabaseAdmin } from '@/lib/supabase'

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

export async function POST(req: NextRequest) {
  try {
    const { accountId } = await req.json()
    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 })
    }

    // Deactivate all accounts in connected_accounts
    await supabaseAdmin
      .from('connected_accounts')
      .update({ is_active: false })
      .neq('id', '00000000-0000-0000-0000-000000000000')

    // Activate selected account
    const { data: updated, error } = await supabaseAdmin
      .from('connected_accounts')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('id', accountId)
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, activeAccount: updated })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
