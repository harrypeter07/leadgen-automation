/**
 * instrumentation.ts — Next.js server startup hook
 *
 * This file runs ONCE when the Next.js server starts (on Railway).
 * It boots a background polling loop that calls auto-reply-scan every 30 seconds
 * entirely server-side — no browser tab, no frontend needed.
 *
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Only run in the Node.js runtime (not Edge), and only on the server
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  // Small initial delay to let the server fully start before first scan
  await new Promise(res => setTimeout(res, 10000))

  console.log('[AutoReplyWorker] Server-side background worker started.')

  // Self-calling loop — runs every 30 seconds forever
  const runScan = async () => {
    try {
      const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN || process.env.RAILWAY_STATIC_URL
      const baseUrl = railwayDomain
        ? `https://${railwayDomain}`
        : (process.env.NEXTAUTH_URL || 'http://localhost:3000')

      const res = await fetch(`${baseUrl}/api/meta/instagram/auto-reply-scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-worker': 'railway-instrumentation',
        },
      })

      if (res.ok) {
        const data = await res.json()
        if (data.processedCount > 0) {
          console.log(`[AutoReplyWorker] Scan complete — replied to ${data.processedCount} thread(s).`)
        }
      } else {
        const text = await res.text()
        console.warn(`[AutoReplyWorker] Scan returned ${res.status}: ${text.slice(0, 100)}`)
      }
    } catch (err: any) {
      console.warn('[AutoReplyWorker] Scan fetch error:', err.message)
    }

    // Schedule next scan in 30 seconds
    setTimeout(runScan, 30000)
  }

  // Kick off the loop
  runScan()
}
