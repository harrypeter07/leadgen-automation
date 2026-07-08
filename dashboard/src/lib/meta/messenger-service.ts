// lib/meta/messenger-service.ts
import { MetaClient, MetaApiResponse } from './meta-client'
import { MetaLogger } from './meta-logger'
const SOURCE = 'MessengerService'
function getPageToken() { return process.env.META_PAGE_ACCESS_TOKEN || '' }
function getPageId() { return process.env.META_PAGE_ID || '' }
export const MessengerService = {
  async sendText(recipientId: string, text: string) {
    const token = getPageToken()
    MetaLogger.request(SOURCE, 'POST', '/me/messages', { recipientId, text })
    const res = await MetaClient.post<{ message_id: string; recipient_id: string }>('/me/messages', { recipient: { id: recipientId }, message: { text }, access_token: token }, { source: SOURCE })
    MetaLogger.response(SOURCE, '/me/messages', res.statusCode, res.duration, res.error as MetaApiResponse['error'])
    return res
  },
  async sendQuickReplies(recipientId: string, text: string, quickReplies: Array<{ title: string; payload: string }>) {
    const token = getPageToken()
    return MetaClient.post<{ message_id: string }>('/me/messages', { recipient: { id: recipientId }, message: { text, quick_replies: quickReplies.map(qr => ({ content_type: 'text', title: qr.title, payload: qr.payload })) }, access_token: token }, { source: SOURCE })
  },
  async getUserProfile(psid: string) {
    const token = getPageToken()
    const endpoint = `/${psid}?fields=first_name,last_name,profile_pic,locale,timezone,gender&access_token=${token}`
    MetaLogger.request(SOURCE, 'GET', endpoint)
    const res = await MetaClient.get<Record<string, unknown>>(endpoint, { source: SOURCE })
    MetaLogger.response(SOURCE, endpoint, res.statusCode, res.duration, res.error as MetaApiResponse['error'])
    return res
  },
  async getConversations(limit = 20) {
    const pageId = getPageId(); const token = getPageToken()
    const endpoint = `/${pageId}/conversations?fields=id,link,participants,messages{message,from,created_time}&limit=${limit}&access_token=${token}`
    return MetaClient.get<{ data: unknown[] }>(endpoint, { source: SOURCE })
  },
  async getSubscribedApps() {
    const pageId = getPageId(); const token = getPageToken()
    return MetaClient.get<{ data: unknown[] }>(`/${pageId}/subscribed_apps?access_token=${token}`, { source: SOURCE })
  },
  async subscribePage(subscriptionFields = ['messages', 'messaging_postbacks', 'messaging_optins', 'message_deliveries']) {
    const pageId = getPageId(); const token = getPageToken()
    return MetaClient.post<{ success: boolean }>(`/${pageId}/subscribed_apps`, { subscribed_fields: subscriptionFields, access_token: token }, { source: SOURCE })
  },
}
