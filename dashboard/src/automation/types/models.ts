export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: Date;
}

export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  createdAt: Date;
}

export interface Team {
  id: string;
  workspaceId: string;
  name: string;
  createdAt: Date;
}

export interface Role {
  id: string;
  name: string;
  permissions: string[];
}

export interface ConnectedAccount {
  id: string;
  workspaceId: string;
  platform: 'facebook' | 'instagram' | 'messenger' | 'whatsapp' | 'other';
  platformAccountId: string;
  name: string;
  status: 'connected' | 'disconnected' | 'expired' | 'needs_reauth';
  connectedAt: Date;
  expiresAt?: Date;
  connectionHealth?: {
    status: 'good' | 'failing' | 'dead';
    lastCheckedAt: Date;
    errorMessage?: string;
  };
  scopes?: string[];
}

export interface FacebookPage {
  id: string;
  connectedAccountId: string;
  pageId: string;
  name: string;
  accessToken: string;
}

export interface InstagramAccount {
  id: string;
  connectedAccountId: string;
  instagramId: string;
  username: string;
  name: string;
}

export interface MessengerInbox {
  id: string;
  connectedAccountId: string;
  pageId: string;
}

export interface WhatsAppAccount {
  id: string;
  connectedAccountId: string;
  phoneNumberId: string;
  wabaId: string;
  verifiedName: string;
}

// ======================================
// DOMAIN 1: BUSINESS COMMUNICATION
// ======================================

export interface Conversation {
  id: string;
  workspaceId: string;
  platform: 'instagram' | 'messenger' | 'whatsapp';
  platformConversationId: string;
  status: 'open' | 'pending' | 'closed';
  lastActivityAt: Date;
  tags: string[];
  leadStatus?: 'new' | 'nurtured' | 'proposal_sent' | 'demo_scheduled' | 'closed_won' | 'closed_lost';
  assignedUserId?: string;
  internalNotes?: string;
  aiSummary?: string;
  intent?: 'positive' | 'neutral' | 'negative' | 'spam' | 'stop';
  priority?: 'high' | 'medium' | 'low';
  readStatus?: 'read' | 'unread';
  typingIndicatorActive?: boolean;
}

export interface Message {
  id: string;
  conversationId: string;
  direction: 'inbound' | 'outbound';
  body: string;
  timestamp: Date;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  attachments: Attachment[];
  messageType: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'template' | 'interactive';
  templateId?: string;
  quickReplyPayload?: string;
}

export interface Attachment {
  id: string;
  messageId: string;
  type: 'image' | 'video' | 'audio' | 'file' | 'location';
  url: string;
  mimeType?: string;
  sizeBytes?: number;
  fileName?: string;
}

// ======================================
// LEAD MANAGEMENT (CRM)
// ======================================

export interface Contact {
  id: string;
  workspaceId: string;
  name: string;
  phone?: string;
  email?: string;
  socialHandles?: {
    instagram?: string;
    facebook?: string;
  };
  createdAt: Date;
}

export interface Company {
  id: string;
  workspaceId: string;
  name: string;
  website?: string;
  industry?: string;
  address?: string;
}

export interface Lead {
  id: string;
  workspaceId: string;
  contactId: string;
  companyId?: string;
  pipelineStageId: string;
  score: number; // 0 - 100 Lead scoring
  source: 'google_maps' | 'website_audit' | 'instagram' | 'inbound' | 'manual';
  status: 'active' | 'archived' | 'converted' | 'lost';
  estimatedValue?: number;
  createdAt: Date;
}

export interface PipelineStage {
  id: string;
  workspaceId: string;
  name: string;
  orderIndex: number;
}

export interface Opportunity {
  id: string;
  leadId: string;
  title: string;
  amount: number;
  stage: string;
  probability: number;
  expectedCloseDate?: Date;
}

export interface Activity {
  id: string;
  leadId: string;
  userId: string;
  type: 'call' | 'email' | 'meeting' | 'note' | 'system_audit';
  notes: string;
  createdAt: Date;
}

export interface Reminder {
  id: string;
  leadId: string;
  userId: string;
  title: string;
  dueAt: Date;
  completed: boolean;
}

// ======================================
// OUTREACH CAMPAIGNS
// ======================================

export interface Audience {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
}

export interface Segment {
  id: string;
  audienceId: string;
  name: string;
  filters: Record<string, any>;
}

