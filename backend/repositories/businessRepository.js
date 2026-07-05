// backend/repositories/businessRepository.js
const db = require('../database/db');
const cache = require('../modules/cache');
const { handleDbError } = require('../database/dbErrorHandler');

/**
 * @typedef {Object} BusinessProfile
 * @property {string} [id] UUID primary key
 * @property {string} lead_id Associated lead ID (UUID)
 * @property {string} [business_name] Name of business
 * @property {string} [industry] Industry type
 * @property {string} [website] Website URL
 * @property {string} [email] Contact email
 * @property {string} [phone] Contact phone
 * @property {string} [address] Physical address
 * @property {Object} [social_links] Social links json (e.g. facebook, instagram)
 * @property {string} [created_at] ISO Timestamp
 * @property {string} [updated_at] ISO Timestamp
 */

class BusinessRepository {
  /**
   * Create a new business profile
   * @param {BusinessProfile} data Business data
   * @param {import('pg').ClientBase} [tx] Optional transaction client
   * @returns {Promise<BusinessProfile>}
   */
  async create(data, tx = null) {
    const text = `
      INSERT INTO business_profiles (lead_id, business_name, industry, website, email, phone, address, social_links)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;
    const params = [
      data.lead_id,
      data.business_name || null,
      data.industry || null,
      data.website || null,
      data.email || null,
      data.phone || null,
      data.address || null,
      data.social_links ? JSON.stringify(data.social_links) : '{}'
    ];

    try {
      const res = await db.execute(tx, text, params, 'BusinessRepository', 'create');
      return res.rows[0];
    } catch (err) {
      throw handleDbError(err, 'BusinessRepository.create');
    }
  }

  /**
   * Update an existing business profile
   * @param {string} id Business profile ID (UUID)
   * @param {Partial<BusinessProfile>} data Updates
   * @param {import('pg').ClientBase} [tx] Optional transaction client
   * @returns {Promise<BusinessProfile|null>}
   */
  async update(id, data, tx = null) {
    // Generate dynamic SET clause to only update provided fields
    const fields = [];
    const params = [id];
    let paramIndex = 2;

    const updatableFields = ['business_name', 'industry', 'website', 'email', 'phone', 'address', 'social_links'];
    for (const key of updatableFields) {
      if (data[key] !== undefined) {
        fields.push(`${key} = $${paramIndex}`);
        params.push(key === 'social_links' ? JSON.stringify(data[key]) : data[key]);
        paramIndex++;
      }
    }

    if (fields.length === 0) {
      return this.findById(id, tx);
    }

    const text = `
      UPDATE business_profiles
      SET ${fields.join(', ')}
      WHERE id = $1
      RETURNING *;
    `;

    try {
      const res = await db.execute(tx, text, params, 'BusinessRepository', 'update');
      const updated = res.rows[0] || null;
      if (updated) {
        cache.delete(`bp_id:${id}`);
        cache.delete(`bp_lead_id:${updated.lead_id}`);
      }
      return updated;
    } catch (err) {
      throw handleDbError(err, 'BusinessRepository.update');
    }
  }

  /**
   * Find a business profile by its ID
   * @param {string} id Business profile ID (UUID)
   * @param {import('pg').ClientBase} [tx] Optional transaction client
   * @returns {Promise<BusinessProfile|null>}
   */
  async findById(id, tx = null) {
    if (!tx) {
      const cached = cache.get(`bp_id:${id}`);
      if (cached) return cached;
    }
    const text = `SELECT * FROM business_profiles WHERE id = $1;`;
    try {
      const res = await db.execute(tx, text, [id], 'BusinessRepository', 'findById');
      const profile = res.rows[0] || null;
      if (!tx && profile) {
        cache.set(`bp_id:${id}`, profile, 120);
        cache.set(`bp_lead_id:${profile.lead_id}`, profile, 120);
      }
      return profile;
    } catch (err) {
      throw handleDbError(err, 'BusinessRepository.findById');
    }
  }

  /**
   * Find a business profile by the associated lead ID
   * @param {string} leadId Lead ID (UUID)
   * @param {import('pg').ClientBase} [tx] Optional transaction client
   * @returns {Promise<BusinessProfile|null>}
   */
  async findByLeadId(leadId, tx = null) {
    if (!tx) {
      const cached = cache.get(`bp_lead_id:${leadId}`);
      if (cached) return cached;
    }
    const text = `SELECT * FROM business_profiles WHERE lead_id = $1;`;
    try {
      const res = await db.execute(tx, text, [leadId], 'BusinessRepository', 'findByLeadId');
      const profile = res.rows[0] || null;
      if (!tx && profile) {
        cache.set(`bp_id:${profile.id}`, profile, 120);
        cache.set(`bp_lead_id:${leadId}`, profile, 120);
      }
      return profile;
    } catch (err) {
      throw handleDbError(err, 'BusinessRepository.findByLeadId');
    }
  }

  /**
   * Delete a business profile
   * @param {string} id Business profile ID (UUID)
   * @param {import('pg').ClientBase} [tx] Optional transaction client
   * @returns {Promise<boolean>}
   */
  async delete(id, tx = null) {
    const text = `DELETE FROM business_profiles WHERE id = $1 RETURNING id;`;
    try {
      const profile = await this.findById(id, tx);
      const res = await db.execute(tx, text, [id], 'BusinessRepository', 'delete');
      if (profile) {
        cache.delete(`bp_id:${id}`);
        cache.delete(`bp_lead_id:${profile.lead_id}`);
      }
      return res.rowCount > 0;
    } catch (err) {
      throw handleDbError(err, 'BusinessRepository.delete');
    }
  }

  /**
   * List business profiles with pagination and optional filtering
   * @param {Object} [options] Pagination and filter parameters
   * @param {number} [options.limit] Max records to return (default 50)
   * @param {number} [options.offset] Offset for pagination (default 0)
   * @param {string} [options.industry] Filter by industry
   * @param {import('pg').ClientBase} [tx] Optional transaction client
   * @returns {Promise<BusinessProfile[]>}
   */
  async list(options = {}, tx = null) {
    const limit = options.limit || 50;
    const offset = options.offset || 0;
    const params = [limit, offset];
    
    let text = `SELECT * FROM business_profiles`;
    let clause = 'WHERE';

    if (options.industry) {
      text += ` ${clause} industry = $3`;
      params.push(options.industry);
    }

    text += ` ORDER BY created_at DESC LIMIT $1 OFFSET $2;`;

    try {
      const res = await db.execute(tx, text, params, 'BusinessRepository', 'list');
      return res.rows;
    } catch (err) {
      throw handleDbError(err, 'BusinessRepository.list');
    }
  }

  /**
   * Search business profiles by keyword (matches business_name, industry, address)
   * @param {string} queryText Search query string
   * @param {Object} [options] Pagination parameters
   * @param {number} [options.limit] Max records to return
   * @param {number} [options.offset] Pagination offset
   * @param {import('pg').ClientBase} [tx] Optional transaction client
   * @returns {Promise<BusinessProfile[]>}
   */
  async search(queryText, options = {}, tx = null) {
    const limit = options.limit || 50;
    const offset = options.offset || 0;
    const pattern = `%${queryText}%`;
    const params = [pattern, limit, offset];

    const text = `
      SELECT * FROM business_profiles
      WHERE business_name ILIKE $1 
         OR industry ILIKE $1 
         OR address ILIKE $1
      ORDER BY business_name ASC
      LIMIT $2 OFFSET $3;
    `;

    try {
      const res = await db.execute(tx, text, params, 'BusinessRepository', 'search');
      return res.rows;
    } catch (err) {
      throw handleDbError(err, 'BusinessRepository.search');
    }
  }
}

module.exports = new BusinessRepository();
