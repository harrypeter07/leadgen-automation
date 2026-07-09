import { NextRequest, NextResponse } from 'next/server'
import { InstagramService } from '@/lib/meta/instagram-service'

// GET /api/meta/instagram/messages/[conversationId]?limit=50
// Fetches all messages for a specific Instagram conversation thread
export async function GET(
  req: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  const { conversationId } = params
  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50')

  if (!conversationId) {
    return NextResponse.json({ error: 'conversationId required' }, { status: 400 })
  }

  const res = await InstagramService.getConversationMessages(conversationId, limit)
  return NextResponse.json({
    success: res.success,
    data: res.data,
    error: res.error,
    duration: res.duration,
    conversationId,
  })
}
