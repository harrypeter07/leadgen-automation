export enum ConversationState {
  Open = 'OPEN',
  PendingAI = 'PENDING_AI',
  PendingHuman = 'PENDING_HUMAN',
  Resolved = 'RESOLVED',
  Archived = 'ARCHIVED',
  Spam = 'SPAM'
}

export enum CampaignState {
  Draft = 'DRAFT',
  Scheduled = 'SCHEDULED',
  Running = 'RUNNING',
  Paused = 'PAUSED',
  Completed = 'COMPLETED',
  Cancelled = 'CANCELLED'
}

export enum PublishJobState {
  Draft = 'DRAFT',
  Queued = 'QUEUED',
  Processing = 'PROCESSING',
  Published = 'PUBLISHED',
  Failed = 'FAILED',
  Retrying = 'RETRYING'
}

export enum AutomationJobState {
  Queued = 'QUEUED',
  Running = 'RUNNING',
  Completed = 'COMPLETED',
  Failed = 'FAILED',
  Retrying = 'RETRYING'
}

export enum RoleType {
  Owner = 'OWNER',
  Admin = 'ADMIN',
  Manager = 'MANAGER',
  Support = 'SUPPORT',
  ContentCreator = 'CONTENT_CREATOR',
  Viewer = 'VIEWER'
}

export enum PermissionType {
  ReadInbox = 'read:inbox',
  WriteInbox = 'write:inbox',
  ReadCRM = 'read:crm',
  WriteCRM = 'write:crm',
  PublishContent = 'publish:content',
  ConfigureIntegrations = 'configure:integrations',
  ManageBilling = 'manage:billing',
  ReadAudit = 'read:audit'
}

// State Machine transition rules
export function isValidConversationTransition(current: ConversationState, next: ConversationState): boolean {
  const allowed: Record<ConversationState, ConversationState[]> = {
    [ConversationState.Open]: [ConversationState.PendingAI, ConversationState.PendingHuman, ConversationState.Resolved, ConversationState.Archived, ConversationState.Spam],
    [ConversationState.PendingAI]: [ConversationState.PendingHuman, ConversationState.Resolved, ConversationState.Open],
    [ConversationState.PendingHuman]: [ConversationState.Resolved, ConversationState.Open, ConversationState.PendingAI],
    [ConversationState.Resolved]: [ConversationState.Open, ConversationState.Archived],
    [ConversationState.Archived]: [ConversationState.Open],
    [ConversationState.Spam]: [ConversationState.Open]
  };
  return allowed[current]?.includes(next) ?? false;
}

export function isValidCampaignTransition(current: CampaignState, next: CampaignState): boolean {
  const allowed: Record<CampaignState, CampaignState[]> = {
    [CampaignState.Draft]: [CampaignState.Scheduled, CampaignState.Cancelled],
    [CampaignState.Scheduled]: [CampaignState.Running, CampaignState.Cancelled, CampaignState.Paused],
    [CampaignState.Running]: [CampaignState.Paused, CampaignState.Completed, CampaignState.Cancelled],
    [CampaignState.Paused]: [CampaignState.Running, CampaignState.Cancelled],
    [CampaignState.Completed]: [],
    [CampaignState.Cancelled]: []
  };
  return allowed[current]?.includes(next) ?? false;
}

export function isValidPublishJobTransition(current: PublishJobState, next: PublishJobState): boolean {
  const allowed: Record<PublishJobState, PublishJobState[]> = {
    [PublishJobState.Draft]: [PublishJobState.Queued],
    [PublishJobState.Queued]: [PublishJobState.Processing, PublishJobState.Failed],
    [PublishJobState.Processing]: [PublishJobState.Published, PublishJobState.Failed, PublishJobState.Retrying],
    [PublishJobState.Retrying]: [PublishJobState.Processing, PublishJobState.Failed],
    [PublishJobState.Published]: [],
    [PublishJobState.Failed]: [PublishJobState.Queued]
  };
  return allowed[current]?.includes(next) ?? false;
}

export function isValidAutomationJobTransition(current: AutomationJobState, next: AutomationJobState): boolean {
  const allowed: Record<AutomationJobState, AutomationJobState[]> = {
    [AutomationJobState.Queued]: [AutomationJobState.Running, AutomationJobState.Failed],
    [AutomationJobState.Running]: [AutomationJobState.Completed, AutomationJobState.Failed, AutomationJobState.Retrying],
    [AutomationJobState.Retrying]: [AutomationJobState.Running, AutomationJobState.Failed],
    [AutomationJobState.Completed]: [],
    [AutomationJobState.Failed]: [AutomationJobState.Queued]
  };
  return allowed[current]?.includes(next) ?? false;
}
