import { NextRequest, NextResponse } from 'next/server'
import { FacebookService } from '@/lib/meta/facebook-service'

// GET /api/meta/facebook/messages?limit=20
export async function GET(req: NextRequest) {
  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '20')
  const res = await FacebookService.getMessages(limit)
  return NextResponse.json({ success: res.success, data: res.data, error: res.error, duration: res.duration })
}

// POST /api/meta/facebook/messages — send a Messenger message
// body: { recipient_id, text }
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { recipient_id, text } = body

  if (!recipient_id || !text) {
    return NextResponse.json({ error: 'recipient_id and text required' }, { status: 400 })
  }

  const res = await FacebookService.sendMessage(recipient_id, text)
  return NextResponse.json({ success: res.success, data: res.data, error: res.error, duration: res.duration })
}
