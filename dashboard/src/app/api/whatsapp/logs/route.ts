import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const whatsappUrl = process.env.WHATSAPP_SERVICE_URL
  if (!whatsappUrl) {
    return NextResponse.json({ error: 'WHATSAPP_SERVICE_URL not configured' }, { status: 500 })
  }

  try {
    const res = await fetch(`${whatsappUrl}/logs`, {
      headers: {
        'x-api-secret': process.env.WHATSAPP_API_SECRET || process.env.API_SECRET || '',
      },
      next: { revalidate: 0 },
    })

    if (!res.ok) {
      return NextResponse.json({ error: `Failed to fetch logs: ${res.statusText}` }, { status: res.status })
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'WhatsApp service unreachable'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
