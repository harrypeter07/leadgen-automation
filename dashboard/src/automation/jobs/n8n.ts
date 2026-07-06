import { AutomationJob, RetryPolicy, JobResult } from '../types/models';

export interface n8nJobDispatcher {
  dispatchJob(job: AutomationJob, n8nWebhookUrl: string): Promise<{ success: boolean; externalExecutionId?: string; error?: string }>;
  handleJobResult(result: JobResult): Promise<void>;
}

export class n8nWorkflowJobManager implements n8nJobDispatcher {
  private activeJobs: Map<string, AutomationJob> = new Map();

  async dispatchJob(job: AutomationJob, n8nWebhookUrl: string): Promise<{ success: boolean; externalExecutionId?: string; error?: string }> {
    console.log(`[n8nJobManager] Dispatching payload for job: ${job.id} (Type: ${job.jobType}) to URL: ${n8nWebhookUrl}`);
    
    // Validate Job Payloads before sending
    try {
      this.validateJobPayload(job);
    } catch (e: any) {
      return { success: false, error: `Payload validation failed: ${e.message}` };
    }

    // In a real integration, this sends an HTTP POST request to the n8n webhook URL
    // e.g., await fetch(n8nWebhookUrl, { method: 'POST', body: JSON.stringify(job) })
    
    this.activeJobs.set(job.id, {
      ...job,
      status: 'sent_to_n8n'
    });

    return {
      success: true,
      externalExecutionId: `n8n_exec_${Math.random().toString(36).substring(7)}`
    };
  }

  async handleJobResult(result: JobResult): Promise<void> {
    const job = this.activeJobs.get(result.jobId);
    if (!job) {
      console.warn(`[n8nJobManager] Received execution update for unregistered job: ${result.jobId}`);
      return;
    }

    if (result.status === 'success') {
      job.status = 'succeeded';
      console.log(`[n8nJobManager] Job ${result.jobId} succeeded. Output received.`);
    } else {
      // Check retry policy
      const policy = job.retryPolicy || { maxAttempts: 3, currentAttempt: 0, backoffFactorMs: 2000 };
      if (policy.currentAttempt < policy.maxAttempts) {
        policy.currentAttempt += 1;
        job.status = 'retrying';
        job.retryPolicy = policy;
        console.log(`[n8nJobManager] Job ${result.jobId} failed. Scheduling attempt ${policy.currentAttempt}/${policy.maxAttempts}`);
      } else {
        job.status = 'failed';
        console.error(`[n8nJobManager] Job ${result.jobId} failed permanently. Error: ${result.errorMessage}`);
      }
    }
  }

  private validateJobPayload(job: AutomationJob): void {
    const p = job.payload;
    switch (job.jobType) {
      case 'publish_content':
        if (!p.content && !p.mediaUrls) {
          throw new Error('Publish job requires content text or media URL attachments.');
        }
        if (!p.platforms || p.platforms.length === 0) {
          throw new Error('Publish job requires target publishing platforms list.');
        }
        break;
      case 'reply_conversation':
        if (!p.conversationId) throw new Error('Reply job requires source conversation thread ID.');
        if (!p.body) throw new Error('Reply job message body cannot be empty.');
        break;
      case 'generate_caption':
        if (!p.prompt) throw new Error('Caption generation requires seed prompt instructions.');
        break;
      case 'extract_lead':
        if (!p.messageBody && !p.contextSummary) {
          throw new Error('Lead extraction requires context message text.');
        }
        break;
      case 'sync_analytics':
        if (!p.accountId) throw new Error('Analytics sync requires platform account ID.');
        break;
      default:
        throw new Error(`Unsupported job execution type: ${job.jobType}`);
    }
  }
}
