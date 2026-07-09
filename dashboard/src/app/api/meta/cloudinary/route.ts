import { NextRequest, NextResponse } from 'next/server'
import { ensureMetaConfig } from '@/lib/meta/runtime-config'

// GET /api/meta/cloudinary?folder=xxx
// Lists assets inside a Cloudinary folder using the Cloudinary Search API
export async function GET(req: NextRequest) {
  try {
    await ensureMetaConfig()
    const folder = req.nextUrl.searchParams.get('folder') || ''

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || ''
    const apiKey = process.env.CLOUDINARY_API_KEY || ''
    const apiSecret = process.env.CLOUDINARY_API_SECRET || ''

    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json({ error: 'Cloudinary credentials missing in environment/config table' }, { status: 400 })
    }

    // Call Cloudinary search API
    const authHeader = 'Basic ' + Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')
    const expression = folder ? `folder:${folder} AND resource_type:image` : 'resource_type:image'

    const cloudinaryRes = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/resources/search`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify({
          expression,
          max_results: 30,
        }),
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
    }))

    return NextResponse.json({ success: true, assets })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/meta/cloudinary
// Uploads an image file to Cloudinary directly and returns its secure CDN URL
export async function POST(req: NextRequest) {
  try {
    await ensureMetaConfig()
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || ''
    const apiKey = process.env.CLOUDINARY_API_KEY || ''
    const apiSecret = process.env.CLOUDINARY_API_SECRET || ''

    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json({ error: 'Cloudinary credentials missing in environment/config table' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Construct unsigned/signed upload form
    const timestamp = Math.floor(Date.now() / 1000)
    const signatureRaw = `timestamp=${timestamp}${apiSecret}`
    const signature = crypto.createHash('sha1').update(signatureRaw).digest('hex')

    const uploadForm = new FormData()
    const blob = new Blob([buffer], { type: file.type })
    uploadForm.append('file', blob, file.name)
    uploadForm.append('timestamp', String(timestamp))
    uploadForm.append('api_key', apiKey)
    uploadForm.append('signature', signature)

    const uploadRes = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: 'POST',
        body: uploadForm,
      }
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
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

import crypto from 'crypto'
