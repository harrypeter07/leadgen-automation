const supabase = require('../database/connection');

class QstashService {
  async getQStashConfig() {
    const config = {
      token: process.env.QSTASH_TOKEN || '',
      url: process.env.QSTASH_URL || 'https://qstash.upstash.io',
      webhookUrl: `${process.env.N8N_WEBHOOK_BASE_URL || 'https://n8n-production-4cbd.up.railway.app'}/webhook/publishing-hub`
    };

    try {
      const { data, error } = await supabase
        .from('meta_config')
        .select('key, value')
        .in('key', ['QSTASH_TOKEN', 'QSTASH_URL', 'N8N_WEBHOOK_BASE_URL']);

      if (!error && data) {
        data.forEach(item => {
          if (item.key === 'QSTASH_TOKEN' && item.value) {
            config.token = item.value.trim();
          }
          if (item.key === 'QSTASH_URL' && item.value) {
            config.url = item.value.trim();
          }
          if (item.key === 'N8N_WEBHOOK_BASE_URL' && item.value) {
            config.webhookUrl = `${item.value.trim()}/webhook/publishing-hub`;
          }
        });
      }
    } catch (e) {
      console.warn('[QStash Service] Failed to load QStash config from Supabase:', e.message);
    }

    return config;
  }

  async schedulePost(postId, scheduledAtIso) {
    const config = await this.getQStashConfig();
    if (!config.token) {
      console.warn('[QStash Service] QSTASH_TOKEN is not configured. Skipping QStash schedule.');
      return null;
    }

    try {
      const scheduledTime = Math.floor(new Date(scheduledAtIso).getTime() / 1000);
      
      // Ensure QStash URL does not have trailing slashes
      const qstashBaseUrl = config.url.trim().replace(/\/+$/, '');
      const targetUrl = config.webhookUrl;

      console.log(`[QStash] Scheduling post ${postId} for ${scheduledAtIso} (timestamp: ${scheduledTime}) target: ${targetUrl}`);

      const response = await fetch(`${qstashBaseUrl}/v2/publish/${targetUrl}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.token}`,
          'Content-Type': 'application/json',
          'Upstash-Not-Before': String(scheduledTime)
        },
        body: JSON.stringify({ id: postId })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`QStash publish API failed: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log(`[QStash] Successfully scheduled! Message ID: ${data.messageId}`);
      return data.messageId;
    } catch (err) {
      console.error('[QStash Service] Failed to schedule message:', err.message);
      return null;
    }
  }

  async cancelScheduledPost(messageId) {
    const config = await this.getQStashConfig();
    if (!config.token || !messageId) return false;

    try {
      const qstashBaseUrl = config.url.trim().replace(/\/+$/, '');
      console.log(`[QStash] Cancelling message: ${messageId}`);
      
      const response = await fetch(`${qstashBaseUrl}/v2/messages/${messageId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${config.token}`
        }
      });

      if (!response.ok && response.status !== 404) {
        const errorText = await response.text();
        throw new Error(`QStash delete API failed: ${response.statusText} - ${errorText}`);
      }

      console.log(`[QStash] Successfully cancelled message: ${messageId}`);
      return true;
    } catch (err) {
      console.error('[QStash Service] Failed to cancel message:', err.message);
      return false;
    }
  }
}

module.exports = new QstashService();
