import { NextRequest, NextResponse } from 'next/server'
import { InstagramService } from '@/lib/meta/instagram-service'

// GET /api/meta/instagram/profile — Fetch IG details using service layer (auto-logging + retries)
export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action') || 'profile'
  let res

  try {
    switch (action) {
      case 'profile':
        res = await InstagramService.getProfile()
        break
      case 'media': {
        const limit = parseInt(req.nextUrl.searchParams.get('limit') || '20')
        res = await InstagramService.getMedia(limit)
        break
      }
      case 'insights':
        res = await InstagramService.getInsights()
        break
      case 'comments': {
        const mediaId = req.nextUrl.searchParams.get('media_id') || ''
        const limit = parseInt(req.nextUrl.searchParams.get('limit') || '25')
        if (!mediaId) return NextResponse.json({ error: 'media_id required' }, { status: 400 })
        res = await InstagramService.getComments(mediaId, limit)
        break
      }
      case 'messages': {
        const limit = parseInt(req.nextUrl.searchParams.get('limit') || '20')
        res = await InstagramService.getMessages(limit)
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

// POST /api/meta/instagram/profile — Publish and reply actions using service layer
export async function POST(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action') || 'post'

  try {
    const body = await req.json()
    let res

    switch (action) {
      case 'post':
        if (!body.image_url) return NextResponse.json({ error: 'image_url required' }, { status: 400 })
        res = await InstagramService.publishPost(body.image_url, body.caption || '')
        break
      case 'reel':
        if (!body.video_url) return NextResponse.json({ error: 'video_url required' }, { status: 400 })
        res = await InstagramService.publishReel(body.video_url, body.caption || '')
        break
      case 'reply_comment':
        if (!body.comment_id || !body.message) return NextResponse.json({ error: 'comment_id and message required' }, { status: 400 })
        res = await InstagramService.replyToComment(body.comment_id, body.message)
        break
      case 'reply_dm':
        if (!body.recipient_id || !body.message) return NextResponse.json({ error: 'recipient_id and message required' }, { status: 400 })
        res = await InstagramService.sendDM(body.recipient_id, body.message)
        break
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }

    return NextResponse.json({ success: res.success, data: res.data, error: res.error, duration: res.duration })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
