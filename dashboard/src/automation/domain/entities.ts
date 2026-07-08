import {
  ConversationState,
  CampaignState,
  PublishJobState,
  AutomationJobState,
  isValidConversationTransition,
  isValidCampaignTransition,
  isValidPublishJobTransition,
  isValidAutomationJobTransition
} from '../types/states';
import {
  User,
  Workspace,
  ConnectedAccount,
  Conversation as IConversation,
  Message as IMessage,
  Lead as ILead,
  Contact as IContact,
  Company as ICompany,
  Campaign as ICampaign,
  Sequence as ISequence,
  MediaAsset as IMediaAsset,
  AutomationJob as IAutomationJob,
  ScheduledPost,
  Attachment,
  RetryPolicy
} from '../types/models';

export class DomainWorkspace implements Workspace {
  constructor(
    public id: string,
    public name: string,
    public ownerId: string,
    public createdAt: Date
  ) {}

  public rename(newName: string) {
    if (!newName.trim()) {
      throw new Error('Workspace name cannot be empty');
    }
    this.name = newName;
  }
}

export class DomainConversation implements IConversation {
  public status: 'open' | 'pending' | 'closed' = 'open';
  constructor(
    public id: string,
    public workspaceId: string,
    public platform: 'instagram' | 'messenger' | 'whatsapp',
    public platformConversationId: string,
    public lastActivityAt: Date,
    public tags: string[],
    public state: ConversationState = ConversationState.Open,
    public leadStatus?: 'new' | 'nurtured' | 'proposal_sent' | 'demo_scheduled' | 'closed_won' | 'closed_lost',
    public assignedUserId?: string,
    public internalNotes?: string,
    public aiSummary?: string,
    public intent?: 'positive' | 'neutral' | 'negative' | 'spam' | 'stop',
    public priority?: 'high' | 'medium' | 'low',
    public readStatus: 'read' | 'unread' = 'unread'
  ) {}

  public transitionTo(nextState: ConversationState) {
    if (!isValidConversationTransition(this.state, nextState)) {
      throw new Error(`Invalid conversation state transition from ${this.state} to ${nextState}`);
    }
    this.state = nextState;
    if (nextState === ConversationState.Resolved || nextState === ConversationState.Archived) {
      this.status = 'closed';
    } else {
      this.status = 'open';
    }
  }

  public assignUser(userId: string) {
    this.assignedUserId = userId;
    this.transitionTo(ConversationState.PendingHuman);
  }
}

export class DomainMessage implements IMessage {
  constructor(
    public id: string,
    public conversationId: string,
    public direction: 'inbound' | 'outbound',
    public body: string,
    public timestamp: Date,
    public status: 'sent' | 'delivered' | 'read' | 'failed',
    public attachments: Attachment[],
    public messageType: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'template' | 'interactive',
    public templateId?: string,
    public quickReplyPayload?: string
  ) {}

  public markAsRead() {
    this.status = 'read';
  }
}

export class DomainContact implements IContact {
  constructor(
    public id: string,
    public workspaceId: string,
    public name: string,
    public phone?: string,
    public email?: string,
    public socialHandles?: {
      instagram?: string;
      facebook?: string;
    },
    public createdAt: Date = new Date()
  ) {}

  public validate(): boolean {
    if (!this.name.trim()) return false;
    if (this.email && !this.email.includes('@')) return false;
    return true;
  }
}

export class DomainCompany implements ICompany {
  constructor(
    public id: string,
    public workspaceId: string,
    public name: string,
    public website?: string,
    public industry?: string,
    public address?: string
  ) {}
}

export class DomainLead implements ILead {
  constructor(
    public id: string,
    public workspaceId: string,
    public contactId: string,
    public pipelineStageId: string,
    public score: number,
    public source: 'google_maps' | 'website_audit' | 'instagram' | 'inbound' | 'manual',
    public status: 'active' | 'archived' | 'converted' | 'lost',
    public createdAt: Date,
    public companyId?: string,
    public estimatedValue?: number
  ) {}

  public recalculateScore(metrics: { websiteLoadLatency?: number; hasSsl?: boolean; hasGmapsRating?: boolean }) {
    let baseScore = 50;
    if (metrics.websiteLoadLatency && metrics.websiteLoadLatency > 4) baseScore += 15;
    if (metrics.hasSsl === false) baseScore += 20;
    if (metrics.hasGmapsRating === false) baseScore += 15;
    this.score = Math.min(100, Math.max(0, baseScore));
  }
}

export class DomainCampaign implements ICampaign {
  constructor(
    public id: string,
    public workspaceId: string,
    public name: string,
    public status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed',
    public channel: 'whatsapp' | 'email' | 'messenger' | 'instagram',
    public rateLimitPerMinute: number,
    public createdAt: Date,
    public campaignState: CampaignState = CampaignState.Draft,
    public templateId?: string,
    public segmentId?: string
  ) {}

