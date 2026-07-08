# Troubleshooting & Meta Error Catalog

Common Graph API error resolutions and troubleshooting strategies.

## 1. Common Meta Graph API Errors

### Error code 190: Invalid OAuth 2.0 Access Token
* **Cause**: Token has expired, been revoked, or password changed.
* **Resolution**: Click **Reconnect** on the dashboard to trigger a token refresh flow.

### Error code 10: Application does not have permissions
* **Cause**: Missing scope authorization (e.g. `pages_messaging` or `instagram_basic`).
* **Resolution**: Reconnect the account and verify all checkboxes are ticked in the Meta authorization popup.

### Error code 368: Temporarily blocked for policy violation
* **Cause**: Spam filter triggered. Sending messages too fast or duplicate content.
* **Resolution**: Put rate-limiting delay between outbound messages (already handled in our workflows by n8n Wait nodes).

---

## 2. Webhook Troubleshooting
* **Challenge handshake fails**: Double check that the Verify Token configured in the Meta developer panel matches exactly with what your backend returns.
* **Events not arriving**: Verify that the Facebook Page is actively subscribed to the app webhooks under **Messenger** → **Webhooks** settings.
