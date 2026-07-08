// lib/meta/instagram-service.ts
import { MetaClient, MetaApiResponse } from './meta-client'
import { MetaLogger } from './meta-logger'
const SOURCE = 'InstagramService'
function getIgBizId() { return process.env.INSTAGRAM_BUSINESS_ID || '' }
function getPageToken() { return process.env.META_PAGE_ACCESS_TOKEN || '' }
export const InstagramService = {
  async getProfile() {
    const igId = getIgBizId(); const token = getPageToken()
    const endpoint = `/${igId}?fields=id,name,username,biography,followers_count,follows_count,media_count,profile_picture_url,website&access_token=${token}`
    MetaLogger.request(SOURCE, 'GET', endpoint)
    const res = await MetaClient.get<Record<string,unknown>>(endpoint, { source: SOURCE })
    MetaLogger.response(SOURCE, endpoint, res.statusCode, res.duration, res.error as MetaApiResponse['error'])
    return res
  },
  async getMedia(limit = 20) {
    const igId = getIgBizId(); const token = getPageToken()
    const endpoint = `/${igId}/media?fields=id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count,thumbnail_url&limit=${limit}&access_token=${token}`
    return MetaClient.get<{ data: unknown[] }>(endpoint, { source: SOURCE })
  },
  async publishPost(imageUrl: string, caption: string) {
    const igId = getIgBizId(); const token = getPageToken()
    MetaLogger.request(SOURCE, 'POST', `/${igId}/media`, { imageUrl, caption })
    const container = await MetaClient.post<{ id: string }>(`/${igId}/media`, { image_url: imageUrl, caption, access_token: token }, { source: SOURCE })
    if (!container.success || !container.data?.id) return container
    const publish = await MetaClient.post<{ id: string }>(`/${igId}/media_publish`, { creation_id: container.data.id, access_token: token }, { source: SOURCE })
    MetaLogger.response(SOURCE, `/${igId}/media_publish`, publish.statusCode, publish.duration, publish.error as MetaApiResponse['error'])
    return { ...publish, containerId: container.data.id }
  },
  async publishReel(videoUrl: string, caption: string) {
    const igId = getIgBizId(); const token = getPageToken()
    const container = await MetaClient.post<{ id: string }>(`/${igId}/media`, { video_url: videoUrl, caption, media_type: 'REELS', access_token: token }, { source: SOURCE })
    if (!container.success || !container.data?.id) return container
    return MetaClient.post<{ id: string }>(`/${igId}/media_publish`, { creation_id: container.data.id, access_token: token }, { source: SOURCE })
  },
  async getComments(mediaId: string, limit = 25) {
    const token = getPageToken()
    return MetaClient.get<{ data: unknown[] }>(`/${mediaId}/comments?fields=id,text,from,timestamp,like_count,replies{text,from,timestamp}&limit=${limit}&access_token=${token}`, { source: SOURCE })
  },
  async replyToComment(commentId: string, message: string) {
    const token = getPageToken()
    return MetaClient.post<{ id: string }>(`/${commentId}/replies`, { message, access_token: token }, { source: SOURCE })
  },
  async getMessages(limit = 20) {
    const token = getPageToken()
    return MetaClient.get<{ data: unknown[] }>(`/me/conversations?fields=id,participants,messages{message,from,created_time}&platform=instagram&limit=${limit}&access_token=${token}`, { source: SOURCE })
  },
  async sendDM(recipientId: string, text: string) {
    const token = getPageToken()
    MetaLogger.request(SOURCE, 'POST', '/me/messages', { recipientId, text })
    const res = await MetaClient.post<{ message_id: string }>('/me/messages', { recipient: { id: recipientId }, message: { text }, access_token: token }, { source: SOURCE })
    MetaLogger.response(SOURCE, '/me/messages', res.statusCode, res.duration, res.error as MetaApiResponse['error'])
    return res
  },
  async getInsights(metric = 'reach,profile_views,follower_count', period = 'day') {
    const igId = getIgBizId(); const token = getPageToken()
    const endpoint = `/${igId}/insights?metric=${metric}&period=${period}&access_token=${token}`
    return MetaClient.get<{ data: unknown[] }>(endpoint, { source: SOURCE })
  },
}
