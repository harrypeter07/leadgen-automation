# Webhook Subscriptions & Event Configuration

This guide details every subscribed webhook field required on your Meta Developer App panel to receive real-time social events in n8n.

## 📋 Webhooks Field checklist

Ensure the following checkboxes are enabled in your Meta App Dashboard Webhook Subscriptions configuration:

### 1. Facebook Page Webhooks (`page` object)
* **`feed`**:
  * **What it is**: Fires when a post, photo, or status is added to the Page timeline.
  * **Used for**: Monitoring timeline comments and posts for automated replies.
* **`messages`**:
  * **What it is**: Fires when someone sends a private message to your Page.
  * **Used for**: Direct Messenger conversation responder bot automation.
* **`messaging_postbacks`**:
  * **What it is**: Fires when user clicks custom quick-reply buttons inside Messenger.
  * **Used for**: Flow triggers and workflow routing.
* **`messaging_reads`**:
  * **What it is**: Fires when a user reads a sent message.
  * **Used for**: Mark conversations as read and update CRM thread status.
* **`message_echoes`**:
  * **What it is**: Fires when a Page agent sends a message (echoes the message sent).
  * **Used for**: Keeping conversation thread history in sync.

### 2. Instagram Webhooks (`instagram` object)
* **`instagram_messages`**:
  * **What it is**: Fires when someone sends an Instagram DM to your business profile.
  * **Used for**: Automating Instagram DMs responders.
* **`instagram_comments`**:
  * **What it is**: Fires when a user comments on your feed posts or Reels.
  * **Used for**: Triggering lead auto-outreach workflows.
* **`mentions`**:
  * **What it is**: Fires when a user tags your account in a post or comment.
  * **Used for**: Tracking public brand mentions.

### 3. WhatsApp Cloud API Webhooks (`whatsapp_business_account` object)
* **`messages`**:
  * **What it is**: Fires when someone sends a WhatsApp message to your Phone Number ID.
  * **Used for**: Triggering automated conversational follow-ups.
