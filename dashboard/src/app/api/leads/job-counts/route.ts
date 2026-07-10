import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').trim()
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  
  if (!url) {
    throw new Error('Supabase URL is missing')
  }
  if (!key) {
    throw new Error('Supabase Service Role Key is missing')
  }
  
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase()
    
    // Fetch only the job_id column from leads table
    const { data: leads, error } = await supabase
      .from('leads')
      .select('job_id')

    if (error) {
      console.error('[JobCounts API] Error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const counts: Record<string, number> = {}
    if (leads) {
      for (const lead of leads) {
        if (lead.job_id) {
          counts[lead.job_id] = (counts[lead.job_id] || 0) + 1
        }
      }
    }

    return NextResponse.json({ counts })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
