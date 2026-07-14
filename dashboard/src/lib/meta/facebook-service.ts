// lib/meta/facebook-service.ts
import { MetaClient, MetaApiResponse } from './meta-client'
import { MetaLogger } from './meta-logger'
import { ensureMetaConfig } from './runtime-config'

const SOURCE = 'FacebookService'

async function getPageId() {
  await ensureMetaConfig()
  // META_PAGE_ID from config, fallback to the Smriti page linked to Instagram
  return process.env.META_PAGE_ID || '1165738093294228'
}

async function getPageToken() {
  await ensureMetaConfig()
  // MESSENGER_PAGE_TOKEN = Smriti page token from Instagram Messaging API section
  // Falls back to META_PAGE_ACCESS_TOKEN if not separately configured
  return process.env.MESSENGER_PAGE_TOKEN || process.env.META_PAGE_ACCESS_TOKEN || ''
}

export const FacebookService = {
  async getPage(fields = 'id,name,fan_count,link,category,about,website,phone,picture') {
    const pageId = await getPageId(); const token = await getPageToken()
    MetaLogger.request(SOURCE, 'GET', `/${pageId}`)
    const res = await MetaClient.get<Record<string,unknown>>(`/${pageId}?fields=${fields}&access_token=${token}`, { source: SOURCE })
    MetaLogger.response(SOURCE, `/${pageId}`, res.statusCode, res.duration, res.error as MetaApiResponse['error'])
    return res
  },
  async getPosts(limit = 20) {
    const pageId = await getPageId(); const token = await getPageToken()
    const endpoint = `/${pageId}/posts?fields=id,message,created_time,permalink_url,attachments,likes.summary(true),comments.summary(true)&limit=${limit}&access_token=${token}`
    MetaLogger.request(SOURCE, 'GET', endpoint)
    const res = await MetaClient.get<{ data: unknown[] }>(endpoint, { source: SOURCE })
    MetaLogger.response(SOURCE, endpoint, res.statusCode, res.duration, res.error as MetaApiResponse['error'])
    return res
  },
  async getComments(postId: string, limit = 25) {
    const token = await getPageToken()
    const endpoint = `/${postId}/comments?fields=id,message,from,created_time,like_count&limit=${limit}&access_token=${token}`
    const res = await MetaClient.get<{ data: unknown[] }>(endpoint, { source: SOURCE })
    return res
  },
  async replyToComment(commentId: string, message: string) {
    const token = await getPageToken()
    MetaLogger.request(SOURCE, 'POST', `/${commentId}/comments`, { message })
    const res = await MetaClient.post<{ id: string }>(`/${commentId}/comments`, { message, access_token: token }, { source: SOURCE })
    MetaLogger.response(SOURCE, `/${commentId}/comments`, res.statusCode, res.duration, res.error as MetaApiResponse['error'])
    return res
  },
  async hideComment(commentId: string, hide = true) {
    const token = await getPageToken()
    return MetaClient.post<{ success: boolean }>(`/${commentId}`, { is_hidden: hide, access_token: token }, { source: SOURCE })
  },
  async publishPost(message: string, link?: string, scheduledTime?: number) {
    const pageId = await getPageId(); const token = await getPageToken()
    const body: Record<string, unknown> = { message, access_token: token }
    if (link) body.link = link
    if (scheduledTime) { body.scheduled_publish_time = scheduledTime; body.published = false }
    MetaLogger.request(SOURCE, 'POST', `/${pageId}/feed`, { message, link, scheduledTime })
    const res = await MetaClient.post<{ id: string }>(`/${pageId}/feed`, body, { source: SOURCE })
    MetaLogger.response(SOURCE, `/${pageId}/feed`, res.statusCode, res.duration, res.error as MetaApiResponse['error'])
    return res
  },
  async deletePost(postId: string) {
    const token = await getPageToken()
    return MetaClient.delete<{ success: boolean }>(`/${postId}?access_token=${token}`, { source: SOURCE })
  },
  async getInsights(metric = 'page_total_actions,page_views_total,page_follows', period = 'day') {
    const pageId = await getPageId(); const token = await getPageToken()
    const endpoint = `/${pageId}/insights?metric=${metric}&period=${period}&access_token=${token}`
    MetaLogger.request(SOURCE, 'GET', endpoint)
    const res = await MetaClient.get<{ data: unknown[] }>(endpoint, { source: SOURCE })
    MetaLogger.response(SOURCE, endpoint, res.statusCode, res.duration, res.error as MetaApiResponse['error'])
    return res
  },
  async getMessages(limit = 20) {
    const pageId = await getPageId(); const token = await getPageToken()
    const endpoint = `/${pageId}/conversations?platform=messenger&fields=id,link,participants,messages{message,from,created_time}&limit=${limit}&access_token=${token}`
    return MetaClient.get<{ data: unknown[] }>(endpoint, { source: SOURCE })
  },
  async getConversationMessages(conversationId: string, limit = 50) {
    const token = await getPageToken()
    // Fetch ALL messages for a specific conversation with attachments
    const endpoint = `/${conversationId}/messages?fields=id,message,from,created_time,attachments&limit=${limit}&access_token=${token}`
    return MetaClient.get<{ data: unknown[]; paging?: unknown }>(endpoint, { source: SOURCE })
  },
  async sendMessage(recipientId: string, text: string, tokenOverride?: string, pageIdOverride?: string) {
    const pageId = pageIdOverride || await getPageId();
    const token = tokenOverride || await getPageToken()
    MetaLogger.request(SOURCE, 'POST', `/${pageId}/messages`, { recipientId, text })
    const res = await MetaClient.post<{ message_id: string }>(`/${pageId}/messages`, { recipient: { id: recipientId }, message: { text }, access_token: token }, { source: SOURCE })
    MetaLogger.response(SOURCE, `/${pageId}/messages`, res.statusCode, res.duration, res.error as MetaApiResponse['error'])
    return res
  },
  // Fetch a single FB post with specific fields (likes, comments, shares)
  async getPost(postId: string, fields = 'id,message,created_time,permalink_url,likes.summary(true),comments.summary(true),shares') {
    const token = await getPageToken()
    const endpoint = `/${postId}?fields=${fields}&access_token=${token}`
    MetaLogger.request(SOURCE, 'GET', endpoint)
    const res = await MetaClient.get<Record<string, unknown>>(endpoint, { source: SOURCE })
    MetaLogger.response(SOURCE, endpoint, res.statusCode, res.duration, res.error as MetaApiResponse['error'])
    return res
  },
  // Fetch per-post Facebook insights (impressions, reach, clicks, reactions, video views)
  async getPostInsights(postId: string, metrics = 'post_impressions,post_impressions_unique,post_clicks,post_reactions_like_total,post_video_views') {
    const token = await getPageToken()
    const endpoint = `/${postId}/insights?metric=${metrics}&access_token=${token}`
    MetaLogger.request(SOURCE, 'GET', endpoint)
    const res = await MetaClient.get<{ data: unknown[] }>(endpoint, { source: SOURCE })
    MetaLogger.response(SOURCE, endpoint, res.statusCode, res.duration, res.error as MetaApiResponse['error'])
    return res
  },
}

