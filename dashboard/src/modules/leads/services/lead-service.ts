// dashboard/src/modules/leads/services/lead-service.ts
import { LeadRepository, LeadFilterOptions } from '../repositories/lead-repository';
import type { Lead } from '@/types/lead';

export class LeadService {
  /**
   * Retrieves dashboard statistics and recent lead activity.
   */
  static async getDashboardOverview() {
    const stats = await LeadRepository.getStats();
    const recentLeads = await LeadRepository.getRecentLeads(5);

    const sent = (stats.statusCounts['whatsapp_sent'] || 0) + (stats.statusCounts['email_sent'] || 0);
    const replied = stats.statusCounts['replied'] || 0;
    const converted = stats.statusCounts['converted'] || 0;
    const conversionRate = sent > 0 ? Math.round(((replied + converted) / sent) * 100) : 0;

    return {
      stats: {
        ...stats,
        conversionStats: {
          rate: conversionRate,
          sent,
          replied,
          converted,
        },
      },
      recentLeads,
    };
  }

  /**
   * Fetches paginated leads with filter processing.
   */
  static async getLeads(options: LeadFilterOptions) {
    return await LeadRepository.findLeads(options);
  }

  /**
   * Updates lead pipeline state.
   */
  static async markLeadStatus(leadId: string, status: string, notes?: string) {
    return await LeadRepository.updateStatus(leadId, status, notes);
  }
}
