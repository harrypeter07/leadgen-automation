const QSTASH_TOKEN = process.env.QSTASH_TOKEN || '';
const N8N_WEBHOOK_URL = `${process.env.N8N_WEBHOOK_BASE_URL || 'https://n8n-production-4cbd.up.railway.app'}/webhook/publishing-hub`;

class QstashService {
  async schedulePost(postId, scheduledAtIso) {
    if (!QSTASH_TOKEN) {
      console.warn('[QStash Service] QSTASH_TOKEN is not configured. Skipping QStash schedule.');
      return null;
    }

    try {
      const scheduledTime = Math.floor(new Date(scheduledAtIso).getTime() / 1000);
      const targetUrl = N8N_WEBHOOK_URL;
      
      console.log(`[QStash] Scheduling post ${postId} for ${scheduledAtIso} (timestamp: ${scheduledTime}) target: ${targetUrl}`);

      const response = await fetch(`https://qstash.upstash.io/v2/publish/${targetUrl}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${QSTASH_TOKEN}`,
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
    if (!QSTASH_TOKEN || !messageId) return false;

    try {
      console.log(`[QStash] Cancelling message: ${messageId}`);
      const response = await fetch(`https://qstash.upstash.io/v2/messages/${messageId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${QSTASH_TOKEN}`
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
