import { NextRequest, NextResponse } from 'next/server'
import { InstagramService } from '@/lib/meta/instagram-service'
import { FacebookService } from '@/lib/meta/facebook-service'
import { ensureMetaConfig } from '@/lib/meta/runtime-config'

export const dynamic = 'force-dynamic'

// GET /api/meta/posts
// Fetches both Facebook and Instagram posts to populate the content calendar in real-time
export async function GET(req: NextRequest) {
  try {
    await ensureMetaConfig()
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '30')
    const posts: any[] = []

    // 1. Fetch Facebook posts
    try {
      const fbRes = await FacebookService.getPosts(limit)
      const fbData = fbRes.data?.data ?? fbRes.data ?? []
      if (Array.isArray(fbData)) {
        fbData.forEach((p: any) => {
          posts.push({
            id: p.id,
            platform: 'facebook',
            title: p.message || '(No caption)',
            message: p.message,
            time: p.created_time,
            type: 'fb',
            permalink: p.permalink_url,
            likes: p.likes?.summary?.total_count || 0,
            comments: p.comments?.summary?.total_count || 0,
          })
        })
      }
    } catch (e: any) {
      console.error('[Posts API] Failed to fetch FB posts:', e.message)
    }

    // 2. Fetch Instagram media
    try {
      const igRes = await InstagramService.getMedia(limit)
      const igData = igRes.data?.data ?? igRes.data ?? []
      if (Array.isArray(igData)) {
        igData.forEach((p: any) => {
          posts.push({
            id: p.id,
            platform: 'instagram',
            title: p.caption || '(No caption)',
            caption: p.caption,
            time: p.timestamp,
            type: 'ig',
            imageUrl: p.media_url,
            permalink: p.permalink,
            likes: p.like_count || 0,
            comments: p.comments_count || 0,
          })
        })
      }
    } catch (e: any) {
      console.error('[Posts API] Failed to fetch IG media:', e.message)
    }

    // Sort by time desc
    posts.sort((a, b) => new Date(b.time || 0).getTime() - new Date(a.time || 0).getTime())

    return NextResponse.json({ success: true, posts })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
