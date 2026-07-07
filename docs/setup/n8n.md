# n8n Workflow Hosting Guide

This guide describes how to configure your self-hosted n8n workflows statefully without placing credentials inside them.

## 1. Hosting Principles (No Hardcoded Secrets)
Workflows must **never** contain passwords, system tokens, or app secrets.
Instead, all nodes reference two global environment variables:
- `BACKEND_URL`: URL to your deployed API server (e.g., `https://backend.up.railway.app`).
- `API_SECRET`: Internal signature token matching the backend `WHATSAPP_API_SECRET` variable.

## 2. Importing Workflows JSON
1. Open your n8n workspace UI.
2. In the sidebar, click **Workflows** → **Add Workflow** → **Import from File**.
3. Select the 4 JSON configs from this project:
   * `communication-hub.json`
   * `publishing-hub.json`
   * `sync-monitoring-hub.json`
   * `system-dispatcher.json`
4. Activate the switches.
