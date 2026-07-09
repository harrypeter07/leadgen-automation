import { NextRequest, NextResponse } from 'next/server'
import { InstagramService } from '@/lib/meta/instagram-service'
import { FacebookService } from '@/lib/meta/facebook-service'
import { ensureMetaConfig } from '@/lib/meta/runtime-config'

// GET /api/meta/insights
// Fetches both Facebook and Instagram profiles + reach insights and aggregates them
export async function GET() {
  try {
    await ensureMetaConfig()

    let fbProfile: any = null
    let igProfile: any = null
    let igInsights: any = null
    let fbInsights: any = null

    try {
      const fbRes = await FacebookService.getPage('id,name,fan_count,picture,link')
      if (fbRes.success) fbProfile = fbRes.data
    } catch (e) {
      console.error('[Insights API] FB profile fetch failed:', e)
    }

    try {
      const igRes = await InstagramService.getProfile()
      if (igRes.success) igProfile = igRes.data
    } catch (e) {
      console.error('[Insights API] IG profile fetch failed:', e)
    }

    try {
      const igInsRes = await InstagramService.getInsights('impressions,reach,follower_count', 'day')
      if (igInsRes.success) igInsights = igInsRes.data
    } catch (e) {
      console.error('[Insights API] IG insights fetch failed:', e)
    }

    try {
      const fbInsRes = await FacebookService.getInsights('page_impressions,page_engagements', 'day')
      if (fbInsRes.success) fbInsights = fbInsRes.data
    } catch (e) {
      console.error('[Insights API] FB insights fetch failed:', e)
    }

    // Parse IG insights
    const igReach = igInsights?.data?.find((d: any) => d.name === 'reach')?.values?.[0]?.value || 0
    const igImpressions = igInsights?.data?.find((d: any) => d.name === 'impressions')?.values?.[0]?.value || 0
    const igFollowerCount = igInsights?.data?.find((d: any) => d.name === 'follower_count')?.values?.[0]?.value || 0

    // Parse FB insights
    const fbReach = fbInsights?.data?.find((d: any) => d.name === 'page_impressions')?.values?.[0]?.value || 0
    const fbEngagements = fbInsights?.data?.find((d: any) => d.name === 'page_engagements')?.values?.[0]?.value || 0

    return NextResponse.json({
      success: true,
      summary: {
        totalFollowers: (fbProfile?.fan_count || 0) + (igProfile?.followers_count || igFollowerCount || 0),
        totalReach: fbReach + igReach,
        totalImpressions: fbReach + igImpressions,
        totalEngagement: fbEngagements,
      },
      platforms: {
        facebook: {
          id: fbProfile?.id || null,
          name: fbProfile?.name || 'Facebook Page',
          followers: fbProfile?.fan_count || 0,
          reach: fbReach,
          engagement: fbEngagements,
          picture: fbProfile?.picture?.data?.url || null,
        },
        instagram: {
          id: igProfile?.id || null,
          username: igProfile?.username || 'instagram_biz',
          followers: igProfile?.followers_count || igFollowerCount || 0,
          reach: igReach,
          impressions: igImpressions,
          picture: igProfile?.profile_picture_url || null,
        }
      }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
