import { NextRequest, NextResponse } from 'next/server'

function getTargetUrl(baseUrl: string, subPath: string) {
  let formatted = baseUrl.trim()
  if (!formatted.startsWith('http://') && !formatted.startsWith('https://')) {
    formatted = `https://${formatted}`
  }
  // Remove trailing slashes
  formatted = formatted.replace(/\/+$/, '')
  return `${formatted}/api/automation/${subPath}`
}

export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  const backendUrl = process.env.V3_BACKEND_URL || process.env.WHATSAPP_SERVICE_URL;
  if (!backendUrl) {
    return NextResponse.json({ error: 'V3_BACKEND_URL not configured' }, { status: 500 })
  }

  const subPath = params.path.join('/')
  const targetUrl = getTargetUrl(backendUrl, subPath)

  try {
    const body = await req.json().catch(() => ({}))
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-secret': process.env.WHATSAPP_API_SECRET || '',
      },
      body: JSON.stringify(body)
    })

    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Proxy connection failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  const backendUrl = process.env.V3_BACKEND_URL || process.env.WHATSAPP_SERVICE_URL;
  if (!backendUrl) {
    return NextResponse.json({ error: 'V3_BACKEND_URL not configured' }, { status: 500 })
  }

  const subPath = params.path.join('/')
  const targetUrl = getTargetUrl(backendUrl, subPath)

  try {
    const res = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'x-api-secret': process.env.WHATSAPP_API_SECRET || '',
      },
    })

    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Proxy connection failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { path: string[] } }) {
  const backendUrl = process.env.V3_BACKEND_URL || process.env.WHATSAPP_SERVICE_URL;
  if (!backendUrl) {
    return NextResponse.json({ error: 'V3_BACKEND_URL not configured' }, { status: 500 })
  }

  const subPath = params.path.join('/')
  const targetUrl = getTargetUrl(backendUrl, subPath)

  try {
    const res = await fetch(targetUrl, {
      method: 'DELETE',
      headers: {
        'x-api-secret': process.env.WHATSAPP_API_SECRET || '',
      },
    })

    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Proxy connection failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: { path: string[] } }) {
  const backendUrl = process.env.V3_BACKEND_URL || process.env.WHATSAPP_SERVICE_URL;
  if (!backendUrl) {
    return NextResponse.json({ error: 'V3_BACKEND_URL not configured' }, { status: 500 })
  }

  const subPath = params.path.join('/')
  const targetUrl = getTargetUrl(backendUrl, subPath)

  try {
    const body = await req.json().catch(() => ({}))
    const res = await fetch(targetUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-api-secret': process.env.WHATSAPP_API_SECRET || '',
      },
      body: JSON.stringify(body)
    })

    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Proxy connection failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
