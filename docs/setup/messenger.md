# Messenger Platform Configuration Guide

This guide details how to configure Messenger Platform webhooks, message subscriptions, and automate conversational replies.

## 1. Configure Messenger Webhooks
1. In your Meta App Dashboard, click **Add Product** → **Messenger**.
2. Go to **Messenger Settings** → **Webhooks**.
3. Click **Configure**. Input:
   * **Callback URL**: `https://<n8n-domain>/webhook/meta-communication-inbound`
   * **Verify Token**: Choose a secret string (e.g. `zarss_webhook_verify_token`). Save it inside your settings dashboard.
4. Check subscriptions for:
   * `messages`
   * `messaging_postbacks`
   * `messaging_optins`

## 2. Link Page Webhooks Subscription
1. Under **Messenger Settings** → **Pages**, select your Facebook Page.
2. Click **Subscribe** to enable webhook delivery.

## 3. Required Permissions Scope
- `pages_messaging`
- `pages_messaging_subscriptions`
