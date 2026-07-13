import { NextRequest, NextResponse } from 'next/server'
import { ensureMetaConfig } from '@/lib/meta/runtime-config'

// GET /api/meta/instagram/audio/search?q=xxx
// Queries the Meta Graph API for audio tracks / songs matching the query
export async function GET(req: NextRequest) {
  try {
    await ensureMetaConfig()
    const query = req.nextUrl.searchParams.get('q') || ''
    const token = process.env.INSTAGRAM_ACCESS_TOKEN || process.env.META_PAGE_ACCESS_TOKEN || ''

    if (!token) {
      return NextResponse.json({ error: 'Instagram Access Token missing' }, { status: 400 })
    }

    // If query is empty, fetch trending audio, else search
    const endpoint = query 
      ? `https://graph.instagram.com/v25.0/ig_audio_search?q=${encodeURIComponent(query)}`
      : `https://graph.instagram.com/v25.0/ig_audio`

    const url = `${endpoint}&access_token=${token}`

    const metaRes = await fetch(url)
    const data = await metaRes.json()

    if (!metaRes.ok || data.error) {
      const errMsg = data.error?.message || 'Meta Audio API error'
      return NextResponse.json({ error: errMsg }, { status: metaRes.status })
    }

    // Map Meta audio fields to a clean response format
    const songs = (data.data || []).map((song: any) => ({
      id: song.id,
      title: song.title || 'Unknown Track',
      artist: song.artist_name || 'Unknown Artist',
      coverUrl: song.cover_image_url || null,
      audioUrl: song.audio_url || null,
      duration: song.duration_in_ms || 0
    }))

    return NextResponse.json({ success: true, songs })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
