// lib/meta/instagram-service.ts
import { MetaClient, MetaApiResponse } from './meta-client'
import { MetaLogger } from './meta-logger'
import { ensureMetaConfig } from './runtime-config'

const SOURCE = 'InstagramService'

async function getIgBizId() { 
  await ensureMetaConfig()
  return process.env.INSTAGRAM_BUSINESS_ID || '' 
}

async function getPageToken() { 
  await ensureMetaConfig()
  return process.env.META_PAGE_ACCESS_TOKEN || '' 
}

export const InstagramService = {
  async getProfile() {
    const igId = await getIgBizId(); const token = await getPageToken()
    const endpoint = `/${igId}?fields=id,name,username,biography,followers_count,follows_count,media_count,profile_picture_url,website&access_token=${token}`
    MetaLogger.request(SOURCE, 'GET', endpoint)
    const res = await MetaClient.get<Record<string,unknown>>(endpoint, { source: SOURCE })
    MetaLogger.response(SOURCE, endpoint, res.statusCode, res.duration, res.error as MetaApiResponse['error'])
    return res
  },
  async getMedia(limit = 20) {
    const igId = await getIgBizId(); const token = await getPageToken()
    const endpoint = `/${igId}/media?fields=id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count,thumbnail_url&limit=${limit}&access_token=${token}`
    return MetaClient.get<{ data: unknown[] }>(endpoint, { source: SOURCE })
  },
  async publishPost(imageUrl: string, caption: string) {
    const igId = await getIgBizId(); const token = await getPageToken()
    MetaLogger.request(SOURCE, 'POST', `/${igId}/media`, { imageUrl, caption })
    const container = await MetaClient.post<{ id: string }>(`/${igId}/media`, { image_url: imageUrl, caption, access_token: token }, { source: SOURCE })
    if (!container.success || !container.data?.id) return container
    const publish = await MetaClient.post<{ id: string }>(`/${igId}/media_publish`, { creation_id: container.data.id, access_token: token }, { source: SOURCE })
    MetaLogger.response(SOURCE, `/${igId}/media_publish`, publish.statusCode, publish.duration, publish.error as MetaApiResponse['error'])
    return { ...publish, containerId: container.data.id }
  },
  async publishReel(videoUrl: string, caption: string) {
    const igId = await getIgBizId(); const token = await getPageToken()
    const container = await MetaClient.post<{ id: string }>(`/${igId}/media`, { video_url: videoUrl, caption, media_type: 'REELS', access_token: token }, { source: SOURCE })
    if (!container.success || !container.data?.id) return container
    return MetaClient.post<{ id: string }>(`/${igId}/media_publish`, { creation_id: container.data.id, access_token: token }, { source: SOURCE })
  },
  async getComments(mediaId: string, limit = 25) {
    const token = await getPageToken()
    return MetaClient.get<{ data: unknown[] }>(`/${mediaId}/comments?fields=id,text,from,timestamp,like_count,replies{text,from,timestamp}&limit=${limit}&access_token=${token}`, { source: SOURCE })
  },
  async replyToComment(commentId: string, message: string) {
    const token = await getPageToken()
    return MetaClient.post<{ id: string }>(`/${commentId}/replies`, { message, access_token: token }, { source: SOURCE })
  },
  async getMessages(limit = 20) {
    const igId = await getIgBizId(); const token = await getPageToken()
    return MetaClient.get<{ data: unknown[] }>(`/${igId}/conversations?platform=instagram&fields=id,participants,messages{message,from,created_time}&limit=${limit}&access_token=${token}`, { source: SOURCE })
  },
  async sendDM(recipientId: string, text: string) {
    const igId = await getIgBizId(); const token = await getPageToken()
    MetaLogger.request(SOURCE, 'POST', `/${igId}/messages`, { recipientId, text })
    const res = await MetaClient.post<{ message_id: string }>(`/${igId}/messages`, { recipient: { id: recipientId }, message: { text }, access_token: token }, { source: SOURCE })
    MetaLogger.response(SOURCE, `/${igId}/messages`, res.statusCode, res.duration, res.error as MetaApiResponse['error'])
    return res
  },
  async getInsights(metric = 'reach,profile_views,follower_count', period = 'day') {
    const igId = await getIgBizId(); const token = await getPageToken()
    const endpoint = `/${igId}/insights?metric=${metric}&period=${period}&access_token=${token}`
    return MetaClient.get<{ data: unknown[] }>(endpoint, { source: SOURCE })
  },
}
