# WhatsApp Cloud API Configuration Guide

This guide details how to retrieve your WhatsApp Business Account (WABA) credentials, Phone Number ID, and set up message template dispatches.

## 1. Add WhatsApp Product to App
1. Go to the Meta Developer Dashboard.
2. Under **Products**, add **WhatsApp**.

## 2. Retrieve IDs
* **Phone Number ID**: Navigate to **WhatsApp** → **API Setup**. Copy the numeric `Phone Number ID`.
* **WhatsApp Business Account ID (WABA ID)**: Copy the numeric `WhatsApp Business Account ID` from the same tab.

## 3. Required Permissions Scope
- `whatsapp_business_messaging`
- `whatsapp_business_management`

## 4. Hooking WhatsApp to n8n
- Webhook subscriptions must include `messages` callback fields to receive incoming messages to your WABA.