export interface Campaign {
  id: string;
  workspaceId: string;
  name: string;
  status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed';
  channel: 'whatsapp' | 'email' | 'messenger' | 'instagram';
  templateId?: string;
  segmentId?: string;
  rateLimitPerMinute: number;
  createdAt: Date;
}

export interface Sequence {
  id: string;
  campaignId: string;
  name: string;
  steps: SequenceStep[];
}

export interface SequenceStep {
  id: string;
  sequenceId: string;
  stepIndex: number;
  delayHours: number;
  templateId: string;
}

export interface Broadcast {
  id: string;
  campaignId: string;
  recipientId: string;
  status: 'pending' | 'sending' | 'sent' | 'failed' | 'read';
  errorDetails?: string;
  sentAt?: Date;
}

// ======================================
// WORKFLOW ENGINE (n8n Jobs)
// ======================================

export interface AutomationJob {
  id: string;
  workspaceId: string;
  workflowId: string;
  jobType: 'publish_content' | 'reply_conversation' | 'generate_caption' | 'extract_lead' | 'sync_analytics';
  payload: Record<string, any>;
  status: 'created' | 'sent_to_n8n' | 'executing' | 'succeeded' | 'failed' | 'retrying';
  retryPolicy?: RetryPolicy;
  createdAt: Date;
}

export interface WorkflowTrigger {
  id: string;
  workflowId: string;
  triggerType: 'webhook' | 'event' | 'schedule';
  triggerConfig: Record<string, any>;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  executionId: string; // n8n execution ID
  status: 'success' | 'running' | 'error' | 'aborted';
  startedAt: Date;
  finishedAt?: Date;
  logs?: string;
}

export interface RetryPolicy {
  maxAttempts: number;
  currentAttempt: number;
  backoffFactorMs: number;
}

export interface JobResult {
  jobId: string;
  status: 'success' | 'error';
  outputData?: Record<string, any>;
  errorMessage?: string;
}

// ======================================
// GENERAL SUPPORTING MODELS
// ======================================

export interface MediaAsset {
  id: string;
  workspaceId: string;
  name: string;
  type: 'image' | 'video' | 'document';
  url: string;
  sizeBytes: number;
  folderId?: string;
  createdAt: Date;
}

export interface ScheduledPost {
  id: string;
  workspaceId: string;
  campaignId?: string;
  content: string;
  platforms: ('facebook' | 'instagram')[];
  mediaIds: string[];
  scheduledAt: Date;
  status: 'draft' | 'pending_approval' | 'approved' | 'publishing' | 'published' | 'failed';
  errorMessage?: string;
  createdAt: Date;
}

export interface PostHistory {
  id: string;
  scheduledPostId?: string;
  workspaceId: string;
  platform: 'facebook' | 'instagram';
  platformPostId?: string;
  content: string;
  publishedAt: Date;
  status: 'success' | 'failed';
  errorDetails?: string;
}

export interface WebhookSubscription {
  id: string;
  platform: 'facebook' | 'instagram' | 'messenger' | 'whatsapp';
  callbackUrl: string;
  verifyToken: string;
  events: string[];
  isActive: boolean;
}

export interface OAuthToken {
  id: string;
  connectedAccountId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}

export interface Permission {
  id: string;
  roleId: string;
  action: string;
  resource: string;
}

export interface AnalyticsSnapshot {
  id: string;
  connectedAccountId: string;
  timestamp: Date;
  metrics: {
    followersCount: number;
    reach: number;
    engagementRate: number;
    repliesCount: number;
    messagesCount: number;
    growth: number;
    responseTimeSeconds: number;
    leadConversionRate?: number;
    publishingSuccessRate?: number;
  };
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
}

export interface AuditLog {
  id: string;
  workspaceId: string;
  userId: string;
  action: string;
  details: string;
  ipAddress?: string;
  createdAt: Date;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface Folder {
  id: string;
  workspaceId: string;
  name: string;
  parentId?: string;
}

export interface Draft {
  id: string;
  workspaceId: string;
  content: string;
  mediaIds: string[];
  updatedAt: Date;
}

export interface Approval {
  id: string;
  scheduledPostId: string;
  approverId: string;
  status: 'pending' | 'approved' | 'rejected';
  feedback?: string;
  decidedAt?: Date;
}
