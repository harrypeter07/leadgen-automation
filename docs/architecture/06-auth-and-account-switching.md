# 06. Authentication & Account Switching Mechanics

This document details the internal workings of dashboard authentication, API security middleware, session token lifecycle, and Meta account switching mechanics.

---

## 1. Authentication Engine Architecture

The dashboard relies on an HTTP-only cookie session authentication architecture designed for single-tenant admin operation.

```
[ Unauthenticated Browser Request ]
               │
               ▼
   [ dashboard/src/middleware.ts ]
               │
      Is path in Whitelist?
         ├── YES ──► Pass request through to Route / Page Handler
         └── NO ───► Check cookie 'zarss_session' == 'true'
                         ├── YES ──► Pass request through
                         └── NO ───► Redirect to /login (307)
```

---

## 2. Authentication Whitelist & API Middleware

### Whitelist Engine (`dashboard/src/middleware.ts`)
To prevent unauthenticated POST requests from external workflow engines (n8n, webhook callers, background workers) from failing with 405 or 307 redirects, explicit route prefixes bypass session cookie verification:

```typescript
pathname.startsWith('/_next') ||
pathname.startsWith('/api/email/send') ||
pathname.startsWith('/api/login') ||
pathname.startsWith('/api/meta') ||            // Meta Graph API & Webhook handlers
pathname.startsWith('/api/automation') ||      // Automation pipeline controllers
pathname.startsWith('/api/backend-v3') ||      // V3 scraper backend proxy
pathname.startsWith('/api/scraper') ||         // Scraper control proxy
pathname.startsWith('/api/instagram-audit') ||   // Dedicated Instagram audit route
pathname.startsWith('/api/instagram-logs') ||    // Dedicated log streaming route
pathname.startsWith('/api/agent-brain') ||      // Gemini agent brain proxy
pathname.startsWith('/automation') ||
pathname.startsWith('/favicon.ico') ||
pathname.startsWith('/fonts') ||
pathname === '/login'
```

---

## 3. Login & Session Lifecycle

### Login Flow (`POST /api/login`)
1. User enters password on `/login`.
2. Request payload `{ password }` sent to `POST /api/login`.
3. Route handler compares payload against `process.env.DASHBOARD_PASSWORD` (fallback value: `'wrongpassword'`).
4. If valid, handler constructs JSON response and sets HTTP-only cookie:
   - `Name`: `zarss_session`
   - `Value`: `'true'`
   - `Path`: `/`
   - `HttpOnly`: `true`
   - `Secure`: `true` in production (`process.env.NODE_ENV === 'production'`)
   - `SameSite`: `'lax'`
   - `MaxAge`: `2592000` (30 days)

### Logout Flow (`POST /api/logout`)
1. User clicks Logout in header.
2. Route handler executes `response.cookies.delete('zarss_session')`.
3. Client navigates to `/login`.

---

## 4. Deep-Dive: Account Switching Internal Mechanics

The system supports switching between multiple connected Facebook Pages, Instagram Business Accounts, and WhatsApp lines stored in Supabase.

### 1. Account Schema & Storage (`connected_accounts`)
Accounts are registered in the `connected_accounts` table:
- `id`: Unique account identifier (UUID).
- `account_name`: Human-readable label (e.g. "Primary Instagram - SMRITI").
- `platform`: `'instagram' | 'messenger' | 'facebook' | 'whatsapp'`.
- `encrypted_credentials`: Ciphertext string formatted as `iv_hex:ciphertext_hex`.
- `is_active`: Boolean flag indicating if this account is currently active.

### 2. Encryption & Decryption Pipeline
Credentials (Access Tokens, Page IDs, Business IDs) are encrypted at rest using AES-256-CBC encryption:

```typescript
function decryptBackendCreds(encryptedText: string): string {
  if (!encryptedText || !encryptedText.includes(':')) return ''
  const rawKey = process.env.ENCRYPTION_KEY
    || process.env.WHATSAPP_API_SECRET
    || 'antigravity_fallback_encryption_key_32_bytes_long'
  const derivedKey = crypto.createHash('sha256').update(rawKey).digest()
  const parts = encryptedText.split(':')
  const iv = Buffer.from(parts.shift() || '', 'hex')
  const ciphertext = Buffer.from(parts.join(':'), 'hex')
  const decipher = crypto.createDecipheriv('aes-256-cbc', derivedKey, iv)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}
```

### 3. Active Account Resolution (`getActiveConnectedAccount()`)
When an automated action or Graph API call is initiated:
1. `getActiveConnectedAccount(preferPlatform)` is invoked in `dashboard/src/lib/meta/runtime-config.ts`.
2. Executes Supabase query:
   ```sql
   SELECT account_name, platform, encrypted_credentials, is_active 
   FROM connected_accounts 
   WHERE is_active = true AND platform = :preferPlatform 
   LIMIT 1;
   ```
3. Decrypts `encrypted_credentials` JSON object.
4. Maps credential keys:
   - `pageAccessToken`: `creds.page_access_token`
   - `instagramToken`: `creds.instagram_access_token`
   - `pageId`: `creds.page_id`
   - `instagramBusinessId`: `creds.instagram_business_id`
5. If no active row exists in `connected_accounts`, falls back to loading global process environment variables populated from `meta_config`.

### 4. Account Switching Function Workflow
To switch accounts via Settings UI or API:
1. Client calls `POST /api/automation/accounts/switch` with `{ accountId }`.
2. Database Transaction / Mutation:
   - Step A: `UPDATE connected_accounts SET is_active = false WHERE platform = target_platform;`
   - Step B: `UPDATE connected_accounts SET is_active = true WHERE id = accountId;`
3. Cache Invalidation: Calls `invalidateMetaConfig()` in `runtime-config.ts` to reset the in-memory `hydrated` flag.
4. Subsequent Graph API requests immediately pick up credentials for the new active account.

### 5. Failure Modes & Fallback Hierarchy

| Failure Scenario | Internal Detection | Recovery / Fallback Behavior |
| :--- | :--- | :--- |
| **Decryption Key Mismatch** | `decryptBackendCreds` throws exception or returns empty string | Returns `null`; system falls back to `meta_config` DB keys. |
| **No Active Account Set** | Query returns 0 rows | System falls back to default `process.env` / `meta_config` keys. |
| **Token Expired (Graph API 190)** | Meta API returns subcode `463` or `467` | `retry-handler.ts` catches error, attempts long-lived token refresh via `oauth-service.ts`. |
| **Multiple Active Flags** | Database anomaly | Query uses `.limit(1)` order by `created_at DESC` to deterministically select one. |
