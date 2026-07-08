# Meta Graph API Integration Guide

This guide details the integration steps required to connect the platform to Meta Graph API, Facebook Pages, Instagram, and WhatsApp Cloud APIs.

---

## 1. Meta Developer App Setup
1.  Go to [Meta Developers Console](https://developers.facebook.com/) and register a new App (Type: **Business**).
2.  Enable the following products inside your App dashboard:
    *   **Facebook Login for Business** (for OAuth page access)
    *   **Messenger API**
    *   **Instagram Graph API**
    *   **WhatsApp Cloud API**

---

## 2. Webhook Ingestion Configuration
1.  Set the Callback URL endpoint to: `https://<your-domain>/api/automation/webhooks`.
2.  Configure a secure Verify Token string and add it to the server environment variables as `META_VERIFY_TOKEN`.
3.  Subscribe to the following webhook fields:
    *   **Page**: `messages`, `messaging_postbacks`, `messaging_optins`, `feed`
    *   **Instagram**: `messages`, `comments`
    *   **WhatsApp**: `messages`

---

## 3. Integrating Meta Providers in Code
1.  Navigate to [providers/meta.ts](file:///c:/Users/ASUS/Documents/SECOND%20SEMISTER/INTERNSHIP/auto-mt/leadgen/dashboard/src/automation/providers/meta.ts).
2.  Replace the mock function bodies in `FacebookProvider`, `InstagramProvider`, `MessengerProvider`, and `WhatsAppCloudProvider` with actual HTTP requests to the Meta Graph endpoint:
    ```typescript
    // Example Facebook Graph Page Publish
    async publishPost(account: ConnectedAccount, post: ScheduledPost) {
      const url = `https://graph.facebook.com/v18.0/${account.platformAccountId}/feed`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: post.content,
          access_token: account.accessToken
        })
      });
      return response.json();
    }
    ```
3.  The providers are registered automatically into the `ProviderRegistry` using the `registerMetaProviders()` initialization hook.
