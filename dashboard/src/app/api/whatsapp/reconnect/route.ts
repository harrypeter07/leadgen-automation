import { NextResponse } from 'next/server'

export async function POST() {
  const whatsappUrl = process.env.WHATSAPP_SERVICE_URL
  if (!whatsappUrl) {
    return NextResponse.json({ error: 'WHATSAPP_SERVICE_URL not configured' }, { status: 500 })
  }

  try {
    const res = await fetch(`${whatsappUrl}/reconnect`, {
      method: 'POST',
      headers: {
        'x-api-secret': process.env.WHATSAPP_API_SECRET || process.env.API_SECRET || '',
      },
    })

    const data = await res.json()
    if (!res.ok) {
      return NextResponse.json(data, { status: res.status })
    }

    return NextResponse.json(data)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to trigger reconnect'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
