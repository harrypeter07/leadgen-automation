// backend/repositories/connectedAccountsRepository.js
const supabase = require('../database/connection');
const encryptionService = require('../services/encryptionService');
const logger = require('../worker/logger');

class ConnectedAccountsRepository {
  /**
   * Helper to decrypt the encrypted_credentials string to JSON object
   * @param {Object} account - Raw database account record
   * @returns {Object} Account with credentials decrypted
   */
  _decryptAccount(account) {
    if (!account) return null;
    const result = { ...account };
    if (result.encrypted_credentials) {
      try {
        const decryptedStr = encryptionService.decrypt(result.encrypted_credentials);
        result.credentials = decryptedStr ? JSON.parse(decryptedStr) : {};
      } catch (err) {
        logger.error(`[ConnectedAccountsRepository] Decryption failed for account ${account.id}: ${err.message}`);
        result.credentials = {};
      }
    } else {
      result.credentials = {};
    }
    return result;
  }

  async getById(id) {
    logger.debug(`[ConnectedAccountsRepository] Fetching account: ${id}`);
    const { data, error } = await supabase
      .from('connected_accounts')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      logger.error(`[ConnectedAccountsRepository] getById error: ${error.message}`);
      throw error;
    }
    return this._decryptAccount(data);
  }

  async getAll() {
    logger.debug('[ConnectedAccountsRepository] Fetching all connected accounts...');
    const { data, error } = await supabase
      .from('connected_accounts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      logger.error(`[ConnectedAccountsRepository] getAll error: ${error.message}`);
      throw error;
    }
    return (data || []).map(acc => this._decryptAccount(acc));
  }

  async getByPlatform(platform) {
    logger.debug(`[ConnectedAccountsRepository] Fetching accounts for platform: ${platform}`);
    const { data, error } = await supabase
      .from('connected_accounts')
      .select('*')
      .eq('platform', platform);

    if (error) {
      logger.error(`[ConnectedAccountsRepository] getByPlatform error: ${error.message}`);
      throw error;
    }
    return (data || []).map(acc => this._decryptAccount(acc));
  }

  async create(accountData) {
    logger.debug('[ConnectedAccountsRepository] Creating connected account...');
    const { credentials, ...rest } = accountData;

    // Encrypt credentials JSON block
    const credentialsStr = credentials ? JSON.stringify(credentials) : '{}';
    const encrypted_credentials = encryptionService.encrypt(credentialsStr);

    const insertPayload = {
      ...rest,
      encrypted_credentials,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('connected_accounts')
      .insert([insertPayload])
      .select()
      .single();

    if (error) {
      logger.error(`[ConnectedAccountsRepository] create error: ${error.message}`);
      throw error;
    }
    return this._decryptAccount(data);
  }

  async update(id, updates) {
    logger.debug(`[ConnectedAccountsRepository] Updating account: ${id}`);
    const { credentials, ...rest } = updates;
    const updatePayload = { ...rest, updated_at: new Date().toISOString() };

    if (credentials) {
      const credentialsStr = JSON.stringify(credentials);
      updatePayload.encrypted_credentials = encryptionService.encrypt(credentialsStr);
    }

    const { data, error } = await supabase
      .from('connected_accounts')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error(`[ConnectedAccountsRepository] update error: ${error.message}`);
      throw error;
    }
    return this._decryptAccount(data);
  }

  async delete(id) {
    logger.debug(`[ConnectedAccountsRepository] Deleting account: ${id}`);
    const { data, error } = await supabase
      .from('connected_accounts')
      .delete()
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error(`[ConnectedAccountsRepository] delete error: ${error.message}`);
      throw error;
    }
    return data;
  }
}

module.exports = new ConnectedAccountsRepository();
