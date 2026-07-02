// backend/repositories/leadsRepository.js

const supabase = require('../database/connection');
const logger = require('../worker/logger');

class LeadsRepository {
  async upsert(leadData) {
    logger.debug(`[LeadsRepository] Upserting lead: ${leadData.name}`);
    
    if (leadData.phone) {
      try {
        const { data: existing } = await supabase
          .from('leads')
          .select('id, name')
          .eq('phone', leadData.phone)
          .maybeSingle();
          
        if (existing) {
          logger.warn(`[LeadsRepository] DUPLICATE WARNING: Lead with phone ${leadData.phone} already exists (Name: "${existing.name}"). Merging details...`);
          
          // Update the existing record instead of inserting a duplicate
          const { data: updated, error: updateError } = await supabase
            .from('leads')
            .update({
              name: leadData.name,
              address: leadData.address || undefined,
              city: leadData.city || undefined,
              category: leadData.category || undefined,
              website: leadData.website || undefined,
              rating: leadData.rating || undefined,
              review_count: leadData.review_count || undefined,
              notes: leadData.notes || undefined
            })
            .eq('id', existing.id)
            .select()
            .single();

          if (updateError) throw updateError;
          return updated;
        }
      } catch (e) {
        logger.error(`[LeadsRepository] Manual upsert-merge failed: ${e.message}`);
      }
    }

    // No duplicate found, proceed with direct insert
    const { data, error } = await supabase
      .from('leads')
      .insert([leadData])
      .select()
      .single();

    if (error) {
      logger.error(`[LeadsRepository] upsert error: ${error.message}`);
      throw error;
    }
    return data;
  }

  async getById(id) {
    logger.debug(`[LeadsRepository] Fetching lead by ID: ${id}`);
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      logger.error(`[LeadsRepository] getById error: ${error.message}`);
      throw error;
    }
    return data;
  }

  async getByJobId(jobId) {
    logger.debug(`[LeadsRepository] Fetching leads for job: ${jobId}`);
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true });

    if (error) {
      logger.error(`[LeadsRepository] getByJobId error: ${error.message}`);
      throw error;
    }
    return data || [];
  }

  async getAll({ limit = 50, offset = 0, city, category, status, search } = {}) {
    logger.debug(`[LeadsRepository] Fetching all leads (limit=${limit}, offset=${offset})`);
    let query = supabase
      .from('leads')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (city) query = query.ilike('city', `%${city}%`);
    if (category) query = query.eq('category', category);
    if (status) query = query.eq('status', status);
    if (search) query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);

    const { data, count, error } = await query;
    if (error) {
      logger.error(`[LeadsRepository] getAll error: ${error.message}`);
      throw error;
    }
    return { leads: data || [], total: count || 0 };
  }
}

module.exports = new LeadsRepository();
