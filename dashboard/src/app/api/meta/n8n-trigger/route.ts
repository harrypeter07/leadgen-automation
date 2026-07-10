import { NextRequest, NextResponse } from 'next/server'

// POST /api/meta/n8n-trigger
// Triggers n8n workflow for outbound manual messages to sync state and trigger downstream n8n nodes
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json()
    const { type, platform, recipientId, threadId, senderName, message, timestamp } = payload

    const n8nUrl = process.env.N8N_BASE_URL || process.env.N8N_WEBHOOK_BASE_URL
    if (!n8nUrl) {
      console.warn('[n8n-trigger] N8N_BASE_URL not configured. Skipping trigger.')
      return NextResponse.json({ success: false, error: 'n8n not configured' })
    }

    const myIgId = process.env.INSTAGRAM_BUSINESS_ID || '17841411718913026'
    const pageId = process.env.META_PAGE_ID || '1165738093294228'

    // Format the payload to resemble a Meta Webhook Outbound message so n8n can process it natively
    const metaWebhookPayload = {
      object: platform === 'instagram' ? 'instagram' : 'page',
      entry: [
        {
          id: platform === 'instagram' ? myIgId : pageId,
          time: Math.floor(Date.now() / 1000),
          messaging: [
            {
              sender: { id: platform === 'instagram' ? myIgId : pageId },
              recipient: { id: recipientId },
              timestamp: Math.floor(new Date(timestamp || Date.now()).getTime() / 1000),
              message: {
                mid: `mid.manual.${Date.now()}.${Math.random().toString(36).substring(7)}`,
                text: message,
                is_manual_outbound: true
              }
            }
          ]
        }
      ]
    }

    const targetUrl = `${n8nUrl.replace(/\/$/, '')}/webhook/meta-communication-inbound`
    console.log(`[n8n-trigger] Forwarding manual reply to n8n webhook: ${targetUrl}`)

    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metaWebhookPayload),
    })

    if (!res.ok) {
      const errorText = await res.text()
      throw new Error(`n8n responded with status ${res.status}: ${errorText}`)
    }

    return NextResponse.json({ success: true, message: 'n8n triggered successfully' })
  } catch (err: any) {
    console.error('[n8n-trigger] Error triggering n8n:', err.message)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
