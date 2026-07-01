import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const whatsappUrl = process.env.WHATSAPP_SERVICE_URL
  if (!whatsappUrl) {
    return NextResponse.json({ error: 'WHATSAPP_SERVICE_URL not configured' }, { status: 500 })
  }

  try {
    const res = await fetch(`${whatsappUrl}/status`, {
      headers: {
        'x-api-secret': process.env.WHATSAPP_API_SECRET || '',
      },
      next: { revalidate: 0 },
    })

    if (!res.ok) {
      return NextResponse.json({ error: `Failed to fetch status: ${res.statusText}` }, { status: res.status })
    }

    const data = await res.json()
    
    // Normalize to camelCase
    return NextResponse.json({
      whatsappReady: data.whatsapp_ready,
      serviceStartedAt: data.service_started_at,
      qrGeneratedAt: data.qr_generated_at,
      qrFileExists: data.qr_file_exists,
      sessionAuthenticatedAt: data.session_authenticated_at,
      lastDisconnectReason: data.last_disconnect_reason,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'WhatsApp service unreachable'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
