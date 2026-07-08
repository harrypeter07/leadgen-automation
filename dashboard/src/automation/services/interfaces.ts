import {
  ConnectedAccount,
  ScheduledPost,
  Conversation,
  Message,
  MediaAsset,
  AnalyticsSnapshot,
  User,
  AuditLog,
  Notification,
  Lead,
  Contact,
  Campaign,
  Sequence,
  AutomationJob,
  WorkflowExecution
} from '../types/models';

export interface OAuthService {
  getAuthorizationUrl(platform: string, workspaceId: string): Promise<string>;
  handleCallback(platform: string, code: string, state: string): Promise<ConnectedAccount>;
}

export interface TokenService {
  getValidAccessToken(accountId: string): Promise<string>;
  revokeTokens(accountId: string): Promise<void>;
}

export interface PublishingService {
  publishNow(postId: string): Promise<{ success: boolean; error?: string }>;
  validatePostContent(post: ScheduledPost): Promise<{ valid: boolean; errors: string[] }>;
}

export interface SchedulingService {
  schedulePost(post: ScheduledPost): Promise<ScheduledPost>;
  unschedulePost(postId: string): Promise<void>;
  listScheduledPosts(workspaceId: string): Promise<ScheduledPost[]>;
}

export interface ConversationService {
  sendMessage(message: Message): Promise<Message>;
  getConversationMessages(conversationId: string): Promise<Message[]>;
  listConversations(workspaceId: string): Promise<Conversation[]>;
  updateConversationMetadata(conversationId: string, metadata: Partial<Conversation>): Promise<Conversation>;
  assignUser(conversationId: string, userId: string): Promise<void>;
  archiveConversation(conversationId: string): Promise<void>;
  closeConversation(conversationId: string): Promise<void>;
  logInternalNote(conversationId: string, note: string): Promise<void>;
}

export interface MessageExtractionService {
  extractMetadata(rawMessage: any): Promise<Record<string, any>>;
}

export interface MediaService {
  uploadAsset(workspaceId: string, file: any): Promise<MediaAsset>;
  optimizeAsset(assetId: string, platform: string): Promise<MediaAsset>;
}

export interface AnalyticsService {
  getAnalyticsSnapshot(accountId: string): Promise<AnalyticsSnapshot>;
  exportReport(accountId: string, format: 'csv' | 'pdf'): Promise<string>;
}

export interface InsightsService {
  generatePerformanceInsights(accountId: string): Promise<{ recommendation: string; metricImpact: string }>;
}

export interface WebhookService {
  receiveEvent(platform: string, signature: string, payload: any): Promise<void>;
  registerWebhook(platform: string, url: string): Promise<void>;
}

export interface PermissionService {
  checkUserPermission(user: User, action: string, resource: string): Promise<boolean>;
  grantPermission(roleId: string, permission: any): Promise<void>;
}

export interface AccountConnectionService {
  connectAccount(workspaceId: string, platform: string, authData: any): Promise<ConnectedAccount>;
  disconnectAccount(accountId: string): Promise<void>;
}

export interface ContentGenerationService {
  generateCaption(prompt: string, tone: string): Promise<string>;
  generateReplySuggestion(conversationId: string): Promise<string>;
}

export interface ApprovalWorkflowService {
  submitForApproval(postId: string, approverIds: string[]): Promise<void>;
  approvePost(postId: string, userId: string, feedback?: string): Promise<void>;
  rejectPost(postId: string, userId: string, feedback: string): Promise<void>;
}

export interface NotificationService {
  notifyUser(userId: string, notification: Partial<Notification>): Promise<void>;
  broadcastToWorkspace(workspaceId: string, notification: Partial<Notification>): Promise<void>;
}

export interface AuditService {
  logAction(log: Partial<AuditLog>): Promise<void>;
  getLogs(workspaceId: string): Promise<AuditLog[]>;
}

// ======================================
// CRM & LEAD MANAGEMENT SERVICES
// ======================================

export interface CRMService {
  createLead(lead: Partial<Lead>): Promise<Lead>;
  updateLeadStage(leadId: string, stageId: string): Promise<Lead>;
  getLeadTimeline(leadId: string): Promise<any[]>;
  assignLead(leadId: string, userId: string): Promise<void>;
  addLeadNote(leadId: string, note: string): Promise<void>;
  scoreLead(leadId: string): Promise<number>;
  searchLeads(workspaceId: string, query: string): Promise<Lead[]>;
}

// ======================================
// OUTREACH CAMPAIGN SERVICES
// ======================================

export interface CampaignService {
  createCampaign(campaign: Partial<Campaign>): Promise<Campaign>;
  startCampaign(campaignId: string): Promise<void>;
  pauseCampaign(campaignId: string): Promise<void>;
  getCampaignAnalytics(campaignId: string): Promise<any>;
}

export interface SequenceService {
  createSequence(sequence: Partial<Sequence>): Promise<Sequence>;
  triggerSequenceForContact(sequenceId: string, contactId: string): Promise<void>;
}

// ======================================
// WORKFLOW JOB & n8n CONNECTOR SERVICES
// ======================================

export interface JobQueueService {
  createJob(job: Partial<AutomationJob>): Promise<AutomationJob>;
  processJob(jobId: string): Promise<void>;
  getJobStatus(jobId: string): Promise<AutomationJob>;
  listJobs(workspaceId: string): Promise<AutomationJob[]>;
}

export interface n8nConnectorService {
  sendPayloadToWorkflow(webhookUrl: string, payload: any): Promise<{ success: boolean; executionId?: string }>;
  fetchExecutionLogs(executionId: string): Promise<WorkflowExecution>;
}
export class MockOAuthService implements OAuthService {
  async getAuthorizationUrl(platform: string, workspaceId: string): Promise<string> {
    return `https://mock-auth.com/${platform}?state=${workspaceId}`;
  }
  async handleCallback(platform: string, code: string, state: string): Promise<ConnectedAccount> {
    return {
      id: 'mock-acc-123',
      workspaceId: state,
      platform: platform as any,
      platformAccountId: 'mock-platform-id',
      name: `Mock ${platform} Page`,
      status: 'connected',
      connectedAt: new Date()
    };
  }
}
