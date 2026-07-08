# Instagram Business Configuration Guide

This guide describes how to convert your Instagram account to a Professional Business profile, link it to your Facebook Page, and retrieve your Instagram Account ID.

## 1. Convert Instagram to Business Profile
1. Open the Instagram App on your phone.
2. Go to **Settings** → **Account Type and Tools** → **Switch to Professional Account**.
3. Choose **Business** (do not select Creator, as Creator accounts have API limitations).

## 2. Link Instagram to Facebook Page
1. Go to your Facebook Page profile.
2. Click **Settings** → **Linked Accounts** → **Instagram**.
3. Log in to your Instagram account to link it.

## 3. Retrieve Instagram Business Account ID
1. In the Meta Developer Dashboard, go to your Business App settings.
2. Go to the **Graph API Explorer** tool.
3. Query `me/accounts?fields=instagram_business_account`.
4. Copy the numeric **Instagram Account ID** returned.

## 4. Required Permission Scopes
- `instagram_basic`
- `instagram_manage_messages` (essential for DMs automation)
- `instagram_content_publish` (needed to schedule post campaigns)
