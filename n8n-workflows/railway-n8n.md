# Deploying n8n on Railway — Step-by-Step

Follow these steps to run n8n 24/7 on Railway with all LeadGen environment variables configured.

---

## 1. Create a new Railway project

1. Go to [railway.app](https://railway.app) and sign in.
2. Click **New Project** in the top-right.
3. Select **Deploy from Docker Image**.
4. Enter the image name: `n8nio/n8n:latest`
5. Click **Deploy**.

Railway will pull the image and start a container. The default n8n port is **5678**.

---

## 2. Expose port 5678

1. Open your new n8n service in the Railway dashboard.
2. Go to **Settings** → **Networking**.
3. Click **Generate Domain** (or **Add Public Domain**).
4. Copy the public URL — e.g. `https://your-n8n-service.up.railway.app`.
5. Under **Port**, confirm the service exposes **5678**.

---

## 3. Set environment variables

1. In your n8n service, open the **Variables** tab.
2. Click **New Variable** and add each of the following:

| Variable | Value | Notes |
|---|---|---|
| `N8N_BASIC_AUTH_ACTIVE` | `true` | Protects the n8n UI with login |
| `N8N_BASIC_AUTH_USER` | *(choose a username)* | e.g. `admin` |
| `N8N_BASIC_AUTH_PASSWORD` | *(choose a strong password)* | Save this — you'll need it to log in |
| `N8N_HOST` | `0.0.0.0` | Bind to all interfaces inside the container |
| `N8N_PORT` | `5678` | Default n8n port |
| `N8N_PROTOCOL` | `https` | Railway provides HTTPS on the public domain |
| `WEBHOOK_URL` | `https://YOUR_N8N_RAILWAY_URL` | Use your Railway domain from step 2 (no trailing slash) |
| `SUPABASE_URL` | *(from Supabase)* | Project Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | *(from Supabase)* | Project Settings → API → service_role key (secret!) |
| `GEMINI_API_KEY` | *(from Google AI Studio)* | [aistudio.google.com](https://aistudio.google.com/) |
| `RESEND_API_KEY` | *(from resend.com)* | API Keys section in Resend dashboard |
| `WHATSAPP_SERVICE_URL` | `https://YOUR_WHATSAPP_RAILWAY_URL` | Public URL of the whatsapp-service on Railway |
| `WHATSAPP_API_SECRET` | *(same as whatsapp-service `.env`)* | Must match `API_SECRET` in whatsapp-service |

3. Click **Deploy** (or wait for Railway to redeploy automatically after saving variables).

---

## 4. Add persistent storage (volume)

Without a volume, workflows and credentials are lost on every redeploy.

1. In the n8n service dashboard, click **Volumes** (or **Add Volume**).
2. Create a new volume.
3. Set the **mount path** to: `/home/node/.n8n`
4. Attach the volume to your n8n service.
5. Redeploy if prompted.

---

## 5. Import LeadGen workflows

1. Open your n8n public URL in a browser: `https://YOUR_N8N_RAILWAY_URL`
2. Log in with `N8N_BASIC_AUTH_USER` / `N8N_BASIC_AUTH_PASSWORD`.
3. Click **Workflows** in the left sidebar.
4. Click the **⋮** menu (top-right) → **Import from File**.
5. Import each JSON from the `n8n-workflows/` folder:
   - `lead-intake.json`
   - `ai-personalise.json`
   - `outreach.json`
6. Open each workflow and toggle **Active** (top-right) to enable scheduled runs.

---

## 6. Verify webhook URL

After importing `lead-intake.json`, open the workflow and check the **Receive Lead** webhook node. The production URL should be:

```
https://YOUR_N8N_RAILWAY_URL/webhook/leads
```

Set this as `WEBHOOK_URL` in `scraper/.env`.

---

## 7. Test end-to-end

1. Run the scraper with `--send` to POST a test lead.
2. Wait for the AI personalisation workflow (runs every 5 minutes, or trigger manually).
3. Confirm `ai_message_whatsapp` is populated in Supabase.
4. Manually trigger the **Outreach Pipeline** workflow.
5. Confirm WhatsApp message received and email sent.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Webhook returns 404 | Check `WEBHOOK_URL` matches your Railway domain; workflow must be **Active** |
| Supabase 401 | Verify `SUPABASE_SERVICE_ROLE_KEY` (not anon key) |
| WhatsApp send fails | Check `WHATSAPP_SERVICE_URL/health` — scan QR if `whatsapp_ready: false` |
| Workflows disappear after redeploy | Add volume at `/home/node/.n8n` |
