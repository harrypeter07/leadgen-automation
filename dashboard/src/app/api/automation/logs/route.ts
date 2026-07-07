import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// GET /api/automation/logs?level=error&source=FacebookService&limit=100&offset=0
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const level    = sp.get('level')   || ''
    const source   = sp.get('source')  || ''
    const limit    = Math.min(parseInt(sp.get('limit')  || '100'), 500)
    const offset   = parseInt(sp.get('offset') || '0')
    const since    = sp.get('since')   // ISO timestamp — return only logs after this time
    const event    = sp.get('event')   || ''

    let query = supabaseAdmin
      .from('meta_request_logs')
      .select('*', { count: 'exact' })
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1)

    if (level && level !== 'all') query = query.eq('level', level)
    if (source && source !== 'All Sources') query = query.ilike('source', `%${source}%`)
    if (event)  query = query.ilike('event', `%${event}%`)
    if (since)  query = query.gt('timestamp', since)

    const { data, error, count } = await query

    if (error) {
      // If table doesn't exist yet, return empty with a hint
      if (error.message?.includes('relation') || error.code === '42P01') {
        return NextResponse.json({
          logs: [],
          total: 0,
          hint: 'meta_request_logs table not yet created. Run scripts/meta/create_meta_tables.sql in Supabase.',
        })
      }
      throw error
    }

    return NextResponse.json({ logs: data || [], total: count ?? 0 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg, logs: [], total: 0 }, { status: 500 })
  }
}
