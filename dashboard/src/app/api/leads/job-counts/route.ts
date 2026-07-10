import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').trim()
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  
  if (!url || !key) {
    throw new Error('Supabase URL or Service Role Key is missing')
  }
  
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase()
    
    // We only select the job_id column and filter for leads that have email,
    // to match the exact email-outreach filter criteria.
    const { data, error } = await supabase
      .from('leads')
      .select('job_id')
      .not('email', 'is', null)
      
    if (error) {
      throw error
    }

    const counts: Record<string, number> = {}
    data?.forEach((lead: any) => {
      if (lead.job_id) {
        counts[lead.job_id] = (counts[lead.job_id] || 0) + 1
      }
    })

    return NextResponse.json({ success: true, counts })
  } catch (err: any) {
    console.error('[LeadsJobCounts] Error:', err.message)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
