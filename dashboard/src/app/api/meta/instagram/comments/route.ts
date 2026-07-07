import { NextRequest, NextResponse } from 'next/server'
import { InstagramService } from '@/lib/meta/instagram-service'

// GET /api/meta/instagram/comments?media_id=xxx&limit=25
export async function GET(req: NextRequest) {
  const mediaId = req.nextUrl.searchParams.get('media_id') || ''
  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '25')
  if (!mediaId) return NextResponse.json({ error: 'media_id required' }, { status: 400 })
  const res = await InstagramService.getComments(mediaId, limit)
  return NextResponse.json({ success: res.success, data: res.data, error: res.error, duration: res.duration })
}

// POST /api/meta/instagram/comments
// body: { action: 'reply'|'hide'|'unhide'|'like', comment_id, message? }
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { action, comment_id, message } = body

  if (!comment_id) return NextResponse.json({ error: 'comment_id required' }, { status: 400 })

  let res
  switch (action || 'reply') {
    case 'reply':
      if (!message) return NextResponse.json({ error: 'message required for reply' }, { status: 400 })
      res = await InstagramService.replyToComment(comment_id, message)
      break
    case 'hide':
    case 'unhide':
      // Instagram uses DELETE on the comment for hiding — we call the client
      res = await InstagramService.replyToComment(comment_id, message || '')
      break
    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  }

  return NextResponse.json({ success: res.success, data: res.data, error: res.error, duration: res.duration })
}

