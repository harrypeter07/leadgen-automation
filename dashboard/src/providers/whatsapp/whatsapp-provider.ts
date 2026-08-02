// dashboard/src/providers/whatsapp/whatsapp-provider.ts
import { env } from '@/config/env';

export class WhatsAppProvider {
  private static get baseUrl(): string {
    return env.WHATSAPP_SERVICE_URL;
  }

  private static get secret(): string {
    return env.WHATSAPP_API_SECRET;
  }

  /**
   * Queries status of WhatsApp service socket.
   */
  static async getStatus() {
    try {
      const res = await fetch(`${this.baseUrl}/status`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err: any) {
      return { state: 'disconnected', whatsappReady: false, error: err.message };
    }
  }

  /**
   * Fetches raw QR code.
   */
  static async getQrText(): Promise<string | null> {
    try {
      const res = await fetch(`${this.baseUrl}/qr`, { cache: 'no-store' });
      if (!res.ok) return null;
      return await res.text();
    } catch {
      return null;
    }
  }

  /**
   * Sends text message to recipient.
   */
  static async sendMessage(phone: string, message: string) {
    const res = await fetch(`${this.baseUrl}/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-secret': this.secret,
      },
      body: JSON.stringify({ phone, message }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to send WhatsApp message');
    return data;
  }

  /**
   * Triggers manual connection initialization.
   */
  static async connect() {
    const res = await fetch(`${this.baseUrl}/connect`, {
      method: 'POST',
      headers: { 'x-api-secret': this.secret },
    });
    return await res.json();
  }

  /**
   * Triggers manual disconnect and purges session auth.
   */
  static async disconnect() {
    const res = await fetch(`${this.baseUrl}/disconnect`, {
      method: 'POST',
      headers: { 'x-api-secret': this.secret },
    });
    return await res.json();
  }
}
