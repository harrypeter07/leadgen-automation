# AI Email Outreach Workflow Setup Guide

This guide explains how to import and configure the unified AI Email Outreach workflow in your n8n instance.

---

## 1. Import Workflow JSON
1. Open your n8n dashboard.
2. In the left sidebar, click **Workflows** → **Add Workflow** (or open an existing canvas).
3. Click the **⋮** (three-dot menu) in the top-right corner of the canvas → **Import from File**.
4. Select the [email-outreach.json](file:///c:/Users/ASUS/Documents/SECOND%20SEMISTER/INTERNSHIP/auto-mt/leadgen/n8n-workflows/email-outreach.json) file.
5. The workflow with its two separate webhook triggers (`Webhook Generate` and `Webhook Send`) will load onto the canvas.

---

## 2. Configure Environment Variables
Ensure the following variables are set on your n8n self-hosted instance (e.g., in your Railway service dashboard variables list):

| Variable Name | Description | Example / Fallback Value |
|---|---|---|
| `SUPABASE_URL` | Your Supabase Project API URL | `https://nefgezqgrfvqegmduzce.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Secret Key (bypasses RLS) | *Verify in your Supabase panel* |
| `GEMINI_API_KEY` | Gemini API Key for content generation | *Verify in your credentials* |
| `WHATSAPP_SERVICE_URL` | Root URL of this workspace's backend service | `https://leadgen-automation-production.up.railway.app` |
| `WHATSAPP_API_SECRET` | Backend API Secret key for secure validation | *Verify in your configuration* |

---

## 3. Workflow Endpoints
Once activated, n8n will expose two public webhook endpoints:
- **Generate Drafts Webhook**:
  `POST https://<your-n8n-domain>/webhook/email-outreach/generate`
- **Send Emails Webhook**:
  `POST https://<your-n8n-domain>/webhook/email-outreach/send`

*Note: The Next.js dashboard and Express backend automatically proxy requests to these endpoints using the configured `N8N_WEBHOOK_BASE_URL` in `.env.local`.*
