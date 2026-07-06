// backend/repositories/leadsRepository.js

const supabase = require('../database/connection');
const logger = require('../worker/logger');

class LeadsRepository {
  async upsert(leadData) {
    logger.debug(`[LeadsRepository] Upserting lead: ${leadData.name}`);

    const ALLOWED_COLUMNS = [
      'id', 'created_at', 'name', 'phone', 'email', 'address', 'city', 'category', 'website',
      'rating', 'review_count', 'source', 'status', 'notes', 'whatsapp_sent_at', 'email_sent_at',
      'last_contacted_at', 'ai_message_whatsapp', 'ai_message_email_subject', 'ai_message_email_body',
      'website_audit_id', 'instagram_audit_id', 'job_id', 'updated_at', 'deleted_at', 'tenant_id',
      'enrichment_fields', 'tools_tried', 'tools_failed', 'enrichment_status', 'confidence_score',
      'enrichment_scratchpad', 'attempts'
    ];

    if (leadData.city) {
      leadData.city = leadData.city.toLowerCase().replace(/(?:^|\s|-)\S/g, match => match.toUpperCase()).trim();
    }

    // Filter properties to map strictly to valid schema columns
    const cleanData = {};
    for (const col of ALLOWED_COLUMNS) {
      if (leadData[col] !== undefined) {
        cleanData[col] = leadData[col];
      }
    }
    
    if (cleanData.phone) {
      try {
        const { data: existing } = await supabase
          .from('leads')
          .select('id, name')
          .eq('phone', cleanData.phone)
          .maybeSingle();
          
        if (existing) {
          logger.warn(`[LeadsRepository] DUPLICATE: ${cleanData.phone} exists as "${existing.name}" — merging.`);
          
          const updatePayload = {
            name: cleanData.name,
            address: cleanData.address || undefined,
            city: cleanData.city || undefined,
            category: cleanData.category || undefined,
            website: cleanData.website || undefined,
            rating: cleanData.rating || undefined,
            review_count: cleanData.review_count || undefined,
            job_id: cleanData.job_id || undefined,
            enrichment_fields: cleanData.enrichment_fields || undefined,
            notes: cleanData.notes || undefined
          };

          const { data: updated, error: updateError } = await supabase
            .from('leads')
            .update(updatePayload)
            .eq('id', existing.id)
            .select()
            .single();

          if (updateError) throw updateError;
          return { ...updated, _was_duplicate: true };
        }
      } catch (e) {
        logger.error(`[LeadsRepository] Duplicate check failed: ${e.message}`);
      }
    }

    // No duplicate found by phone check — attempt fresh insert
    const { data, error } = await supabase
      .from('leads')
      .insert([cleanData])
      .select()
      .single();

    if (error) {
      // Postgres unique constraint violation (code 23505) — skip gracefully
      if (error.code === '23505') {
        logger.warn(`[LeadsRepository] Unique constraint hit for "${cleanData.name}" — skipping.`);
        return { name: cleanData.name, _was_duplicate: true, _skipped: true };
      }
      logger.error(`[LeadsRepository] insert error: ${error.message}`);
      throw error;
    }
    return { ...data, _was_duplicate: false };
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

  async getAll({ limit = 50, offset = 0, city, category, status, search, job_id } = {}) {
    logger.debug(`[LeadsRepository] Fetching all leads (limit=${limit}, offset=${offset}, job_id=${job_id})`);
    let query = supabase
      .from('leads')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (city) query = query.ilike('city', `%${city}%`);
    if (category) query = query.eq('category', category);
    if (status) query = query.eq('status', status);
    if (job_id) query = query.eq('job_id', job_id);
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
