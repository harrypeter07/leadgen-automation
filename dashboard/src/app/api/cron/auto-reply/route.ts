import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 55 // Just under Vercel's 60s limit

// GET /api/cron/auto-reply
// Called every minute by Vercel Cron — purely server-side, no frontend needed.
// Vercel automatically passes the CRON_SECRET as Authorization: Bearer header.
export async function GET(request: Request) {
  // Verify this is a legitimate Vercel cron call (not a public request)
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Call the actual auto-reply-scan handler internally
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXTAUTH_URL || 'http://localhost:3000'

    const res = await fetch(`${baseUrl}/api/meta/instagram/auto-reply-scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-trigger': 'vercel-cron',
      },
    })

    const data = await res.json()
    console.log('[CronAutoReply] Scan result:', JSON.stringify(data))

    return NextResponse.json({
      success: true,
      cronFiredAt: new Date().toISOString(),
      scanResult: data,
    })
  } catch (err: any) {
    console.error('[CronAutoReply] Error calling scan:', err.message)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
