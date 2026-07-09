import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// POST /api/meta/media-upload
// Accepts: multipart/form-data with 'file' OR JSON with { driveUrl }
// Returns: { publicUrl } — a Supabase Storage CDN URL suitable for Instagram/Facebook posting

function extractDriveFileId(url: string): string | null {
  // Handles: /file/d/FILE_ID/view, /open?id=FILE_ID, /uc?id=FILE_ID
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || ''

    let fileBuffer: Buffer
    let fileName: string
    let mimeType: string

    if (contentType.includes('multipart/form-data')) {
      // Direct file upload
      const formData = await req.formData()
      const file = formData.get('file') as File | null
      if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
      const arrayBuffer = await file.arrayBuffer()
      fileBuffer = Buffer.from(arrayBuffer)
      fileName = `upload_${Date.now()}_${file.name.replace(/\s+/g, '_')}`
      mimeType = file.type
    } else {
      // Google Drive or URL download
      const { driveUrl, imageUrl } = await req.json()
      const sourceUrl = driveUrl || imageUrl
      if (!sourceUrl) return NextResponse.json({ error: 'driveUrl or imageUrl required' }, { status: 400 })

      let downloadUrl = sourceUrl
      if (sourceUrl.includes('drive.google.com')) {
        const fileId = extractDriveFileId(sourceUrl)
        if (!fileId) return NextResponse.json({ error: 'Could not extract Google Drive file ID from URL' }, { status: 400 })
        // Convert to direct download URL
        downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`
      }

      // Download the file
      const fetchRes = await fetch(downloadUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        redirect: 'follow',
      })
      if (!fetchRes.ok) {
        return NextResponse.json({ error: `Failed to download from source: HTTP ${fetchRes.status}` }, { status: 400 })
      }
      const arrayBuffer = await fetchRes.arrayBuffer()
      fileBuffer = Buffer.from(arrayBuffer)
      mimeType = fetchRes.headers.get('content-type') || 'image/jpeg'
      const ext = mimeType.split('/')[1]?.split(';')[0] || 'jpg'
      fileName = `media_${Date.now()}.${ext}`
    }

    // Upload to Supabase Storage (bucket: 'post-media')
    const { data, error } = await supabaseAdmin.storage
      .from('post-media')
      .upload(`uploads/${fileName}`, fileBuffer, {
        contentType: mimeType,
        upsert: false,
      })

    if (error) {
      // Bucket might not exist — try creating it first
      if (error.message?.includes('not found') || error.message?.includes('does not exist')) {
        await supabaseAdmin.storage.createBucket('post-media', { public: true })
        const retry = await supabaseAdmin.storage
          .from('post-media')
          .upload(`uploads/${fileName}`, fileBuffer, { contentType: mimeType, upsert: false })
        if (retry.error) {
          return NextResponse.json({ error: retry.error.message }, { status: 500 })
        }
      } else {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from('post-media')
      .getPublicUrl(`uploads/${fileName}`)

    return NextResponse.json({
      success: true,
      publicUrl: urlData.publicUrl,
      fileName,
      mimeType,
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Upload failed' }, { status: 500 })
  }
}
