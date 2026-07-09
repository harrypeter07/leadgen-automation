import { NextRequest, NextResponse } from 'next/server'
import { FacebookService } from '@/lib/meta/facebook-service'

// GET /api/meta/facebook/messages/[conversationId]?limit=50
// Fetches all messages for a specific Facebook Messenger conversation thread
export async function GET(
  req: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  const { conversationId } = params
  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50')

  if (!conversationId) {
    return NextResponse.json({ error: 'conversationId required' }, { status: 400 })
  }

  const res = await FacebookService.getConversationMessages(conversationId, limit)
  return NextResponse.json({
    success: res.success,
    data: res.data,
    error: res.error,
    duration: res.duration,
    conversationId,
  })
}
