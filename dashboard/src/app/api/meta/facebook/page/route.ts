import { NextRequest, NextResponse } from 'next/server'
import { FacebookService } from '@/lib/meta/facebook-service'

// GET /api/meta/facebook/page — Fetch page info using service layer (auto-logging + retries)
export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action') || 'info'
  let res

  try {
    switch (action) {
      case 'info':
        res = await FacebookService.getPage()
        break
      case 'posts': {
        const limit = parseInt(req.nextUrl.searchParams.get('limit') || '20')
        res = await FacebookService.getPosts(limit)
        break
      }
      case 'insights':
        res = await FacebookService.getInsights()
        break
      case 'comments': {
        const postId = req.nextUrl.searchParams.get('post_id') || ''
        const limit = parseInt(req.nextUrl.searchParams.get('limit') || '25')
        if (!postId) return NextResponse.json({ error: 'post_id required' }, { status: 400 })
        res = await FacebookService.getComments(postId, limit)
        break
      }
      default:
        return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
    }

    return NextResponse.json({ success: res.success, data: res.data, error: res.error, duration: res.duration })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}

// POST /api/meta/facebook/page — Publish / comment / reply actions using service layer
export async function POST(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action') || 'post'

  try {
    const body = await req.json()
    let res

    switch (action) {
      case 'post':
        res = await FacebookService.publishPost(body.message, body.link, body.scheduled_time)
        break
      case 'delete':
        if (!body.post_id) return NextResponse.json({ error: 'post_id required' }, { status: 400 })
        res = await FacebookService.deletePost(body.post_id)
        break
      case 'reply_comment':
        if (!body.comment_id || !body.message) return NextResponse.json({ error: 'comment_id and message required' }, { status: 400 })
        res = await FacebookService.replyToComment(body.comment_id, body.message)
        break
      case 'hide_comment':
        if (!body.comment_id) return NextResponse.json({ error: 'comment_id required' }, { status: 400 })
        res = await FacebookService.hideComment(body.comment_id, true)
        break
      case 'unhide_comment':
        if (!body.comment_id) return NextResponse.json({ error: 'comment_id required' }, { status: 400 })
        res = await FacebookService.hideComment(body.comment_id, false)
        break
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }

    return NextResponse.json({ success: res.success, data: res.data, error: res.error, duration: res.duration })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
