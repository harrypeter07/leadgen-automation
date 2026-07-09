// lib/meta/instagram-service.ts
// Uses graph.instagram.com (new Instagram API) with the INSTAGRAM_ACCESS_TOKEN
import { MetaClient, MetaApiResponse } from './meta-client'
import { MetaLogger } from './meta-logger'
import { ensureMetaConfig } from './runtime-config'

const SOURCE = 'InstagramService'
// New Instagram API base URL - different from Facebook Graph API
const IG_BASE = 'https://graph.instagram.com/v25.0'

async function getIgBizId() {
  await ensureMetaConfig()
  return process.env.INSTAGRAM_BUSINESS_ID || ''
}

async function getIgToken() {
  await ensureMetaConfig()
  // Prefer dedicated Instagram token (IGAAo...) over page access token
  return process.env.INSTAGRAM_ACCESS_TOKEN || process.env.META_PAGE_ACCESS_TOKEN || ''
}

async function igGet<T>(path: string): Promise<{ success: boolean; data?: T; error?: MetaApiResponse['error']; statusCode: number; duration: number }> {
  const token = await getIgToken()
  const url = `${IG_BASE}${path}${path.includes('?') ? '&' : '?'}access_token=${token}`
  MetaLogger.request(SOURCE, 'GET', url)
  const start = Date.now()
  try {
    const res = await fetch(url)
    const data = await res.json() as Record<string, unknown>
    const duration = Date.now() - start
    if (!res.ok || (data as Record<string, unknown>).error) {
      return { success: false, error: (data as Record<string, unknown>).error as MetaApiResponse['error'], statusCode: res.status, duration }
    }
    return { success: true, data: data as T, statusCode: res.status, duration }
  } catch (err) {
    return { success: false, error: { message: String(err), type: 'NetworkError', code: 0, fbtrace_id: '' }, statusCode: 0, duration: Date.now() - start }
  }
}

async function igPost<T>(path: string, body: Record<string, unknown>): Promise<{ success: boolean; data?: T; error?: MetaApiResponse['error']; statusCode: number; duration: number }> {
  const token = await getIgToken()
  const url = `${IG_BASE}${path}`
  MetaLogger.request(SOURCE, 'POST', url, body)
  const start = Date.now()
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(body)
    })
    const data = await res.json() as Record<string, unknown>
    const duration = Date.now() - start
    if (!res.ok || (data as Record<string, unknown>).error) {
      return { success: false, error: (data as Record<string, unknown>).error as MetaApiResponse['error'], statusCode: res.status, duration }
    }
    return { success: true, data: data as T, statusCode: res.status, duration }
  } catch (err) {
    return { success: false, error: { message: String(err), type: 'NetworkError', code: 0, fbtrace_id: '' }, statusCode: 0, duration: Date.now() - start }
  }
}

export const InstagramService = {
  async getProfile() {
    return igGet<Record<string, unknown>>('/me?fields=id,name,username,biography,followers_count,follows_count,media_count,profile_picture_url,website')
  },
  async getMedia(limit = 20) {
    return igGet<{ data: unknown[] }>(`/me/media?fields=id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count,thumbnail_url&limit=${limit}`)
  },
  async publishPost(imageUrl: string, caption: string) {
    // Step 1: Create media container
    const container = await igPost<{ id: string }>('/me/media', { image_url: imageUrl, caption })
    if (!container.success || !container.data?.id) return container
    // Step 2: Publish
    return igPost<{ id: string }>('/me/media_publish', { creation_id: container.data.id })
  },
  async publishReel(videoUrl: string, caption: string) {
    const container = await igPost<{ id: string }>('/me/media', { video_url: videoUrl, caption, media_type: 'REELS' })
    if (!container.success || !container.data?.id) return container
    return igPost<{ id: string }>('/me/media_publish', { creation_id: container.data.id })
  },
  async getComments(mediaId: string, limit = 25) {
    return igGet<{ data: unknown[] }>(`/${mediaId}/comments?fields=id,text,from,timestamp,like_count,replies{text,from,timestamp}&limit=${limit}`)
  },
  async replyToComment(commentId: string, message: string) {
    return igPost<{ id: string }>(`/${commentId}/replies`, { message })
  },
  async getMessages(limit = 20) {
    // Uses new Instagram API - /me/conversations
    // NOTE: participants return 'username' not 'name' in live mode
    return igGet<{ data: unknown[] }>(`/me/conversations?fields=id,participants{id,name,username},messages{id,message,from,created_time},updated_time&limit=${limit}`)
  },
  async getConversationMessages(conversationId: string, limit = 50) {
    // Fetch ALL messages for a specific conversation with attachments
    return igGet<{ data: unknown[]; paging?: unknown }>(
      `/${conversationId}/messages?fields=id,message,from,created_time,attachments{id,mime_type,file_url,name,image_data}&limit=${limit}`
    )
  },
  async sendDM(recipientId: string, text: string) {
    MetaLogger.request(SOURCE, 'POST', `${IG_BASE}/me/messages`, { recipientId, text })
    // Uses Authorization Bearer header format for Instagram Messaging API
    return igPost<{ message_id: string }>('/me/messages', {
      recipient: { id: recipientId },
      message: { text }
    })
  },
  async getInsights(metric = 'reach,profile_views,follower_count', period = 'day') {
    const igId = await getIgBizId()
    // Insights requires the numeric IG business account ID via the graph.facebook.com endpoint with PAGE token
    const token = await getIgToken()
    const res = await MetaClient.get<{ data: unknown[] }>(`/${igId}/insights?metric=${metric}&period=${period}&access_token=${token}`, { source: SOURCE })
    return res
  },
}
