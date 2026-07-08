import { NextRequest, NextResponse } from 'next/server'
import { InstagramService } from '@/lib/meta/instagram-service'

// GET /api/meta/instagram/insights?metric=impressions,reach&period=day
export async function GET(req: NextRequest) {
  const metric = req.nextUrl.searchParams.get('metric') || 'impressions,reach,follower_count'
  const period = req.nextUrl.searchParams.get('period') || 'day'
  const res = await InstagramService.getInsights(metric, period)
  return NextResponse.json({ success: res.success, data: res.data, error: res.error, duration: res.duration })
}
