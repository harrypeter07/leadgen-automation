import { NextRequest, NextResponse } from 'next/server'
import { InstagramService } from '@/lib/meta/instagram-service'

const isVideoUrl = (url: string) => {
  if (!url) return false
  return url.toLowerCase().includes('/video/upload/') || url.toLowerCase().match(/\.(mp4|webm|mov|avi|mkv|ogg)($|\?)/)
}

// POST /api/meta/instagram/post
// body: { image_url, caption, audio_id, location_id, user_tags, media_type }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { image_url, caption, audio_id, location_id, user_tags, media_type } = body

    if (!image_url) {
      return NextResponse.json({ error: 'image_url required' }, { status: 400 })
    }

    const isReel = media_type === 'reels' || isVideoUrl(image_url)

    let res
    if (isReel) {
      res = await InstagramService.publishReel(image_url, caption || '', {
        audio_id,
        location_id,
        share_to_feed: true
      })
    } else {
      res = await InstagramService.publishPost(image_url, caption || '', {
        location_id,
        user_tags
      })
    }

    return NextResponse.json({
      success: res.success,
      data: res.data,
      error: res.error,
      duration: res.duration,
      containerId: (res as any).containerId,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
