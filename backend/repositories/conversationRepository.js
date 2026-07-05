// backend/repositories/conversationRepository.js
const db = require('../database/db');
const { handleDbError } = require('../database/dbErrorHandler');

/**
 * @typedef {Object} ConversationState
 * @property {string} [id] UUID primary key
 * @property {string} business_id Associated business profile ID (UUID)
 * @property {string} [current_stage] Stage (e.g. 'lead_qualified', 'outreach_started', 'demo_scheduled', 'closed_won', 'closed_lost')
 * @property {string} [last_contacted_at] ISO Timestamp
 * @property {string} [next_action] Description of next action
 * @property {Object} [metadata] Metadata JSON
 * @property {string} [created_at] ISO Timestamp
 * @property {string} [updated_at] ISO Timestamp
 */

/**
 * @typedef {Object} ConversationMessage
 * @property {string} [id] UUID primary key
 * @property {string} conversation_state_id Associated conversation state ID (UUID)
 * @property {'inbound'|'outbound'} direction Direction of the message
 * @property {'whatsapp'|'email'|'sms'|'call'} channel Interaction channel
 * @property {string} [sender] Sender identity
 * @property {string} [recipient] Recipient identity
 * @property {string} [body] Content body
 * @property {Object} [metadata] Channel specific headers/properties JSON
 * @property {string} [created_at] ISO Timestamp
 * @property {string} [updated_at] ISO Timestamp
 */

/**
 * @typedef {Object} Attachment
 * @property {string} [id] UUID primary key
 * @property {string} message_id Associated message ID (UUID)
 * @property {string} file_name Original file name
 * @property {string} [file_type] MIME type
 * @property {string} file_url URL where stored
 * @property {number} [file_size_bytes] Size in bytes
 */

/**
 * @typedef {Object} MessageLog
 * @property {string} [id] UUID primary key
 * @property {string} [message_id] Associated message ID (UUID)
 * @property {string} [status] Gateway delivery status
 * @property {string} [error_message] Error details
 * @property {Object} [gateway_response] JSON response from service provider
 */

class ConversationRepository {
  // =========================================================================
  // Conversation State CRUD & Search
  // =========================================================================

