import { NextRequest, NextResponse } from 'next/server'
import { InstagramService } from '@/lib/meta/instagram-service'

// POST /api/meta/instagram/reels
// body: { video_url, caption }
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { video_url, caption } = body

  if (!video_url) return NextResponse.json({ error: 'video_url required' }, { status: 400 })

  const res = await InstagramService.publishReel(video_url, caption || '')
  return NextResponse.json({ success: res.success, data: res.data, error: res.error, duration: res.duration })
}
