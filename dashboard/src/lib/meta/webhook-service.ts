// lib/meta/webhook-service.ts
import crypto from 'crypto'
import { MetaLogger } from './meta-logger'
const SOURCE = 'WebhookService'
function getVerifyToken() { return process.env.META_VERIFY_TOKEN || 'FLOWFYP_VERIFY_TOKEN' }
function getAppSecret() { return process.env.META_APP_SECRET || '' }
export const WebhookService = {
  verifyChallenge(mode: string | null, token: string | null, challenge: string | null): string | null {
    if (mode === 'subscribe' && token === getVerifyToken()) {
      MetaLogger.info(SOURCE, 'WEBHOOK_CHALLENGE_PASSED')
      return challenge
    }
    MetaLogger.warn(SOURCE, 'WEBHOOK_CHALLENGE_FAILED')
    return null
  },
  validateSignature(rawBody: string, signature: string | null): boolean {
    const appSecret = getAppSecret()
    if (!appSecret || !signature) { MetaLogger.warn(SOURCE, 'SIGNATURE_SKIP'); return !appSecret }
    const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')
    const valid = signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    if (!valid) MetaLogger.error(SOURCE, 'SIGNATURE_MISMATCH')
    return valid
  },
  parseEvent(body: Record<string, unknown>): { platform: 'messenger' | 'instagram' | 'whatsapp' | 'unknown'; entries: unknown[]; object: string } {
    const object = (body.object as string) || 'unknown'
    const entries = (body.entry as unknown[]) || []
    let platform: 'messenger' | 'instagram' | 'whatsapp' | 'unknown' = 'unknown'
    if (object === 'page') platform = 'messenger'
    else if (object === 'instagram') platform = 'instagram'
    else if (object === 'whatsapp_business_account') platform = 'whatsapp'
    MetaLogger.info(SOURCE, 'EVENT_PARSED', { payload: { object, platform, entryCount: entries.length } })
    return { platform, entries, object }
  },
}
