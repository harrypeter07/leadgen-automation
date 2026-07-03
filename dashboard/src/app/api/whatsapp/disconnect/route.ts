import { NextResponse } from 'next/server'

export async function POST() {
  const whatsappUrl = process.env.WHATSAPP_SERVICE_URL
  if (!whatsappUrl) {
    return NextResponse.json({ success: false, error: 'WHATSAPP_SERVICE_URL not configured' }, { status: 500 })
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 25000)

  try {
    const res = await fetch(`${whatsappUrl}/disconnect`, {
      method: 'POST',
      headers: {
        'x-api-secret': process.env.WHATSAPP_API_SECRET || process.env.API_SECRET || '',
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    const data = await res.json()
    if (!res.ok) {
      return NextResponse.json(data, { status: res.status })
    }

    return NextResponse.json(data)
  } catch (error: unknown) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json({ success: false, error: 'Request timed out' }, { status: 504 })
    }
    return NextResponse.json({ success: false, error: 'Could not reach WhatsApp service' }, { status: 502 })
  }
}
