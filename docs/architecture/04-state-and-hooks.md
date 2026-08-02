# 04. State Management & Custom Hooks Architecture

This document details all client-side, server-side, session, local storage, and real-time state management paradigms across the codebase.

---

## 1. State Management Ecosystem Overview

The application utilizes a hybrid state architecture suited for a multi-service SaaS monorepo:

| State Scope | Layer / Mechanism | Managed Data | Persistence / Lifetime |
| :--- | :--- | :--- | :--- |
| **Session Auth State** | HTTP-Only Cookie (`zarss_session`) | Authentication token status (`'true'`) | 30 Days (Browser cookie store) |
| **Active Account State** | Supabase `connected_accounts` table | Active Instagram/Facebook/Messenger account credentials | Database-backed across sessions |
| **Client UI State** | React `useState` & `useReducer` | Form inputs, pagination, active filter pills, loading states | Transient (Component lifecycle) |
| **Local Device State** | Browser `localStorage` | Custom Scraper URLs (`v3_backend_primary`), Gemini Key (`gemini_api_key`), Sidebar collapsed state | Persistent (Device local storage) |
| **Server Database State** | Supabase PostgreSQL Client SDK | Leads records, Scrape jobs, Meta config, Audits, Workflows | Persistent Database |
| **Runtime Config Cache** | Node.js `process.env` Singleton (`runtime-config.ts`) | Meta API keys, tokens, webhook secrets loaded from DB | Process lifetime (In-memory singleton) |
| **WebSocket Socket State** | Baileys WASocket State Machine (`whatsapp-service`) | QR code buffer, connection phase (`qr_waiting`, `connected`), session keys (`/app/.wwebjs_auth`) | File-system + Memory |

---

## 2. Detailed State Breakdown

### 1. Authentication & Cookie Session State
- **Mechanism**: Managed by Next.js `middleware.ts` and `/api/login/route.ts`.
- **Cookie Name**: `zarss_session`
- **Value**: `'true'`
- **Flags**: `HttpOnly: true`, `SameSite: lax`, `Path: /`, `MaxAge: 2592000` (30 days).
- **Validation**: Middleware intercepts every non-whitelisted route. If cookie is missing or not `'true'`, user is redirected to `/login`.

### 2. Connected Meta Account State
- **File**: `dashboard/src/lib/meta/runtime-config.ts` (`getActiveConnectedAccount()`)
- **Database Table**: `connected_accounts`
- **Fields**: `account_name`, `platform`, `encrypted_credentials`, `is_active`
- **Resolution Flow**:
  1. `getActiveConnectedAccount(preferPlatform)` queries Supabase for `is_active = true`.
  2. If found, reads `encrypted_credentials` (`iv_hex:ciphertext_hex`).
  3. Decrypts AES-256-CBC string using key derived from `process.env.ENCRYPTION_KEY` or `WHATSAPP_API_SECRET`.
  4. Returns parsed object containing `pageAccessToken`, `instagramToken`, `pageId`, `instagramBusinessId`.

### 3. Client LocalStorage Keys

| LocalStorage Key | Component / Page | Description |
| :--- | :--- | :--- |
| `v3_backend_primary` | `/scraper` | Overrides default primary backend URL (`https://leadgen-automation-production-12c6.up.railway.app`) |
| `v3_backend_secondary` | `/scraper` | Overrides default secondary backend URL (`https://scraper-auto.up.railway.app`) |
| `gemini_api_key` | `gemini-key-modal.tsx` | Stores user's personal Google Gemini API key for copy generation |
| `sidebar_collapsed` | `layout-client.tsx` | Persists user preference for left sidebar collapse/expand |

### 4. Real-time Live Log Polling State
- **Page**: `/instagram-analyzer`
- **Mechanism**: React `useEffect` interval (1000ms polling).
- **State**: `logs` string array appended with new log lines fetched from `GET /api/instagram-logs`.
- **Cleanup**: Interval is cleared when `auditStatus` transitions to `'completed'` or `'failed'`.

---

## 3. Custom Hooks & Utility Patterns

### 1. Polling Hook Pattern (`useInterval`)
- **Usage**: Used on `/dashboard` and `/whatsapp` for continuous status synchronization.
- **Implementation Pattern**:
  ```typescript
  useEffect(() => {
    let isMounted = true;
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/whatsapp/status');
        const data = await res.json();
        if (isMounted) setStatus(data);
      } catch (err) {
        console.error('Polling error:', err);
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);
  ```

### 2. Supabase Data Fetching Hook Pattern
- **Usage**: Used on `/leads` for paginated server queries.
- **Pattern**:
  ```typescript
  const fetchLeads = useCallback(async (page = 1, statusFilter = 'all', searchQuery = '') => {
    setLoading(true);
    let query = supabase.from('leads').select('*', { count: 'exact' });
    if (statusFilter !== 'all') query = query.eq('status', statusFilter);
    if (searchQuery) query = query.ilike('name', `%${searchQuery}%`);
    
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, count, error } = await query.range(from, to).order('created_at', { ascending: false });
    
    if (!error) {
      setLeads(data || []);
      setTotalCount(count || 0);
    }
    setLoading(false);
  }, []);
  ```

### 3. Meta Credentials Hydration Hook (`ensureMetaConfig`)
- **File**: `dashboard/src/lib/meta/runtime-config.ts`
- **Singleton Locks**: `hydrated` boolean, `hydrating` boolean, `waiters` array.
- **Purpose**: Thread-safe hydration preventing redundant database queries when multiple API route handlers run concurrently.
