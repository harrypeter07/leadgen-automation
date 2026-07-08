import { NextRequest, NextResponse } from 'next/server'
import { FacebookService } from '@/lib/meta/facebook-service'

// GET /api/meta/facebook/insights?metric=page_impressions,page_engagements&period=day
export async function GET(req: NextRequest) {
  const metric = req.nextUrl.searchParams.get('metric') || 'page_impressions,page_engagements,page_fan_adds'
  const period = req.nextUrl.searchParams.get('period') || 'day'
  const res = await FacebookService.getInsights(metric, period)
  return NextResponse.json({ success: res.success, data: res.data, error: res.error, duration: res.duration })
}
