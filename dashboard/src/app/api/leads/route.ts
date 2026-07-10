import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Server-side Supabase client with service role key — bypasses RLS completely
function getSupabase() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').trim()
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  
  if (!url) {
    throw new Error('Supabase URL is missing from environment variables (please set NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL)')
  }
  if (!key) {
    throw new Error('Supabase Service Role Key is missing (please set SUPABASE_SERVICE_ROLE_KEY)')
  }
  
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const page      = parseInt(searchParams.get('page')     || '1')
  const perPage   = parseInt(searchParams.get('perPage')  || '25')
  const search    = searchParams.get('search')   || ''
  const status    = searchParams.get('status')   || ''
  const city      = searchParams.get('city')     || ''
  const category  = searchParams.get('category') || ''

  // Single job_id (legacy support) OR multi job_ids (comma-separated)
  const job_id    = searchParams.get('job_id')   || ''
  const job_ids   = searchParams.get('job_ids')  || ''

  // Email outreach filters
  const has_email = searchParams.get('has_email') === 'true'
  const limitOverride = parseInt(searchParams.get('limit') || '0') // 0 means use perPage

  const effectiveLimit = limitOverride > 0 ? limitOverride : perPage
  const offset = (page - 1) * effectiveLimit

  try {
    const supabase = getSupabase()
    let query = supabase
      .from('leads')
      .select(
        'id,name,email,phone,website,category,city,rating,review_count,status,notes,job_id,created_at,enrichment_status,enrichment_fields,ai_message_email_subject,ai_message_email_body',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + effectiveLimit - 1)

    // Filters
    if (status)   query = query.eq('status', status)
    if (city)     query = query.ilike('city', `%${city}%`)
    if (category) query = query.eq('category', category)
    if (search)   query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`)

    // Job ID filter — prefer multi job_ids over single job_id
    if (job_ids) {
      const ids = job_ids.split(',').map(id => id.trim()).filter(Boolean)
      if (ids.length === 1) {
        query = query.eq('job_id', ids[0])
      } else if (ids.length > 1) {
        query = query.in('job_id', ids)
      }
    } else if (job_id) {
      query = query.eq('job_id', job_id)
    }

    // Email presence filter — only include leads with a non-null, non-empty email
    if (has_email) {
      query = query.not('email', 'is', null).neq('email', '')
    }

    const { data, count, error } = await query
    if (error) {
      console.error('[Leads API] fetchLeads error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ leads: data ?? [], total: count ?? 0 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/leads — Upserts or updates a lead record (e.g. status, subject, body)
export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase()
    const payload = await req.json()

    if (!payload.id) {
      return NextResponse.json({ error: 'lead ID required for update' }, { status: 400 })
    }

    const { error } = await supabase
      .from('leads')
      .upsert(payload, { onConflict: 'id' })

    if (error) {
      console.error('[Leads API] update error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Lead updated successfully' })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Update failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
