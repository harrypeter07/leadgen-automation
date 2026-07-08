import { NextRequest, NextResponse } from 'next/server'
import { InstagramService } from '@/lib/meta/instagram-service'

// GET /api/meta/instagram/media?limit=20
export async function GET(req: NextRequest) {
  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '20')
  const res = await InstagramService.getMedia(limit)
  return NextResponse.json({ success: res.success, data: res.data, error: res.error, duration: res.duration })
}
