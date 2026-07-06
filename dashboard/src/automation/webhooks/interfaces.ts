export interface WebhookEvent<T = any> {
  id: string;
  platform: 'facebook' | 'instagram' | 'messenger' | 'whatsapp';
  eventType: string;
  timestamp: Date;
  payload: T;
}

export interface WebhookSubscription {
  id: string;
  workspaceId: string;
  platform: 'facebook' | 'instagram' | 'messenger' | 'whatsapp';
  targetUrl: string;
  secret: string;
  subscribedEvents: string[];
  isActive: boolean;
}

export interface WebhookSignature {
  algorithm: string;
  signatureHeader: string;
}

export interface WebhookDelivery {
  id: string;
  subscriptionId: string;
  payload: Record<string, any>;
  dispatchedAt: Date;
  statusCode?: number;
  responseBody?: string;
  success: boolean;
}

export interface WebhookRetry {
  deliveryId: string;
  attemptNumber: number;
  scheduledAt: Date;
  maxAttempts: number;
}

export interface WebhookVerification {
  verifyToken: string;
  hubChallenge: string;
  mode: 'subscribe' | 'unsubscribe';
}

export interface WebhookProcessor {
  validateVerification(challenge: WebhookVerification): Promise<string>;
  validatePayloadSignature(rawBody: string, signature: string, secret: string): Promise<boolean>;
  dispatchWebhookDelivery(delivery: WebhookDelivery): Promise<WebhookDelivery>;
}
export class WebhookValidationService implements WebhookProcessor {
  async validateVerification(challenge: WebhookVerification): Promise<string> {
    if (challenge.mode === 'subscribe') {
      return challenge.hubChallenge;
    }
    throw new Error('Unsupported mode');
  }

  async validatePayloadSignature(rawBody: string, signature: string, secret: string): Promise<boolean> {
    // Stub validation logic
    return !!signature && !!secret;
  }

  async dispatchWebhookDelivery(delivery: WebhookDelivery): Promise<WebhookDelivery> {
    return {
      ...delivery,
      statusCode: 200,
      responseBody: '{"success":true}',
      success: true
    };
  }
}
