// lib/meta/facebook-service.ts
import { MetaClient, MetaApiResponse } from './meta-client'
import { MetaLogger } from './meta-logger'
const SOURCE = 'FacebookService'
function getPageId() { return process.env.META_PAGE_ID || '' }
function getPageToken() { return process.env.META_PAGE_ACCESS_TOKEN || '' }
export const FacebookService = {
  async getPage(fields = 'id,name,fan_count,link,category,about,website,phone,picture') {
    const pageId = getPageId(); const token = getPageToken()
    MetaLogger.request(SOURCE, 'GET', `/${pageId}`)
    const res = await MetaClient.get<Record<string,unknown>>(`/${pageId}?fields=${fields}&access_token=${token}`, { source: SOURCE })
    MetaLogger.response(SOURCE, `/${pageId}`, res.statusCode, res.duration, res.error as MetaApiResponse['error'])
    return res
  },
  async getPosts(limit = 20) {
    const pageId = getPageId(); const token = getPageToken()
    const endpoint = `/${pageId}/posts?fields=id,message,created_time,permalink_url,attachments,likes.summary(true),comments.summary(true)&limit=${limit}&access_token=${token}`
    MetaLogger.request(SOURCE, 'GET', endpoint)
    const res = await MetaClient.get<{ data: unknown[] }>(endpoint, { source: SOURCE })
    MetaLogger.response(SOURCE, endpoint, res.statusCode, res.duration, res.error as MetaApiResponse['error'])
    return res
  },
  async getComments(postId: string, limit = 25) {
    const token = getPageToken()
    const endpoint = `/${postId}/comments?fields=id,message,from,created_time,like_count&limit=${limit}&access_token=${token}`
    const res = await MetaClient.get<{ data: unknown[] }>(endpoint, { source: SOURCE })
    return res
  },
  async replyToComment(commentId: string, message: string) {
    const token = getPageToken()
    MetaLogger.request(SOURCE, 'POST', `/${commentId}/comments`, { message })
    const res = await MetaClient.post<{ id: string }>(`/${commentId}/comments`, { message, access_token: token }, { source: SOURCE })
    MetaLogger.response(SOURCE, `/${commentId}/comments`, res.statusCode, res.duration, res.error as MetaApiResponse['error'])
    return res
  },
  async hideComment(commentId: string, hide = true) {
    const token = getPageToken()
    return MetaClient.post<{ success: boolean }>(`/${commentId}`, { is_hidden: hide, access_token: token }, { source: SOURCE })
  },
  async publishPost(message: string, link?: string, scheduledTime?: number) {
    const pageId = getPageId(); const token = getPageToken()
    const body: Record<string, unknown> = { message, access_token: token }
    if (link) body.link = link
    if (scheduledTime) { body.scheduled_publish_time = scheduledTime; body.published = false }
    MetaLogger.request(SOURCE, 'POST', `/${pageId}/feed`, { message, link, scheduledTime })
    const res = await MetaClient.post<{ id: string }>(`/${pageId}/feed`, body, { source: SOURCE })
    MetaLogger.response(SOURCE, `/${pageId}/feed`, res.statusCode, res.duration, res.error as MetaApiResponse['error'])
    return res
  },
  async deletePost(postId: string) {
    const token = getPageToken()
    return MetaClient.delete<{ success: boolean }>(`/${postId}?access_token=${token}`, { source: SOURCE })
  },
  async getInsights(metric = 'page_total_actions,page_views_total,page_follows', period = 'day') {
    const pageId = getPageId(); const token = getPageToken()
    const endpoint = `/${pageId}/insights?metric=${metric}&period=${period}&access_token=${token}`
    MetaLogger.request(SOURCE, 'GET', endpoint)
    const res = await MetaClient.get<{ data: unknown[] }>(endpoint, { source: SOURCE })
    MetaLogger.response(SOURCE, endpoint, res.statusCode, res.duration, res.error as MetaApiResponse['error'])
    return res
  },
  async getMessages(limit = 20) {
    const pageId = getPageId(); const token = getPageToken()
    const endpoint = `/${pageId}/conversations?fields=id,link,participants,messages{message,from,created_time}&limit=${limit}&access_token=${token}`
    return MetaClient.get<{ data: unknown[] }>(endpoint, { source: SOURCE })
  },
  async sendMessage(recipientId: string, text: string) {
    const token = getPageToken()
    MetaLogger.request(SOURCE, 'POST', '/me/messages', { recipientId, text })
    const res = await MetaClient.post<{ message_id: string }>('/me/messages', { recipient: { id: recipientId }, message: { text }, access_token: token }, { source: SOURCE })
    MetaLogger.response(SOURCE, '/me/messages', res.statusCode, res.duration, res.error as MetaApiResponse['error'])
    return res
  },
}
