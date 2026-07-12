import { NextRequest, NextResponse } from 'next/server'
import { ensureMetaConfig } from '@/lib/meta/runtime-config'
import crypto from 'crypto'

// GET /api/meta/cloudinary?folder=xxx&resource_type=image|video|all
// Lists assets inside a Cloudinary folder using the Cloudinary Search API
export async function GET(req: NextRequest) {
  try {
    await ensureMetaConfig()
    const folder = req.nextUrl.searchParams.get('folder') || ''
    const resourceType = req.nextUrl.searchParams.get('resource_type') || 'all'

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || ''
    const apiKey = process.env.CLOUDINARY_API_KEY || ''
    const apiSecret = process.env.CLOUDINARY_API_SECRET || ''

    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json({ error: 'Cloudinary credentials missing' }, { status: 400 })
    }

    const authHeader = 'Basic ' + Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')

    // Build expression based on resource type filter
    let typeFilter = ''
    if (resourceType === 'image') typeFilter = 'AND resource_type:image'
    else if (resourceType === 'video') typeFilter = 'AND resource_type:video'
    // else 'all' — no filter

    const expression = folder
      ? `folder:${folder} ${typeFilter}`.trim()
      : typeFilter.replace('AND ', '') || 'resource_type:image OR resource_type:video'

    const cloudinaryRes = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/resources/search`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify({ expression, max_results: 50, sort_by: [{ created_at: 'desc' }] }),
      }
    )

    if (!cloudinaryRes.ok) {
      const err = await cloudinaryRes.text()
      return NextResponse.json({ error: `Cloudinary API error: ${err}` }, { status: cloudinaryRes.status })
    }

    const data = await cloudinaryRes.json()
    const assets = (data.resources || []).map((r: any) => ({
      publicId: r.public_id,
      url: r.secure_url,
      format: r.format,
      bytes: r.bytes,
      createdAt: r.created_at,
      resourceType: r.resource_type, // 'image' or 'video'
      duration: r.duration || null,  // video duration in seconds
      width: r.width || null,
      height: r.height || null,
    }))

    return NextResponse.json({ success: true, assets })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/meta/cloudinary
// Uploads an image OR video file to Cloudinary and returns its secure CDN URL
// Supports single file upload. For progress, use the XMLHttpRequest path on the client.
export async function POST(req: NextRequest) {
  try {
    await ensureMetaConfig()
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const folder = (formData.get('folder') as string) || ''

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || ''
    const apiKey = process.env.CLOUDINARY_API_KEY || ''
    const apiSecret = process.env.CLOUDINARY_API_SECRET || ''

    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json({ error: 'Cloudinary credentials missing' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Detect resource type from MIME
    const isVideo = file.type.startsWith('video/')
    const resourceType = isVideo ? 'video' : 'image'

    // Build signed upload params
    const timestamp = Math.floor(Date.now() / 1000)
    const paramsToSign: Record<string, string> = { timestamp: String(timestamp) }
    if (folder) paramsToSign.folder = folder

    const signatureRaw =
      Object.keys(paramsToSign)
        .sort()
        .map((k) => `${k}=${paramsToSign[k]}`)
        .join('&') + apiSecret

    const signature = crypto.createHash('sha1').update(signatureRaw).digest('hex')

    const uploadForm = new FormData()
    const blob = new Blob([buffer], { type: file.type })
    uploadForm.append('file', blob, file.name)
    uploadForm.append('timestamp', String(timestamp))
    uploadForm.append('api_key', apiKey)
    uploadForm.append('signature', signature)
    if (folder) uploadForm.append('folder', folder)

    const uploadRes = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
      { method: 'POST', body: uploadForm }
    )

    if (!uploadRes.ok) {
      const err = await uploadRes.text()
      return NextResponse.json({ error: `Cloudinary upload error: ${err}` }, { status: uploadRes.status })
    }

    const data = await uploadRes.json()
    return NextResponse.json({
      success: true,
      publicUrl: data.secure_url,
      publicId: data.public_id,
      resourceType: data.resource_type,
      format: data.format,
      bytes: data.bytes,
      duration: data.duration || null,
      width: data.width || null,
      height: data.height || null,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// GET /api/meta/cloudinary/sign — returns upload signature for direct browser uploads with progress
// Called by the frontend before each direct Cloudinary upload
export async function PUT(req: NextRequest) {
  try {
    await ensureMetaConfig()
    const { folder } = await req.json().catch(() => ({ folder: '' }))

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || ''
    const apiKey = process.env.CLOUDINARY_API_KEY || ''
    const apiSecret = process.env.CLOUDINARY_API_SECRET || ''

    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json({ error: 'Cloudinary credentials missing' }, { status: 400 })
    }

    const timestamp = Math.floor(Date.now() / 1000)
    const paramsToSign: Record<string, string> = { timestamp: String(timestamp) }
    if (folder) paramsToSign.folder = folder

    const signatureRaw =
      Object.keys(paramsToSign)
        .sort()
        .map((k) => `${k}=${paramsToSign[k]}`)
        .join('&') + apiSecret

    const signature = crypto.createHash('sha1').update(signatureRaw).digest('hex')

    return NextResponse.json({ timestamp, signature, apiKey, cloudName, folder })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
