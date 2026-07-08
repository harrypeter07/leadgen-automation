import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || 'FLOWFYP_VERIFY_TOKEN'
const APP_SECRET   = process.env.META_APP_SECRET || ''

// GET /api/meta/webhook — Challenge verification
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode      = searchParams.get('hub.mode')
  const token     = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[Meta Webhook] ✓ Verification challenge passed.')
    // Must return the raw challenge string
    return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } })
  }

  console.warn('[Meta Webhook] ✗ Verification failed — token mismatch or wrong mode.', { mode, token })
  return NextResponse.json({ error: 'Verification failed.' }, { status: 403 })
}

// POST /api/meta/webhook — Incoming event delivery
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()

    // Validate X-Hub-Signature-256 if APP_SECRET is set
    if (APP_SECRET) {
      const signature = req.headers.get('x-hub-signature-256') || ''
      const expected  = 'sha256=' + crypto.createHmac('sha256', APP_SECRET).update(rawBody).digest('hex')
      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
        console.warn('[Meta Webhook] ✗ Signature mismatch — payload rejected.')
        return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 })
      }
    }

    const body = JSON.parse(rawBody)
    const object = body.object as string

    console.log(`[Meta Webhook] Received ${object} event:`, JSON.stringify(body).slice(0, 400))

    // Route to n8n communication hub (forward the raw payload)
    const n8nUrl = process.env.N8N_BASE_URL
    if (n8nUrl) {
      fetch(`${n8nUrl}/webhook/meta-communication-inbound`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).catch(err => console.error('[Meta Webhook] Failed to forward to n8n:', err.message))
    }

    // Also log to backend if available
    const backendUrl = process.env.V3_BACKEND_URL || process.env.WHATSAPP_SERVICE_URL
    if (backendUrl) {
      fetch(`${backendUrl}/api/automation/accounts/logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-secret': process.env.WHATSAPP_API_SECRET || '',
        },
        body: JSON.stringify({
          action: `WEBHOOK_${(object || 'unknown').toUpperCase()}`,
          details: JSON.stringify(body).slice(0, 500),
        }),
      }).catch(() => {})
    }

    // Meta requires a 200 OK within 20 seconds
    return NextResponse.json({ received: true })
  } catch (err: unknown) {
    console.error('[Meta Webhook] POST error:', err)
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 })
  }
}
