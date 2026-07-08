import { NextRequest, NextResponse } from 'next/server'
import { FacebookService } from '@/lib/meta/facebook-service'

// GET /api/meta/facebook/comments?post_id=xxx&limit=25
export async function GET(req: NextRequest) {
  const postId = req.nextUrl.searchParams.get('post_id') || ''
  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '25')
  if (!postId) return NextResponse.json({ error: 'post_id required' }, { status: 400 })
  const res = await FacebookService.getComments(postId, limit)
  return NextResponse.json({ success: res.success, data: res.data, error: res.error, duration: res.duration })
}

// POST /api/meta/facebook/comments
// body: { action: 'reply'|'hide'|'delete', comment_id, message? }
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { action, comment_id, message } = body

  if (!action || !comment_id) {
    return NextResponse.json({ error: 'action and comment_id required' }, { status: 400 })
  }

  let res
  switch (action) {
    case 'reply':
      if (!message) return NextResponse.json({ error: 'message required for reply' }, { status: 400 })
      res = await FacebookService.replyToComment(comment_id, message)
      break
    case 'hide':
      res = await FacebookService.hideComment(comment_id, true)
      break
    case 'unhide':
      res = await FacebookService.hideComment(comment_id, false)
      break
    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  }

  return NextResponse.json({ success: res.success, data: res.data, error: res.error, duration: res.duration })
}
