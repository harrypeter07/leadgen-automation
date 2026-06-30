# n8n Workflows

This folder contains exported n8n workflow JSON files that power the LeadGen automation pipeline.

---

## Self-Hosting n8n on Railway

### 1. Create a new Railway project

1. Go to [railway.app](https://railway.app) and log in.
2. Click **New Project** → **Deploy from Docker Image**.
3. Enter the image: `n8nio/n8n`
4. Railway will automatically detect the exposed port (`5678`).

### 2. Set Environment Variables

In your Railway service dashboard, navigate to **Variables** and add the following:

| Variable | Value | Notes |
|---|---|---|
| `N8N_BASIC_AUTH_ACTIVE` | `true` | Enables HTTP Basic Auth on the n8n UI |
| `N8N_BASIC_AUTH_USER` | `your_username` | Choose a strong username |
| `N8N_BASIC_AUTH_PASSWORD` | `your_password` | Choose a strong password |
| `WEBHOOK_URL` | `https://<your-railway-domain>.up.railway.app/` | Set this to your Railway public domain so webhooks resolve correctly |
| `N8N_HOST` | `0.0.0.0` | Bind to all interfaces inside the container |
| `N8N_PORT` | `5678` | Default n8n port |
| `N8N_PROTOCOL` | `https` | Use HTTPS since Railway provides TLS |

> **Tip:** Railway auto-assigns a public domain like `your-service.up.railway.app`. Copy it from the **Settings → Domains** tab and use it for `WEBHOOK_URL`.

### 3. Persistent Storage (recommended)

n8n stores workflows and credentials in a SQLite database by default. To persist data across deployments:

1. In Railway, add a **Volume** to your n8n service.
2. Mount it at `/home/node/.n8n`.
3. This ensures your workflows survive redeploys.

### 4. Deploy

Click **Deploy** — Railway will pull the Docker image and start n8n. Once the deploy succeeds, visit your Railway domain to access the n8n UI.

---

## Importing a Workflow JSON

1. Open your n8n instance in a browser.
2. Log in with the credentials you set via `N8N_BASIC_AUTH_USER` / `N8N_BASIC_AUTH_PASSWORD`.
3. In the left sidebar, click **Workflows**.
4. Click the **⋮** (three-dot menu) in the top-right corner → **Import from File**.
5. Select the `.json` file from this folder (e.g., `leads-pipeline.json`).
6. The workflow will be imported and ready to activate.
7. Click the **Active** toggle at the top to enable it.

---

## Workflow Files

| File | Description |
|---|---|
| *(workflows added in STEP 3)* | n8n workflows are exported and placed here during STEP 3 setup |

---

## Webhook Endpoint

Once n8n is running, your scraper will POST leads to:

```
https://<your-railway-domain>.up.railway.app/webhook/leads
```

Set this URL in `scraper/.env` as the value of `WEBHOOK_URL`.
