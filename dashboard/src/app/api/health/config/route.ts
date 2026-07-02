import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const keys = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'WHATSAPP_SERVICE_URL',
    'WHATSAPP_API_SECRET',
    'N8N_WEBHOOK_BASE_URL',
    'RESEND_API_KEY',
    'N8N_AI_TRIGGER_URL',
    'N8N_OUTREACH_TRIGGER_URL'
  ]

  const status: Record<string, boolean> = {}

  for (const key of keys) {
    let val = process.env[key]
    
    // Check fallback naming
    if (key === 'NEXT_PUBLIC_SUPABASE_URL') {
      val = val || process.env.SUPABASE_URL
    } else if (key === 'NEXT_PUBLIC_SUPABASE_ANON_KEY') {
      val = val || process.env.SUPABASE_ANON_KEY
    }
    
    status[key] = typeof val === 'string' && val.trim().length > 0
  }

  return NextResponse.json({ success: true, status })
}
