# Credentials Manager & Environment Variables Mappings

This page details every single credential token required for the Meta, Facebook, Instagram, Messenger, WhatsApp, Gemini, and n8n integrations.

## 🔑 Credentials Directory Mappings Table

| Credential Name | Service | Where to Obtain It | Where to Paste It | What it is Used For | Expiry & Rotation Behavior |
|---|---|---|---|---|---|
| `META_APP_ID` | Meta App | Meta App Dashboard → Basic Settings | `meta_credentials.txt` / Backend `.env` | Identifies the Meta App for Graph API requests | Permanent; no rotation required. |
| `META_APP_SECRET` | Meta App | Meta App Dashboard → Basic Settings | `meta_credentials.txt` / Backend `.env` (Encrypted in DB) | Signs Graph API calls and validates Webhook events | Permanent; rotate if secret is leaked. |
| `META_VERIFY_TOKEN` | Webhook | Custom defined text string (e.g. `FLOWFYP_VERIFY_TOKEN`) | Meta Webhooks Setup / Settings UI | Verification handshake between Meta and n8n webhooks | Permanent; manual rotate if needed. |
| `META_WEBHOOK_SECRET` | Webhook | Meta Webhooks Setup → App Settings | `meta_credentials.txt` / Backend `.env` | Signing key for payload message signature hashes | Permanent; rotates on app regeneration. |
| `META_PAGE_ID` | Facebook Page | Facebook Page About → Page Transparency | Settings UI / `meta_credentials.txt` | Identifies Facebook business page targets | Permanent. |
| `META_PAGE_ACCESS_TOKEN` | Facebook Page | Meta App Dashboard / OAuth callback | Settings UI / `meta_credentials.txt` (Encrypted in DB) | Authorizes Graph API operations on Page feed | Standard user tokens expire in 60 days. System user tokens are permanent. |
| `INSTAGRAM_BUSINESS_ID` | Instagram | Meta Graph API Explorer: `me/accounts` | Settings UI / `meta_credentials.txt` (Encrypted in DB) | Identifies target IG Business Account profile | Permanent. |
| `WHATSAPP_PHONE_NUMBER_ID`| WhatsApp Cloud | Meta App Dashboard → WhatsApp Setup | Settings UI / `meta_credentials.txt` (Encrypted in DB) | Identifies outbound phone connection nodes | Permanent. |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | WhatsApp Cloud | Meta App Dashboard → WhatsApp Setup | Settings UI / `meta_credentials.txt` (Encrypted in DB) | Identifies WhatsApp Business (WABA) container | Permanent. |
| `WHATSAPP_PERMANENT_TOKEN`| WhatsApp Cloud | Meta Business Manager → System Users | Settings UI / `meta_credentials.txt` (Encrypted in DB) | Permanent authorization token to send messages | Long-lived / permanent; never expires. |
| `GEMINI_API_KEY` | Gemini AI | Google AI Studio Developer Console | Backend `.env` | Authorizes AI personalizations and classifiers | Permanent; rotate if leaked. |
| `N8N_BASE_URL` | n8n | Deployed n8n instance domain | Backend `.env` / Webhooks Setup | Router target for outbound workflow calls | Permanent. |
| `DATABASE_URL` | Supabase | Supabase Project Settings → Database | Backend `.env` | PostgreSQL database connection string | Permanent. |
| `ENCRYPTION_KEY` | Cryptography | Generate 32-character key | Backend `.env` | Symmetric key for database secrets encryption | Permanent. |