  public transitionTo(nextState: CampaignState) {
    if (!isValidCampaignTransition(this.campaignState, nextState)) {
      throw new Error(`Invalid campaign state transition from ${this.campaignState} to ${nextState}`);
    }
    this.campaignState = nextState;
    switch (nextState) {
      case CampaignState.Draft:
        this.status = 'draft';
        break;
      case CampaignState.Scheduled:
        this.status = 'scheduled';
        break;
      case CampaignState.Running:
        this.status = 'running';
        break;
      case CampaignState.Paused:
        this.status = 'paused';
        break;
      case CampaignState.Completed:
        this.status = 'completed';
        break;
      case CampaignState.Cancelled:
        this.status = 'paused';
        break;
    }
  }
}

export class DomainSequence implements ISequence {
  constructor(
    public id: string,
    public campaignId: string,
    public name: string,
    public steps: any[]
  ) {}

  public addStep(step: { id: string; sequenceId: string; stepIndex: number; delayHours: number; templateId: string }) {
    if (step.delayHours < 0) {
      throw new Error('Step delay cannot be negative');
    }
    this.steps.push(step);
    this.steps.sort((a, b) => a.stepIndex - b.stepIndex);
  }
}

export class DomainMediaAsset implements IMediaAsset {
  constructor(
    public id: string,
    public workspaceId: string,
    public name: string,
    public type: 'image' | 'video' | 'document',
    public url: string,
    public sizeBytes: number,
    public createdAt: Date,
    public folderId?: string,
    public checksum?: string,
    public mimeType?: string,
    public dimensions?: { width: number; height: number },
    public durationSeconds?: number,
    public status: 'processing' | 'ready' | 'failed' = 'ready'
  ) {}
}

export class DomainPublishJob {
  constructor(
    public id: string,
    public workspaceId: string,
    public scheduledPost: ScheduledPost,
    public state: PublishJobState = PublishJobState.Draft,
    public retryPolicy?: RetryPolicy
  ) {}

  public transitionTo(nextState: PublishJobState) {
    if (!isValidPublishJobTransition(this.state, nextState)) {
      throw new Error(`Invalid publish job state transition from ${this.state} to ${nextState}`);
    }
    this.state = nextState;
  }
}

export class DomainAutomationJob implements IAutomationJob {
  constructor(
    public id: string,
    public workspaceId: string,
    public workflowId: string,
    public jobType: 'publish_content' | 'reply_conversation' | 'generate_caption' | 'extract_lead' | 'sync_analytics',
    public payload: Record<string, any>,
    public status: 'created' | 'sent_to_n8n' | 'executing' | 'succeeded' | 'failed' | 'retrying',
    public createdAt: Date,
    public state: AutomationJobState = AutomationJobState.Queued,
    public retryPolicy?: RetryPolicy
  ) {}

  public transitionTo(nextState: AutomationJobState) {
    if (!isValidAutomationJobTransition(this.state, nextState)) {
      throw new Error(`Invalid automation job state transition from ${this.state} to ${nextState}`);
    }
    this.state = nextState;
    switch (nextState) {
      case AutomationJobState.Queued:
        this.status = 'created';
        break;
      case AutomationJobState.Running:
        this.status = 'executing';
        break;
      case AutomationJobState.Completed:
        this.status = 'succeeded';
        break;
      case AutomationJobState.Failed:
        this.status = 'failed';
        break;
      case AutomationJobState.Retrying:
        this.status = 'retrying';
        break;
    }
  }
}
export class DomainWorkflow {
  constructor(
    public id: string,
    public workspaceId: string,
    public name: string,
    public isActive: boolean,
    public triggerType: 'webhook' | 'event' | 'schedule',
    public createdAt: Date
  ) {}
}
export class DomainAnalyticsSnapshot {
  constructor(
    public id: string,
    public connectedAccountId: string,
    public timestamp: Date,
    public metrics: {
      followersCount: number;
      reach: number;
      engagementRate: number;
      repliesCount: number;
      messagesCount: number;
      growth: number;
      responseTimeSeconds: number;
      leadConversionRate?: number;
      publishingSuccessRate?: number;
    }
  ) {}
}
export class DomainNotification {
  constructor(
    public id: string,
    public userId: string,
    public title: string,
    public message: string,
    public read: boolean,
    public createdAt: Date
  ) {}
}
export class DomainAuditLog {
  constructor(
    public id: string,
    public workspaceId: string,
    public userId: string,
    public action: string,
    public details: string,
    public createdAt: Date,
    public ipAddress?: string
  ) {}
}
export class DomainPermission {
  constructor(
    public id: string,
    public roleId: string,
    public action: string,
    public resource: string
  ) {}
}
