// whatsapp-service/scraper/dbWriter.js

const http = require('http');
const https = require('https');
const url = require('url');

class DbWriter {
  constructor() {
    this.supabaseUrl = (process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
    this.serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    this.queue = [];
    this.isProcessing = false;
  }

  /**
   * Pushes a lead record into the queue and starts processing.
   */
  enqueue(lead, jobId, onProgressUpdate) {
    this.queue.push({ lead, jobId, onProgressUpdate });
    this.processQueue();
  }

  /**
   * Processes the queue sequentially in the background.
   */
  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift();
      try {
        await this.upsertLead(item.lead);
        if (item.onProgressUpdate) {
          await item.onProgressUpdate(item.jobId, item.lead.name);
        }
      } catch (err) {
        console.error(`❌ [DB Writer] Failed to upsert lead "${item.lead.name}":`, err.message);
      }
    }

    this.isProcessing = false;
  }

  /**
   * Performs an UPSERT operation to Supabase leads table via REST API.
   */
  upsertLead(lead) {
    return new Promise((resolve, reject) => {
      if (!this.supabaseUrl || !this.serviceKey) {
        return reject(new Error('Supabase credentials are not configured in environment variables.'));
      }

      // Upsert lead. If phone is present, conflict on phone.
      // Otherwise, conflict on name,city index (if we configured unique constraint).
      let endpoint = `${this.supabaseUrl}/rest/v1/leads`;
      if (lead.phone) {
        endpoint += '?on_conflict=phone';
      }

      const parsedUrl = url.parse(endpoint);
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.path,
        method: 'POST',
        headers: {
          'apikey': this.serviceKey,
          'Authorization': `Bearer ${this.serviceKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        }
      };

      const lib = parsedUrl.protocol === 'https:' ? https : http;
      const req = lib.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${body}`));
          }
        });
      });

      req.on('error', (err) => reject(err));
      req.write(JSON.stringify(lead));
      req.end();
    });
  }

  /**
   * Helper to write arbitrary records (e.g. ScrapeJob updates) directly to Supabase.
   */
  writeRecord(table, record, id = null) {
    return new Promise((resolve, reject) => {
      if (!this.supabaseUrl || !this.serviceKey) {
        return reject(new Error('Supabase credentials not set.'));
      }

      let endpoint = `${this.supabaseUrl}/rest/v1/${table}`;
      let method = 'POST';
      let preferHeader = 'resolution=merge-duplicates';

      if (id) {
        endpoint += `?id=eq.${id}`;
        method = 'PATCH';
        preferHeader = 'return=representation';
      }

      const parsedUrl = url.parse(endpoint);
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.path,
        method: method,
        headers: {
          'apikey': this.serviceKey,
          'Authorization': `Bearer ${this.serviceKey}`,
          'Content-Type': 'application/json',
          'Prefer': preferHeader
        }
      };

      const lib = parsedUrl.protocol === 'https:' ? https : http;
      const req = lib.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const data = body ? JSON.parse(body) : null;
              resolve(data);
            } catch (e) {
              resolve(body);
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${body}`));
          }
        });
      });

      req.on('error', (err) => reject(err));
      req.write(JSON.stringify(record));
      req.end();
    });
  }

  /**
   * Fetches all records from a table matching conditions.
   */
  fetchRecords(table, queryParams = {}) {
    return new Promise((resolve, reject) => {
      if (!this.supabaseUrl || !this.serviceKey) {
        return reject(new Error('Supabase credentials not set.'));
      }

      let queryStr = '';
      const keys = Object.keys(queryParams);
      if (keys.length > 0) {
        queryStr = '?' + keys.map(k => `${k}=${encodeURIComponent(queryParams[k])}`).join('&');
      }

      const endpoint = `${this.supabaseUrl}/rest/v1/${table}${queryStr}`;
      const parsedUrl = url.parse(endpoint);
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.path,
        method: 'GET',
        headers: {
          'apikey': this.serviceKey,
          'Authorization': `Bearer ${this.serviceKey}`,
        }
      };

      const lib = parsedUrl.protocol === 'https:' ? https : http;
      const req = lib.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(body));
            } catch (e) {
              reject(new Error(`Parse error: ${e.message}`));
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${body}`));
          }
        });
      });

      req.on('error', (err) => reject(err));
      req.end();
    });
  }
}

module.exports = new DbWriter();