  /**
   * Create a new conversation state
   * @param {ConversationState} data Conversation state data
   * @param {import('pg').ClientBase} [tx] Optional transaction client
   * @returns {Promise<ConversationState>}
   */
  async create(data, tx = null) {
    const text = `
      INSERT INTO conversation_states (business_id, current_stage, last_contacted_at, next_action, metadata)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const params = [
      data.business_id,
      data.current_stage || 'lead_qualified',
      data.last_contacted_at || null,
      data.next_action || null,
      data.metadata ? JSON.stringify(data.metadata) : '{}'
    ];

    try {
      const res = await db.execute(tx, text, params, 'ConversationRepository', 'create');
      return res.rows[0];
    } catch (err) {
      throw handleDbError(err, 'ConversationRepository.create');
    }
  }

  /**
   * Update an existing conversation state
   * @param {string} id Conversation state ID (UUID)
   * @param {Partial<ConversationState>} data Updates
   * @param {import('pg').ClientBase} [tx] Optional transaction client
   * @returns {Promise<ConversationState|null>}
   */
  async update(id, data, tx = null) {
    const fields = [];
    const params = [id];
    let paramIndex = 2;

    const updatableFields = ['current_stage', 'last_contacted_at', 'next_action', 'metadata'];
    for (const key of updatableFields) {
      if (data[key] !== undefined) {
        fields.push(`${key} = $${paramIndex}`);
        params.push(key === 'metadata' ? JSON.stringify(data[key]) : data[key]);
        paramIndex++;
      }
    }

    if (fields.length === 0) {
      return this.findById(id, tx);
    }

    const text = `
      UPDATE conversation_states
      SET ${fields.join(', ')}
      WHERE id = $1
      RETURNING *;
    `;

    try {
      const res = await db.execute(tx, text, params, 'ConversationRepository', 'update');
      return res.rows[0] || null;
    } catch (err) {
      throw handleDbError(err, 'ConversationRepository.update');
    }
  }

  /**
   * Find a conversation state by its ID
   * @param {string} id Conversation state ID (UUID)
   * @param {import('pg').ClientBase} [tx] Optional transaction client
   * @returns {Promise<ConversationState|null>}
   */
  async findById(id, tx = null) {
    const text = `SELECT * FROM conversation_states WHERE id = $1;`;
    try {
      const res = await db.execute(tx, text, [id], 'ConversationRepository', 'findById');
      return res.rows[0] || null;
    } catch (err) {
      throw handleDbError(err, 'ConversationRepository.findById');
    }
  }

  /**
   * Find a conversation state by the associated business profile ID
   * @param {string} businessId Business Profile ID (UUID)
   * @param {import('pg').ClientBase} [tx] Optional transaction client
   * @returns {Promise<ConversationState|null>}
   */
  async findByBusinessId(businessId, tx = null) {
    const text = `SELECT * FROM conversation_states WHERE business_id = $1;`;
    try {
      const res = await db.execute(tx, text, [businessId], 'ConversationRepository', 'findByBusinessId');
      return res.rows[0] || null;
    } catch (err) {
      throw handleDbError(err, 'ConversationRepository.findByBusinessId');
    }
  }

  /**
   * Find a conversation state by the associated lead ID (joins through business_profiles)
   * @param {string} leadId Lead ID (UUID)
   * @param {import('pg').ClientBase} [tx] Optional transaction client
   * @param {boolean} [forUpdate=false] Add FOR UPDATE OF cs lock inside active transactions
   * @returns {Promise<ConversationState|null>}
   */
  async findByLeadId(leadId, tx = null, forUpdate = false) {
    let text = `
      SELECT cs.* FROM conversation_states cs
      JOIN business_profiles bp ON cs.business_id = bp.id
      WHERE bp.lead_id = $1
    `;
    if (forUpdate && tx) {
      text += ` FOR UPDATE OF cs`;
    }
    text += ';';
    try {
      const res = await db.execute(tx, text, [leadId], 'ConversationRepository', 'findByLeadId');
      return res.rows[0] || null;
    } catch (err) {
      throw handleDbError(err, 'ConversationRepository.findByLeadId');
    }
  }

  /**
   * Delete a conversation state (cascades message deletion)
   * @param {string} id Conversation state ID (UUID)
   * @param {import('pg').ClientBase} [tx] Optional transaction client
   * @returns {Promise<boolean>}
   */
  async delete(id, tx = null) {
    const text = `DELETE FROM conversation_states WHERE id = $1 RETURNING id;`;
    try {
      const res = await db.execute(tx, text, [id], 'ConversationRepository', 'delete');
      return res.rowCount > 0;
    } catch (err) {
      throw handleDbError(err, 'ConversationRepository.delete');
    }
  }

  /**
   * List conversation states with optional filters
   * @param {Object} [options] Filter options
   * @param {number} [options.limit] Max records (default 50)
   * @param {number} [options.offset] Pagination offset (default 0)
   * @param {string} [options.current_stage] Filter by stage
   * @param {import('pg').ClientBase} [tx] Optional transaction client
   * @returns {Promise<ConversationState[]>}
   */
  async list(options = {}, tx = null) {
    const limit = options.limit || 50;
    const offset = options.offset || 0;
    const params = [limit, offset];
    
    let text = `SELECT * FROM conversation_states`;
    let clause = 'WHERE';

    if (options.current_stage) {
      text += ` ${clause} current_stage = $3`;
      params.push(options.current_stage);
    }

    text += ` ORDER BY updated_at DESC LIMIT $1 OFFSET $2;`;

    try {
      const res = await db.execute(tx, text, params, 'ConversationRepository', 'list');
      return res.rows;
    } catch (err) {
      throw handleDbError(err, 'ConversationRepository.list');
    }
  }

  /**
   * Search conversation states by keyword matching stage or next action
   * @param {string} queryText Search query text
   * @param {Object} [options] Pagination parameters
   * @param {number} [options.limit] Max records to return
   * @param {number} [options.offset] Pagination offset
   * @param {import('pg').ClientBase} [tx] Optional transaction client
   * @returns {Promise<ConversationState[]>}
   */
  async search(queryText, options = {}, tx = null) {
    const limit = options.limit || 50;
    const offset = options.offset || 0;
    const pattern = `%${queryText}%`;
    const params = [pattern, limit, offset];

    const text = `
      SELECT * FROM conversation_states
      WHERE current_stage ILIKE $1 
         OR next_action ILIKE $1
      ORDER BY updated_at DESC
      LIMIT $2 OFFSET $3;
    `;

    try {
      const res = await db.execute(tx, text, params, 'ConversationRepository', 'search');
      return res.rows;
    } catch (err) {
      throw handleDbError(err, 'ConversationRepository.search');
    }
  }

  // =========================================================================
  // Conversation Message Operations
  // =========================================================================

  /**
   * Create a new message in a conversation
   * @param {ConversationMessage} data Message data
   * @param {import('pg').ClientBase} [tx] Optional transaction client
   * @returns {Promise<ConversationMessage>}
   */
  async createMessage(data, tx = null) {
    const text = `
      INSERT INTO conversation_messages (conversation_state_id, direction, channel, sender, recipient, body, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;
    const params = [
      data.conversation_state_id,
      data.direction,
      data.channel,
      data.sender || null,
      data.recipient || null,
      data.body || null,
      data.metadata ? JSON.stringify(data.metadata) : '{}'
    ];

    try {
      const res = await db.execute(tx, text, params, 'ConversationRepository', 'createMessage');
      return res.rows[0];
    } catch (err) {
      throw handleDbError(err, 'ConversationRepository.createMessage');
    }
  }

  /**
   * Get all messages for a specific conversation state
   * @param {string} conversationStateId State ID (UUID)
   * @param {import('pg').ClientBase} [tx] Optional transaction client
   * @returns {Promise<ConversationMessage[]>}
   */
  async getMessages(conversationStateId, tx = null) {
    const text = `
      SELECT * FROM conversation_messages
      WHERE conversation_state_id = $1
      ORDER BY created_at ASC;
    `;
    try {
      const res = await db.execute(tx, text, [conversationStateId], 'ConversationRepository', 'getMessages');
      return res.rows;
    } catch (err) {
      throw handleDbError(err, 'ConversationRepository.getMessages');
    }
  }

  // =========================================================================
  // Attachment Operations
  // =========================================================================

  /**
   * Associate an attachment to a message
   * @param {Attachment} data Attachment data
   * @param {import('pg').ClientBase} [tx] Optional transaction client
   * @returns {Promise<Attachment>}
   */
  async createAttachment(data, tx = null) {
    const text = `
      INSERT INTO attachments (message_id, file_name, file_type, file_url, file_size_bytes)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const params = [
      data.message_id,
      data.file_name,
      data.file_type || null,
      data.file_url,
      data.file_size_bytes || null
    ];

    try {
      const res = await db.execute(tx, text, params, 'ConversationRepository', 'createAttachment');
      return res.rows[0];
    } catch (err) {
      throw handleDbError(err, 'ConversationRepository.createAttachment');
    }
  }

  /**
   * Get all attachments for a specific message
   * @param {string} messageId Message ID (UUID)
   * @param {import('pg').ClientBase} [tx] Optional transaction client
   * @returns {Promise<Attachment[]>}
   */
  async getAttachments(messageId, tx = null) {
    const text = `SELECT * FROM attachments WHERE message_id = $1;`;
    try {
      const res = await db.execute(tx, text, [messageId], 'ConversationRepository', 'getAttachments');
      return res.rows;
    } catch (err) {
      throw handleDbError(err, 'ConversationRepository.getAttachments');
    }
  }

  // =========================================================================
  // Message Log Operations
  // =========================================================================

  /**
   * Add a log entry for a message dispatch attempt
   * @param {MessageLog} data Message log properties
   * @param {import('pg').ClientBase} [tx] Optional transaction client
   * @returns {Promise<MessageLog>}
   */
  async createMessageLog(data, tx = null) {
    const text = `
      INSERT INTO message_logs (message_id, status, error_message, gateway_response)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const params = [
      data.message_id || null,
      data.status || 'sent',
      data.error_message || null,
      data.gateway_response ? JSON.stringify(data.gateway_response) : '{}'
    ];

    try {
      const res = await db.execute(tx, text, params, 'ConversationRepository', 'createMessageLog');
      return res.rows[0];
    } catch (err) {
      throw handleDbError(err, 'ConversationRepository.createMessageLog');
    }
  }

  /**
   * Get logs for a specific message
   * @param {string} messageId Message ID (UUID)
   * @param {import('pg').ClientBase} [tx] Optional transaction client
   * @returns {Promise<MessageLog[]>}
   */
  async getMessageLogs(messageId, tx = null) {
    const text = `SELECT * FROM message_logs WHERE message_id = $1 ORDER BY created_at DESC;`;
    try {
      const res = await db.execute(tx, text, [messageId], 'ConversationRepository', 'getMessageLogs');
      return res.rows;
    } catch (err) {
      throw handleDbError(err, 'ConversationRepository.getMessageLogs');
    }
  }
}

module.exports = new ConversationRepository();
