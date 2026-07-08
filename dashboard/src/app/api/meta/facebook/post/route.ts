import { NextRequest, NextResponse } from 'next/server'
import { FacebookService } from '@/lib/meta/facebook-service'

// GET /api/meta/facebook/post?limit=20 — list posts
export async function GET(req: NextRequest) {
  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '20')
  const res = await FacebookService.getPosts(limit)
  return NextResponse.json({ success: res.success, data: res.data, error: res.error, duration: res.duration })
}

// POST /api/meta/facebook/post — publish or delete a post
// body: { action: 'publish'|'delete', message?, link?, scheduled_time?, post_id? }
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { action, message, link, scheduled_time, post_id } = body

  if (!action) return NextResponse.json({ error: 'action required' }, { status: 400 })

  let res
  switch (action) {
    case 'publish':
      if (!message) return NextResponse.json({ error: 'message required to publish' }, { status: 400 })
      res = await FacebookService.publishPost(message, link, scheduled_time)
      break
    case 'delete':
      if (!post_id) return NextResponse.json({ error: 'post_id required to delete' }, { status: 400 })
      res = await FacebookService.deletePost(post_id)
      break
    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  }

  return NextResponse.json({ success: res.success, data: res.data, error: res.error, duration: res.duration })
}
