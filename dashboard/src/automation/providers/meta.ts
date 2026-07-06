import {
  PublishingProvider,
  MessagingProvider,
  AnalyticsProvider,
  AIProvider,
  CRMProvider,
  OutreachProvider
} from './interfaces';
import { ProviderRegistry } from './ProviderRegistry';
import {
  ConnectedAccount,
  ScheduledPost,
  Message,
  Conversation,
  AnalyticsSnapshot,
  Lead,
  Contact,
  Broadcast
} from '../types/models';

// Facebook Provider conforming to publishing and analytics
export class FacebookProvider implements PublishingProvider, AnalyticsProvider {
  public platform = 'facebook' as const;

  async publishPost(account: ConnectedAccount, post: ScheduledPost): Promise<{ success: boolean; platformPostId?: string; error?: string }> {
    console.log(`[FacebookProvider] Mock publish initiated for account: ${account.id}, Post: ${post.id}`);
    return {
      success: true,
      platformPostId: `fb_post_mock_${Math.random().toString(36).substring(7)}`
    };
  }

  async validatePost(post: ScheduledPost): Promise<{ isValid: boolean; errors?: string[] }> {
    const errors: string[] = [];
    if (!post.content) {
      errors.push('Post content cannot be empty for Facebook Page publishing.');
    }
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  async fetchMetrics(account: ConnectedAccount, startDate: Date, endDate: Date): Promise<AnalyticsSnapshot> {
    return {
      id: `fb_snap_${account.id}`,
      connectedAccountId: account.id,
      timestamp: new Date(),
      metrics: {
        followersCount: 5200,
        reach: 12000,
        engagementRate: 0.045,
        repliesCount: 15,
        messagesCount: 40,
        growth: 0.02,
        responseTimeSeconds: 320
      }
    };
  }
}

// Instagram Provider
export class InstagramProvider implements PublishingProvider, MessagingProvider, AnalyticsProvider {
  public platform = 'instagram' as const;

  async publishPost(account: ConnectedAccount, post: ScheduledPost): Promise<{ success: boolean; platformPostId?: string; error?: string }> {
    console.log(`[InstagramProvider] Mock publish for account: ${account.id}`);
    return {
      success: true,
      platformPostId: `ig_post_mock_${Math.random().toString(36).substring(7)}`
    };
  }

  async validatePost(post: ScheduledPost): Promise<{ isValid: boolean; errors?: string[] }> {
    const errors: string[] = [];
    if (post.mediaIds.length === 0) {
      errors.push('Instagram posts require at least one visual media asset attachment.');
    }
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  async sendMessage(account: ConnectedAccount, conversation: Conversation, message: Message): Promise<{ success: boolean; platformMessageId?: string; error?: string }> {
    console.log(`[InstagramProvider] Mock DM dispatch for thread: ${conversation.id}`);
    return {
      success: true,
      platformMessageId: `ig_msg_${Math.random().toString(36).substring(7)}`
    };
  }

  async normalizeIncomingEvent(event: any): Promise<{ conversation: Partial<Conversation>; message: Partial<Message> }> {
    return {
      conversation: {
        platform: 'instagram',
        platformConversationId: event.sender_id || 'mock_ig_user'
      },
      message: {
        direction: 'inbound',
        body: event.text || '',
        timestamp: new Date(),
        messageType: 'text'
      }
    };
  }

  async fetchMetrics(account: ConnectedAccount, startDate: Date, endDate: Date): Promise<AnalyticsSnapshot> {
    return {
      id: `ig_snap_${account.id}`,
      connectedAccountId: account.id,
      timestamp: new Date(),
      metrics: {
        followersCount: 18400,
        reach: 48000,
        engagementRate: 0.068,
        repliesCount: 82,
        messagesCount: 190,
        growth: 0.05,
        responseTimeSeconds: 140
      }
    };
  }
}

// Messenger Provider
export class MessengerProvider implements MessagingProvider, AnalyticsProvider {
  public platform = 'messenger' as const;

  async sendMessage(account: ConnectedAccount, conversation: Conversation, message: Message): Promise<{ success: boolean; platformMessageId?: string; error?: string }> {
    console.log(`[MessengerProvider] Mock send message to thread: ${conversation.id}`);
    return {
      success: true,
      platformMessageId: `msg_mid_${Math.random().toString(36).substring(7)}`
    };
  }

  async normalizeIncomingEvent(event: any): Promise<{ conversation: Partial<Conversation>; message: Partial<Message> }> {
    return {
      conversation: {
        platform: 'messenger',
        platformConversationId: event.sender?.id || 'mock_messenger_user'
      },
      message: {
        direction: 'inbound',
        body: event.message?.text || '',
        timestamp: new Date(),
        messageType: 'text'
      }
    };
  }

  async fetchMetrics(account: ConnectedAccount, startDate: Date, endDate: Date): Promise<AnalyticsSnapshot> {
    return {
      id: `msg_snap_${account.id}`,
      connectedAccountId: account.id,
      timestamp: new Date(),
      metrics: {
        followersCount: 9200,
        reach: 22000,
        engagementRate: 0.038,
        repliesCount: 45,
        messagesCount: 120,
        growth: 0.015,
        responseTimeSeconds: 280
      }
    };
  }
}

// WhatsApp Cloud API Provider
export class WhatsAppCloudProvider implements MessagingProvider, AnalyticsProvider {
  public platform = 'whatsapp' as const;

  async sendMessage(account: ConnectedAccount, conversation: Conversation, message: Message): Promise<{ success: boolean; platformMessageId?: string; error?: string }> {
    console.log(`[WhatsAppCloudProvider] Mock sendMessage to WABA number: ${conversation.id}`);
    return {
      success: true,
      platformMessageId: `wamid.HBgLMTIzNDU2Nzg5OTAZAgASGBQ1RjhD...`
    };
  }

  async normalizeIncomingEvent(event: any): Promise<{ conversation: Partial<Conversation>; message: Partial<Message> }> {
    return {
      conversation: {
        platform: 'whatsapp',
        platformConversationId: event.contacts?.[0]?.wa_id || 'mock_wa_user'
      },
      message: {
        direction: 'inbound',
        body: event.messages?.[0]?.text?.body || '',
        timestamp: new Date(),
        messageType: 'text'
      }
    };
  }

  async fetchMetrics(account: ConnectedAccount, startDate: Date, endDate: Date): Promise<AnalyticsSnapshot> {
    return {
      id: `wa_snap_${account.id}`,
      connectedAccountId: account.id,
      timestamp: new Date(),
      metrics: {
        followersCount: 1420,
        reach: 8900,
        engagementRate: 0.082,
        repliesCount: 145,
        messagesCount: 520,
        growth: 0.04,
        responseTimeSeconds: 95
      }
    };
  }
}

// Auto registration hook
export function registerMetaProviders(): void {
  const registry = ProviderRegistry.getInstance();
  
  registry.registerPublishing('facebook', new FacebookProvider());
  registry.registerAnalytics('facebook', new FacebookProvider());

  registry.registerPublishing('instagram', new InstagramProvider());
  registry.registerMessaging('instagram', new InstagramProvider());
  registry.registerAnalytics('instagram', new InstagramProvider());

  registry.registerMessaging('messenger', new MessengerProvider());
  registry.registerAnalytics('messenger', new MessengerProvider());

  registry.registerMessaging('whatsapp', new WhatsAppCloudProvider());
  registry.registerAnalytics('whatsapp', new WhatsAppCloudProvider());

  console.log('[MetaProviders] Registered Facebook, Instagram, Messenger, and WhatsApp providers successfully.');
}
