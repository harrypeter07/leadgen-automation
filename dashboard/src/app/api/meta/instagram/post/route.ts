import { NextRequest, NextResponse } from 'next/server'
import { InstagramService } from '@/lib/meta/instagram-service'

// POST /api/meta/instagram/post
// body: { image_url, caption }
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { image_url, caption } = body

  if (!image_url) return NextResponse.json({ error: 'image_url required' }, { status: 400 })

  const res = await InstagramService.publishPost(image_url, caption || '')
  return NextResponse.json({
    success: res.success,
    data: res.data,
    error: res.error,
    duration: res.duration,
    containerId: (res as Record<string,unknown>).containerId,
  })
}
