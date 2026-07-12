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
  // For graph.instagram.com endpoints (profile, media read) use Instagram user token
  return process.env.INSTAGRAM_ACCESS_TOKEN || process.env.META_PAGE_ACCESS_TOKEN || ''
}

// Publishing to /{igId}/media on graph.facebook.com REQUIRES a Page Access Token (EAA...)
// NOT the Instagram user token (IGAAo...) — that causes "Cannot parse access token"
async function getPageToken() {
  await ensureMetaConfig()
  return process.env.META_PAGE_ACCESS_TOKEN || process.env.INSTAGRAM_ACCESS_TOKEN || ''
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
    const igId = await getIgBizId()
    if (!igId) {
      return { success: false, error: { message: 'INSTAGRAM_BUSINESS_ID is not configured in settings', type: 'OAuthException', code: 0 }, statusCode: 400, duration: 0, endpoint: '', requestId: '' }
    }
    // MUST use Page Access Token (EAA...) for graph.facebook.com publish endpoints
    const token = await getPageToken()
    // Step 1: Create media container via Facebook Graph API
    const container = await MetaClient.post<{ id: string }>(`/${igId}/media`, { image_url: imageUrl, caption }, { accessToken: token, source: SOURCE })
    if (!container.success || !container.data?.id) return container

    const containerId = container.data.id

    // Polling container status (up to 8 attempts, waiting 2 seconds between each)
    let attempts = 0
    while (attempts < 8) {
      await new Promise(resolve => setTimeout(resolve, 2000))
      attempts++

      try {
        const statusRes = await MetaClient.get<{ status_code: string; error_message?: string }>(`/${containerId}?fields=status_code,error_message`, { accessToken: token, source: SOURCE })
        if (statusRes.success && statusRes.data?.status_code === 'FINISHED') {
          break
        }
        if (statusRes.success && (statusRes.data?.status_code === 'ERROR' || statusRes.data?.status_code === 'EXPIRED')) {
          const failMsg = statusRes.data?.error_message || `Instagram media container status: ${statusRes.data?.status_code}`
          return { success: false, error: { message: failMsg, type: 'OAuthException', code: 0 }, statusCode: statusRes.statusCode, duration: statusRes.duration, endpoint: statusRes.endpoint, requestId: statusRes.requestId }
        }
      } catch (pollErr) {
        console.warn(`[InstagramService] Error polling container status:`, pollErr)
      }
    }

    // Step 2: Publish
    return MetaClient.post<{ id: string }>(`/${igId}/media_publish`, { creation_id: containerId }, { accessToken: token, source: SOURCE })
  },
  async publishReel(videoUrl: string, caption: string) {
    const igId = await getIgBizId()
    if (!igId) {
      return { success: false, error: { message: 'INSTAGRAM_BUSINESS_ID is not configured in settings', type: 'OAuthException', code: 0 }, statusCode: 400, duration: 0, endpoint: '', requestId: '' }
    }
    // MUST use Page Access Token (EAA...) for graph.facebook.com publish endpoints
    const token = await getPageToken()
    // Step 1: Create video/reel container via Facebook Graph API
    const container = await MetaClient.post<{ id: string }>(`/${igId}/media`, { video_url: videoUrl, caption, media_type: 'REELS' }, { accessToken: token, source: SOURCE })
    if (!container.success || !container.data?.id) return container

    const containerId = container.data.id

    // Reels can take longer, poll up to 15 attempts
    let attempts = 0
    while (attempts < 15) {
      await new Promise(resolve => setTimeout(resolve, 3000))
      attempts++

      try {
        const statusRes = await MetaClient.get<{ status_code: string; error_message?: string }>(`/${containerId}?fields=status_code,error_message`, { accessToken: token, source: SOURCE })
        if (statusRes.success && statusRes.data?.status_code === 'FINISHED') {
          break
        }
        if (statusRes.success && (statusRes.data?.status_code === 'ERROR' || statusRes.data?.status_code === 'EXPIRED')) {
          const failMsg = statusRes.data?.error_message || `Instagram Reel container status: ${statusRes.data?.status_code}`
          return { success: false, error: { message: failMsg, type: 'OAuthException', code: 0 }, statusCode: statusRes.statusCode, duration: statusRes.duration, endpoint: statusRes.endpoint, requestId: statusRes.requestId }
        }
      } catch (pollErr) {
        console.warn(`[InstagramService] Error polling Reel status:`, pollErr)
      }
    }

    // Step 2: Publish
    return MetaClient.post<{ id: string }>(`/${igId}/media_publish`, { creation_id: containerId }, { accessToken: token, source: SOURCE })
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
    // Instagram Messaging API — graph.instagram.com with IG user token
    return igPost<{ message_id: string }>('/me/messages', {
      recipient: { id: recipientId },
      message: { text }
    })
  },
  async sendTypingIndicator(recipientId: string, action: 'typing_on' | 'typing_off' = 'typing_on') {
    // Shows typing bubble to the recipient before sending the actual reply
    return igPost<{ recipient_id: string }>('/me/messages', {
      recipient: { id: recipientId },
      sender_action: action
    })
  },
  async getInsights(metric = 'reach,profile_views,follower_count', period = 'day') {
    const igId = await getIgBizId()
    // Insights requires the numeric IG business account ID via the graph.facebook.com endpoint with PAGE token
    const token = await getIgToken()
    const res = await MetaClient.get<{ data: unknown[] }>(`/${igId}/insights?metric=${metric}&period=${period}&access_token=${token}`, { source: SOURCE })
    return res
  },
  // Fetch a single IG media object with specified fields (like_count, comments_count)
  async getMediaById(mediaId: string, fields = 'id,caption,media_type,media_url,like_count,comments_count,timestamp') {
    const token = await getIgToken()
    const endpoint = `/${mediaId}?fields=${fields}&access_token=${token}`
    const res = await MetaClient.get<Record<string, unknown>>(endpoint, { source: SOURCE })
    return res
  },
  // Fetch per-media Instagram insights (impressions, reach, likes, comments, shares, video_views)
  async getMediaInsights(mediaId: string, metrics = 'impressions,reach,likes,comments,shares') {
    const token = await getIgToken()
    const endpoint = `/${mediaId}/insights?metric=${metrics}&access_token=${token}`
    const res = await MetaClient.get<{ data: unknown[] }>(endpoint, { source: SOURCE })
    return res
  },
}
