# 07. Meta Graph API & Social Integrations Architecture

This document documents Meta Graph API integrations (`dashboard/src/lib/meta/`), covering Facebook, Instagram, Messenger, OAuth flows, token refreshes, webhooks, and retry handlers.

---

## 1. Meta Integration Architecture (`dashboard/src/lib/meta/`)

The system encapsulates all Meta Graph API interactions inside specialized service modules:

```
dashboard/src/lib/meta/
├── meta-client.ts           # Centralized Graph API HTTP client with auto-auth & error wrapping
├── instagram-service.ts     # Instagram Graph API (Publishing, Media, Comments, Business Insights)
├── facebook-service.ts      # Facebook Page API (Posts, Feed, Page Insights, Lead Ads)
├── messenger-service.ts     # Facebook Messenger Send/Receive API & Send API payload builders
├── oauth-service.ts         # Meta OAuth 2.0 Token Exchange & Long-lived Token Renewal
├── webhook-service.ts       # Meta Webhook verification & signature validation
├── meta-settings-service.ts # DB CRUD for Meta credentials stored in meta_config
├── meta-logger.ts           # Audit logging for Graph API calls
├── retry-handler.ts         # Exponential backoff & rate limit handling (Code 4 / 17 / 32)
├── chat-memory.ts           # Conversation history persistence for Meta messaging bots
└── runtime-config.ts        # Runtime credential loader & account switcher
```

---

## 2. Meta OAuth 2.0 & Token Renewal Lifecycle (`oauth-service.ts`)

### 1. OAuth Authorization Flow
1. **Initiation**: App directs user to Meta Authorization URL:
   `https://www.facebook.com/v19.0/dialog/oauth`
2. **Scopes Requested**:
   - `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`
   - `instagram_basic`, `instagram_content_publish`, `instagram_manage_comments`, `instagram_manage_insights`
   - `pages_messaging`
3. **Callback & Code Exchange**:
   - Meta redirects to `/api/meta/oauth/callback` with `code`.
   - `oauth-service.ts` posts code to `https://graph.facebook.com/v19.0/oauth/access_token` with `client_id` and `client_secret`.
   - Obtains Short-Lived User Access Token (valid ~1-2 hours).

### 2. Long-Lived Token Exchange
To prevent session drops, `exchangeForLongLivedToken()` immediately exchanges short-lived tokens for 60-day Long-Lived Access Tokens:
```typescript
GET https://graph.facebook.com/v19.0/oauth/access_token?
    grant_type=fb_exchange_token&
    client_id={APP_ID}&
    client_secret={APP_SECRET}&
    fb_exchange_token={SHORT_LIVED_TOKEN}
```

### 3. Page & Instagram Business Token Acquisition
1. With the User Long-Lived Token, queries `GET /me/accounts` to retrieve all managed Facebook Pages and Page Access Tokens.
2. Queries `GET /{page-id}?fields=instagram_business_account` to obtain linked Instagram Business Account IDs.
3. Credentials are saved encrypted into `connected_accounts` and `meta_config`.

---

## 3. Instagram Service Capabilities (`instagram-service.ts`)

- **Profile & Business Discovery**: Queries `GET /{ig-user-id}?fields=username,name,biography,followers_count,follows_count,media_count,profile_picture_url,website`.
- **Container-Based Media Publishing**:
  - **Step 1 (Create Container)**:
    `POST /{ig-user-id}/media?image_url={URL}&caption={TEXT}`
  - **Step 2 (Status Check)**:
    `GET /{container-id}?fields=status_code` (Waits for `FINISHED`).
  - **Step 3 (Publish)**:
    `POST /{ig-user-id}/media_publish?creation_id={container-id}`.
- **Carousel & Reel Publishing**: Supports multi-item container creation for carousel posts and video container creation for Reels.
- **Insights & Metrics**: Queries `GET /{ig-user-id}/insights?metric=impressions,reach,profile_views` over specified date ranges.

---

## 4. Webhook Event Processing (`webhook-service.ts`)

Meta webhooks send real-time notifications for incoming messages, comments, and lead ads.

### 1. Webhook Verification (GET Handler)
When configuring webhooks in Meta App Dashboard, Meta sends a GET verification challenge:
- Handler checks `hub.mode === 'subscribe'` and `hub.verify_token === process.env.META_VERIFY_TOKEN`.
- Returns `hub.challenge` string with HTTP 200.

### 2. Signature Validation (POST Handler)
To prevent forged requests, `validateSignature()` checks the `x-hub-signature-256` HTTP header:
1. Computes HMAC SHA-256 digest of raw request body using `process.env.META_APP_SECRET`.
2. Compares signature using `crypto.timingSafeEqual()`.
3. Rejects invalid requests with HTTP 403.

---

## 5. Rate Limiting & Retry Architecture (`retry-handler.ts`)

Meta Graph API enforces rate limits tracked via response headers (`x-app-usage`, `x-page-usage`).

### Error Subcodes Handled:
- **Code 4 / 17 / 32**: User/App rate limit reached.
- **Code 190**: Access token expired or invalidated.

### Exponential Backoff Execution:
```typescript
export async function withMetaRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 1000
): Promise<T> {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;
      if (attempt >= maxRetries || !isRetryableMetaError(err)) throw err;
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      console.warn(`[MetaRetry] Attempt ${attempt} failed. Retrying in ${delay}ms...`);
      await new Promise(res => setTimeout(res, delay));
    }
  }
  throw new Error('[MetaRetry] Maximum retries exceeded');
}
```
