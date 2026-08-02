// dashboard/src/modules/leads/repositories/lead-repository.ts
import { supabaseAdmin, supabaseBrowser } from '@/lib/supabase';
import type { Lead } from '@/types/lead';

export interface LeadFilterOptions {
  page?: number;
  limit?: number;
  status?: string;
  city?: string;
  category?: string;
  search?: string;
  jobId?: string;
}

export class LeadRepository {
  /**
   * Fetches paginated leads based on filter criteria.
   */
  static async findLeads(options: LeadFilterOptions = {}): Promise<{ leads: Lead[]; total: number }> {
    const page = options.page || 1;
    const limit = options.limit || 25;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabaseAdmin
      .from('leads')
      .select('*', { count: 'exact' });

    if (options.status && options.status !== 'all') {
      query = query.eq('status', options.status);
    }
    if (options.city) {
      query = query.ilike('city', `%${options.city}%`);
    }
    if (options.category) {
      query = query.ilike('category', `%${options.category}%`);
    }
    if (options.search) {
      query = query.or(`name.ilike.%${options.search}%,email.ilike.%${options.search}%,phone.ilike.%${options.search}%`);
    }

    const { data, count, error } = await query
      .range(from, to)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[LeadRepository.findLeads] Error:', error.message);
      return { leads: [], total: 0 };
    }

    return {
      leads: (data || []) as Lead[],
      total: count || 0,
    };
  }

  /**
   * Fetches most recent N leads.
   */
  static async getRecentLeads(limit = 5): Promise<Lead[]> {
    const client = typeof window === 'undefined' ? supabaseAdmin : supabaseBrowser;
    const { data, error } = await client
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[LeadRepository.getRecentLeads] Error:', error.message);
      return [];
    }
    return (data || []) as Lead[];
  }

  /**
   * Gets aggregate metrics (total count, status breakdown, 7-day lead count).
   */
  static async getStats() {
    const totalRes = await supabaseAdmin.from('leads').select('*', { count: 'exact', head: true });
    
    // Status breakdown
    const statuses = ['new', 'whatsapp_sent', 'email_sent', 'replied', 'converted', 'skip'];
    const statusCounts: Record<string, number> = {};

    for (const status of statuses) {
      const res = await supabaseAdmin
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('status', status);
      statusCounts[status] = res.count || 0;
    }

    // 7-day count
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const recentRes = await supabaseAdmin
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo);

    return {
      total: totalRes.count || 0,
      statusCounts,
      addedLast7Days: recentRes.count || 0,
    };
  }

  /**
   * Updates lead status.
   */
  static async updateStatus(leadId: string, status: string, notes?: string): Promise<boolean> {
    const updateData: Record<string, any> = { status, last_contacted_at: new Date().toISOString() };
    if (notes) updateData.notes = notes;
    if (status === 'whatsapp_sent') updateData.whatsapp_sent_at = new Date().toISOString();
    if (status === 'email_sent') updateData.email_sent_at = new Date().toISOString();

    const { error } = await supabaseAdmin.from('leads').update(updateData).eq('id', leadId);
    if (error) {
      console.error('[LeadRepository.updateStatus] Error:', error.message);
      return false;
    }
    return true;
  }
}
