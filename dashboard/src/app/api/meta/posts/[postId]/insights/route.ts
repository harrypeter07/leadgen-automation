import { NextRequest, NextResponse } from 'next/server'
import { FacebookService } from '@/lib/meta/facebook-service'
import { InstagramService } from '@/lib/meta/instagram-service'
import { ensureMetaConfig } from '@/lib/meta/runtime-config'

// GET /api/meta/posts/[postId]/insights
// Fetches per-post insights (likes, comments, shares, impressions, reach, views)
// for a given Facebook post or Instagram media object by ID.
export async function GET(
  req: NextRequest,
  { params }: { params: { postId: string } }
) {
  try {
    await ensureMetaConfig()
    const { postId } = params

    if (!postId) {
      return NextResponse.json({ error: 'postId is required' }, { status: 400 })
    }

    const platform = req.nextUrl.searchParams.get('platform') ?? 'facebook'
    let result: Record<string, number> = {
      likes: 0,
      comments: 0,
      shares: 0,
      impressions: 0,
      reach: 0,
      views: 0,
    }

    if (platform === 'instagram') {
      // Instagram Media Insights
      try {
        const igRes = await InstagramService.getMediaInsights(
          postId,
          'impressions,reach,likes,comments,shares,video_views'
        )
        const insightsData: any[] = igRes?.data?.data ?? []
        insightsData.forEach((metric: any) => {
          const name: string = metric.name
          const value: number = metric.values?.[0]?.value ?? metric.value ?? 0
          if (name === 'impressions') result.impressions = value
          else if (name === 'reach') result.reach = value
          else if (name === 'likes') result.likes = value
          else if (name === 'comments') result.comments = value
          else if (name === 'shares') result.shares = value
          else if (name === 'video_views') result.views = value
        })
      } catch (e) {
        console.warn('[PostInsights] IG insights fetch failed, using fallback:', e)
        // Fallback — fetch raw media object fields
        try {
          const igRaw = await InstagramService.getMediaById(
            postId,
            'like_count,comments_count'
          )
          if (igRaw?.success) {
            const data = igRaw.data as any
            result.likes = data?.like_count ?? 0
            result.comments = data?.comments_count ?? 0
          }
        } catch { /* noop */ }
      }
    } else {
      // Facebook Post Insights
      try {
        const fbRes = await FacebookService.getPostInsights(
          postId,
          'post_impressions,post_impressions_unique,post_clicks,post_reactions_like_total,post_video_views'
        )
        const insightsData: any[] = fbRes?.data?.data ?? []
        insightsData.forEach((metric: any) => {
          const name: string = metric.name
          const value: number = metric.values?.[0]?.value ?? 0
          if (name === 'post_impressions') result.impressions = value
          else if (name === 'post_impressions_unique') result.reach = value
          else if (name === 'post_clicks') result.shares = value
          else if (name === 'post_reactions_like_total') result.likes = value
          else if (name === 'post_video_views') result.views = value
        })
        // Also fetch likes + comments from raw post fields
        const fbRaw = await FacebookService.getPost(postId, 'likes.summary(true),comments.summary(true),shares')
        if (fbRaw?.success) {
          const data = fbRaw.data as any
          result.likes = data?.likes?.summary?.total_count ?? result.likes
          result.comments = data?.comments?.summary?.total_count ?? 0
          result.shares = data?.shares?.count ?? result.shares
        }
      } catch (e) {
        console.warn('[PostInsights] FB insights fetch failed:', e)
      }
    }

    return NextResponse.json({ success: true, postId, platform, ...result })
  } catch (err: any) {
    console.error('[PostInsights] Fatal error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
