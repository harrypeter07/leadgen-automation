import {
  ConnectedAccount,
  ScheduledPost,
  Message,
  Conversation,
  AnalyticsSnapshot,
  MediaAsset,
  Lead,
  Contact,
  Broadcast
} from '../types/models';

export interface PublishingProvider {
  platform: 'facebook' | 'instagram';
  publishPost(account: ConnectedAccount, post: ScheduledPost): Promise<{ success: boolean; platformPostId?: string; error?: string }>;
  validatePost(post: ScheduledPost): Promise<{ isValid: boolean; errors?: string[] }>;
}

export interface MessagingProvider {
  platform: 'instagram' | 'messenger' | 'whatsapp';
  sendMessage(account: ConnectedAccount, conversation: Conversation, message: Message): Promise<{ success: boolean; platformMessageId?: string; error?: string }>;
  normalizeIncomingEvent(event: any): Promise<{ conversation: Partial<Conversation>; message: Partial<Message> }>;
}

export interface AnalyticsProvider {
  platform: 'facebook' | 'instagram' | 'messenger' | 'whatsapp';
  fetchMetrics(account: ConnectedAccount, startDate: Date, endDate: Date): Promise<AnalyticsSnapshot>;
}

export interface WebhookProvider {
  verifySignature(signature: string, rawBody: string, secret: string): boolean;
  processWebhookEvent(payload: any): Promise<{ eventType: string; data: any }>;
}

export interface OAuthProvider {
  getAuthUrl(redirectUri: string, scopes: string[]): string;
  exchangeCodeForTokens(code: string, redirectUri: string): Promise<{ accessToken: string; refreshToken?: string; expiresAt?: Date }>;
  refreshTokens(refreshToken: string): Promise<{ accessToken: string; refreshToken?: string; expiresAt?: Date }>;
}

export interface MediaProvider {
  processMedia(asset: MediaAsset, targetPlatform: 'facebook' | 'instagram'): Promise<{ processedUrl: string; sizeBytes: number; format: string }>;
}

export interface AIProvider {
  generateText(prompt: string, systemInstructions?: string): Promise<string>;
  analyzeIntent(text: string): Promise<{ intent: 'positive' | 'neutral' | 'negative' | 'spam' | 'stop'; confidence: number }>;
  extractEntities(text: string): Promise<Record<string, string>>;
  extractLeadDetails(text: string): Promise<Partial<Contact> & { budget?: number; timeline?: string }>;
  summarizeConversation(messages: Message[]): Promise<string>;
  analyzeSentiment(text: string): Promise<'positive' | 'neutral' | 'negative'>;
  translateText(text: string, targetLanguage: string): Promise<string>;
  checkSpam(text: string): Promise<boolean>;
  retrieveKnowledgeBase(query: string): Promise<{ answer: string; sourceUrls: string[] }>;
  recommendAction(conversationId: string): Promise<{ actionType: string; confidence: number; reason: string }>;
}

export interface StorageProvider {
  uploadFile(file: any, path: string): Promise<string>;
  deleteFile(path: string): Promise<void>;
  getSignedUrl(path: string, expiresSeconds: number): Promise<string>;
}

export interface NotificationProvider {
  sendSystemNotification(userId: string, title: string, body: string): Promise<void>;
  sendEmailNotification(email: string, subject: string, bodyHtml: string): Promise<void>;
}

export interface CRMProvider {
  syncLead(lead: Lead): Promise<{ externalId: string; status: string }>;
  syncContact(contact: Contact): Promise<{ externalId: string }>;
}

export interface OutreachProvider {
  sendBroadcast(broadcast: Broadcast, token: string): Promise<{ success: boolean; platformId?: string; error?: string }>;
}
