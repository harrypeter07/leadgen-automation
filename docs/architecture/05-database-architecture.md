# 05. PostgreSQL & Supabase Database Architecture

This document documents every table, column, relationship, index, constraint, Row-Level Security (RLS) policy, and migration script in the PostgreSQL database.

---

## 1. Database Overview & Extensions

- **Database System**: PostgreSQL 15+ (Hosted on Supabase)
- **Primary Schema File**: `supabase/schema.sql`
- **Migration Directory**: `supabase/migrations/`
- **Extensions**:
  - `pgcrypto`: Enables `gen_random_uuid()` for primary keys and cryptographic functions.

---

## 2. Table Specifications

### 1. `leads` Table
- **Purpose**: Core business leads repository extracted from Google Maps, Instagram, and web scrapers.
- **Columns**:

| Column Name | Data Type | Nullable | Default | Constraints & Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | `NOT NULL` | `gen_random_uuid()` | Primary Key |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL` | `now()` | Record creation timestamp |
| `name` | `TEXT` | `NOT NULL` | - | Business / Prospect name |
| `phone` | `TEXT` | `YES` | - | Cleaned phone number |
| `email` | `TEXT` | `YES` | - | Cleaned email address |
| `address` | `TEXT` | `YES` | - | Physical street address |
| `city` | `TEXT` | `YES` | - | Target market city |
| `category` | `TEXT` | `YES` | - | Industry niche (e.g. 'restaurant', 'dentist') |
| `website` | `TEXT` | `YES` | - | Business web URL |
| `rating` | `NUMERIC(2,1)` | `YES` | - | Google Maps rating (1.0 - 5.0) |
| `review_count` | `INTEGER` | `YES` | - | Total Google review count |
| `source` | `TEXT` | `NOT NULL` | `'google_maps'` | Data provenance |
| `status` | `TEXT` | `NOT NULL` | `'new'` | **CHECK Constraint**: `IN ('new', 'whatsapp_sent', 'email_sent', 'replied', 'converted', 'skip')` |
| `whatsapp_sent_at` | `TIMESTAMPTZ` | `YES` | - | Timestamp of WhatsApp outreach |
| `email_sent_at` | `TIMESTAMPTZ` | `YES` | - | Timestamp of Email outreach |
| `last_contacted_at`| `TIMESTAMPTZ` | `YES` | - | Timestamp of last contact |
| `notes` | `TEXT` | `YES` | - | Free-form notes/logs |
| `ai_message_whatsapp`|`TEXT`| `YES` | - | Gemini-generated WhatsApp message |
| `ai_message_email_subject`|`TEXT`|`YES`| - | Gemini-generated Email subject line |
| `ai_message_email_body`|`TEXT`| `YES` | - | Gemini-generated Email HTML body |
| `website_audit_id` | `UUID` | `YES` | - | Foreign Key `REFERENCES website_audits(id)` |
| `instagram_audit_id`|`UUID` | `YES` | - | Foreign Key `REFERENCES instagram_audits(id)` |
| `enrichment_fields`| `JSONB` | `YES` | `'{}'` | Dynamic enriched key-values |
| `tools_tried` | `TEXT[]` | `YES` | `'{}'` | Array of attempted enrichment tools |
| `tools_failed` | `TEXT[]` | `YES` | `'{}'` | Array of failed enrichment tools |
| `enrichment_scratchpad`|`TEXT[]`| `YES` | `'{}'` | LLM scratchpad reasoning logs |
| `enrichment_status`|`TEXT` | `YES` | `'not_started'`| Status of agentic enrichment |
| `confidence_score` | `NUMERIC` | `YES` | `0` | AI lead quality score |

- **Indexes**:
  - `leads_status_idx` on `(status)`
  - `leads_city_idx` on `(city)`
  - `leads_category_idx` on `(category)`
  - `leads_created_at_idx` on `(created_at DESC)`
  - `leads_phone_unique_idx` UNIQUE on `(phone) WHERE phone IS NOT NULL`
  - `leads_enrichment_status_idx` on `(enrichment_status)`

---

### 2. `scrape_jobs` Table
- **Migration**: `20260701000000_create_scrape_jobs.sql`
- **Purpose**: Tracks active and historical Google Maps / Playwright scraping tasks.
- **Columns**:

| Column Name | Data Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `gen_random_uuid()` | Primary Key |
| `created_at` | `TIMESTAMPTZ` | `now()` | Creation time |
| `keyword` | `TEXT NOT NULL` | - | Target niche keyword |
| `city` | `TEXT NOT NULL` | - | Target city |
| `max_leads` | `INTEGER` | `50` | Scraping cap limit |
| `status` | `TEXT NOT NULL` | `'queued'` | **CHECK**: `'queued'`, `'running'`, `'paused'`, `'stopped'`, `'completed'`, `'failed'` |
| `progress` | `INTEGER` | `0` | Leads collected count |
| `current_business`| `TEXT` | - | Name of business currently being scraped |
| `current_provider`| `TEXT` | `'google_maps'` | Source provider |
| `error_count` | `INTEGER` | `0` | Cumulative error count |
| `logs` | `TEXT[]` | `'{}'` | Array of string log messages |
| `worker_count` | `INTEGER` | `1` | Number of parallel worker threads |

---

### 3. `meta_config` Table
- **Purpose**: Key-value runtime store for system configurations and Meta API secrets.
- **Columns**:
  - `key` (`TEXT PRIMARY KEY`)
  - `value` (`TEXT`)
  - `encrypted` (`BOOLEAN DEFAULT false`)
  - `updated_at` (`TIMESTAMPTZ DEFAULT now()`)

---

### 4. `connected_accounts` Table
- **Purpose**: Multi-tenant / Multi-account store for connected Meta Facebook Pages, Instagram Accounts, and WhatsApp lines.
- **Columns**:
  - `id` (`UUID PRIMARY KEY DEFAULT gen_random_uuid()`)
  - `account_name` (`TEXT NOT NULL`)
  - `platform` (`TEXT NOT NULL` - `'instagram' | 'messenger' | 'facebook' | 'whatsapp'`)
  - `encrypted_credentials` (`TEXT NOT NULL` - AES-256-CBC ciphertext `iv:data`)
  - `is_active` (`BOOLEAN DEFAULT true`)
  - `created_at` (`TIMESTAMPTZ DEFAULT now()`)

---

### 5. `website_audits` & `instagram_audits` Tables
- **Migration**: `20260701000001_lead_intelligence_schema.sql`
- **`website_audits`**: `seo_score`, `ux_score`, `performance_score`, `accessibility_score`, `tech_stack` (`JSONB`), `social_links` (`TEXT[]`), `emails` (`TEXT[]`), `phone_numbers` (`TEXT[]`), `screenshot_url`.
- **`instagram_audits`**: `username`, `display_name`, `bio`, `website`, `followers`, `following`, `posts_count`, `health_score`, `engagement_rate`.

---

## 3. Row-Level Security (RLS) Policies

All tables have RLS explicitly enabled:
1. `service_role_all` Policy:
   - `TO service_role`
   - `USING (true) WITH CHECK (true)`
   - Grants complete read/write access to internal services (`backend`, `whatsapp-service`, `n8n`).
2. `anon_read` Policy:
   - `TO anon`
   - `FOR SELECT USING (true)`
   - Allows Next.js dashboard public client queries to read lead data without exposing write capabilities.
