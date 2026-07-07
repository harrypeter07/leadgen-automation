# Webhook Verification & Listener Flow

This document details how Meta webhook verification works and how webhook event logs flow from Meta to n8n to backend.

## 1. Webhook Verification Protocol (GET check)
When you register a webhook URL in the Meta Dashboard, Meta issues a `GET` request with parameters:
- `hub.mode=subscribe`
- `hub.verify_token=<your_verify_token>`
- `hub.challenge=<random_string_challenge>`

Your backend or n8n endpoint must verify that the `verify_token` matches your secret configuration, and return the exact value of `hub.challenge` to verify webhooks.

## 2. Event Delivery Flow (POST payload)
Once verified, Meta POSTs webhook events.

```mermaid
graph TD
  Meta[Meta Graph Webhooks] -->|POST event payload| N8N[n8n Communication Hub]
  N8N -->|Fetch page credentials| Backend[API Backend /credentials]
  Backend -->|Return decrypted token| N8N
  N8N -->|Run Gemini / Classify| AI[Gemini Intelligence API]
  AI -->|Return response template| N8N
  N8N -->|Send Reply| MetaGraphAPI[Meta Graph Message Dispatch]
  N8N -->|Log transaction| SystemAuditLogs[system_audit_logs DB]
```
