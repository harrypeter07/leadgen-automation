import { NextRequest, NextResponse } from 'next/server'
import { ensureMetaConfig } from '@/lib/meta/runtime-config'

// ─────────────────────────────────────────────
// PHASE 1: Ask Gemini to generate relevant hashtags for the niche
// ─────────────────────────────────────────────
async function generateHashtags(
  topic: string,
  platform: string,
  apiKey: string
): Promise<string[]> {
  const { generateWithGemini } = await import('@/lib/gemini')
  const { text } = await generateWithGemini(
    {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Generate exactly 5 popular Instagram hashtags for the niche "${topic}" on ${platform}.
Return ONLY a JSON array of strings (no # prefix, lowercase, no spaces). Example: ["gymtok","fitnessreels","workoutvideo","fitlife","gymlife"]
Only return the JSON array, nothing else.`,
            },
          ],
        },
      ],
      generationConfig: {
        maxOutputTokens: 200,
        temperature: 0.4,
        responseMimeType: 'application/json',
      },
    },
    apiKey
  )

  try {
    let cleaned = text.trim()
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(json)?/, '').replace(/```$/, '').trim()
    }
    const tags = JSON.parse(cleaned)
    return Array.isArray(tags) ? tags.slice(0, 5) : []
  } catch {
    // Fallback: extract words that look like hashtags
    const matches = text.match(/["']([a-z0-9_]+)["']/g) || []
    return matches.slice(0, 5).map((m) => m.replace(/['"]/g, ''))
  }
}

// ─────────────────────────────────────────────
// PHASE 2: Search each hashtag on Instagram via Meta Graph API
// Returns real top posts (like counts, captions, media types)
// ─────────────────────────────────────────────
const GRAPH_BASE = 'https://graph.facebook.com/v21.0'

async function searchHashtagOnInstagram(
  hashtag: string,
  igUserId: string,
  accessToken: string
): Promise<{
  tag: string
  mediaCount?: number
  topPosts: { caption: string; likeCount: number; commentCount: number; mediaType: string }[]
}> {
  try {
    // Step 1: Get hashtag ID
    const idRes = await fetch(
      `${GRAPH_BASE}/ig_hashtag_search?user_id=${igUserId}&q=${encodeURIComponent(hashtag)}&access_token=${accessToken}`
    )
    const idData = await idRes.json()
    if (!idRes.ok || !idData.data?.[0]?.id) {
      return { tag: hashtag, topPosts: [] }
    }
    const hashtagId = idData.data[0].id

    // Step 2: Get top media for that hashtag
    const mediaRes = await fetch(
      `${GRAPH_BASE}/${hashtagId}/top_media?user_id=${igUserId}&fields=caption,like_count,comments_count,media_type&limit=5&access_token=${accessToken}`
    )
    const mediaData = await mediaRes.json()

    if (!mediaRes.ok || !mediaData.data) {
      return { tag: hashtag, topPosts: [] }
    }

    const topPosts = (mediaData.data as any[]).map((post) => ({
      caption: (post.caption || '').slice(0, 200), // truncate long captions
      likeCount: post.like_count || 0,
      commentCount: post.comments_count || 0,
      mediaType: post.media_type || 'UNKNOWN',
    }))

    return { tag: hashtag, topPosts }
  } catch {
    return { tag: hashtag, topPosts: [] }
  }
}

// ─────────────────────────────────────────────
// PHASE 3: Ask Gemini to synthesize ideas based on REAL data
// ─────────────────────────────────────────────
async function synthesizeWithRealData(
  topic: string,
  platform: string,
  hashtags: string[],
  realData: Awaited<ReturnType<typeof searchHashtagOnInstagram>>[],
  apiKey: string
): Promise<{
  niche: string
  hashtags: string[]
  sentiment: string
  ideas: { title: string; hook: string; description: string; copy: string; mediaSuggestion: string }[]
  dataSource: string
}> {
  const { generateWithGemini } = await import('@/lib/gemini')

  // Build a summary of real Instagram data to ground Gemini's response
  const realDataSummary = realData
    .map((d) => {
      if (d.topPosts.length === 0) return `#${d.tag}: No public data available`
      const avgLikes = Math.round(
        d.topPosts.reduce((sum, p) => sum + p.likeCount, 0) / d.topPosts.length
      )
      const mediaTypes = Array.from(new Set(d.topPosts.map((p) => p.mediaType))).join(', ')
      const sampleCaptions = d.topPosts
        .slice(0, 2)
        .map((p) => `"${p.caption.slice(0, 120)}..."`)
        .join(' | ')
      return `#${d.tag}: avg ${avgLikes} likes, media types: ${mediaTypes}, sample captions: ${sampleCaptions}`
    })
    .join('\n')

  const prompt = `You are a viral social media strategist. Based on REAL Instagram data I fetched from the Meta Graph API, create data-driven content ideas.

NICHE: "${topic}"
PLATFORM: ${platform}

REAL INSTAGRAM DATA (from Meta Graph API top posts):
${realDataSummary}

Using the above REAL data as inspiration (what captions work, what media types get likes, what format is popular), generate:
1. 3 high-converting reel/post ideas with hooks based on what's actually performing
2. The current audience sentiment based on the captions you see
3. A formatted JSON response

JSON structure:
{
  "niche": "${topic}",
  "hashtags": ${JSON.stringify(hashtags.map((t) => '#' + t))},
  "sentiment": "one sentence describing the trend/sentiment based on real data",
  "ideas": [
    {
      "title": "catchy title",
      "hook": "opening hook line (first 3 seconds)",
      "description": "what to film / concept explanation",
      "copy": "full caption copy with emojis",
      "mediaSuggestion": "specific format: Reel, Carousel, Photo, etc."
    }
  ]
}

Only return raw JSON. No markdown. Ground everything in the real data above.`

  const { text: rawText } = await generateWithGemini(
    {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 2000,
        temperature: 0.65,
        responseMimeType: 'application/json',
      },
    },
    apiKey
  )

  let cleaned = rawText.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(json)?/, '').replace(/```$/, '').trim()
  }
  const parsed = JSON.parse(cleaned)
  return { ...parsed, dataSource: 'meta_graph_api' }
}

export async function POST(req: NextRequest) {
  try {
    await ensureMetaConfig()
    const { topic, platform = 'instagram', directMode = false } = await req.json()

    if (!topic?.trim()) {
      return NextResponse.json({ error: 'topic is required' }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY || ''
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 503 })
    }

    const igUserId = process.env.INSTAGRAM_BUSINESS_ID || process.env.META_IG_USER_ID || ''
    const accessToken = process.env.META_PAGE_ACCESS_TOKEN || process.env.INSTAGRAM_ACCESS_TOKEN || ''

    // ── Phase 1: Gemini generates hashtags ──
    const hashtags = await generateHashtags(topic, platform, apiKey)

    // ── Phase 2: Search each hashtag on Instagram (parallel) ──
    let realData: Awaited<ReturnType<typeof searchHashtagOnInstagram>>[] = []
    let hasRealData = false

    if (igUserId && accessToken) {
      realData = await Promise.all(
        hashtags.map((tag) => searchHashtagOnInstagram(tag, igUserId, accessToken))
      )
      hasRealData = realData.some((d) => d.topPosts.length > 0)
    }

    // If directMode is active AND we fetched real posts, bypass Gemini synthesis
    if (directMode && hasRealData) {
      // Flatten all posts and sort by like count descending
      const allPosts: { caption: string; likeCount: number; commentCount: number; mediaType: string; hashtag: string }[] = []
      realData.forEach((d) => {
        d.topPosts.forEach((post) => {
          allPosts.push({
            ...post,
            hashtag: d.tag
          })
        })
      })

      // Sort by likes descending
      allPosts.sort((a, b) => b.likeCount - a.likeCount)

      // Take the top 5 unique-ish or just top 5 posts
      const topPosts = allPosts.slice(0, 5)

      const ideas = topPosts.map((post, idx) => ({
        title: `Instagram Top Post (via #${post.hashtag})`,
        hook: `Likes: ${post.likeCount.toLocaleString()} | Comments: ${post.commentCount.toLocaleString()}`,
        description: `Source format: ${post.mediaType}`,
        copy: post.caption || '[No caption]',
        mediaSuggestion: post.mediaType
      }))

      return NextResponse.json({
        success: true,
        niche: topic,
        hashtags: hashtags.map(t => '#' + t),
        sentiment: `Direct Feed: Showing raw top-performing posts directly from Instagram for niche hashtags.`,
        ideas,
        realDataFetched: true,
        directMode: true,
        hashtagsSearched: hashtags
      })
    }

    // ── Phase 3: Gemini synthesizes ideas based on real data (or falls back) ──
    const result = await synthesizeWithRealData(topic, platform, hashtags, realData, apiKey)

    return NextResponse.json({
      success: true,
      ...result,
      realDataFetched: hasRealData,
      directMode: false,
      hashtagsSearched: hashtags,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
