# Meta Graph API Endpoints Reference

This guide catalogs the exact Graph API paths, HTTP methods, and payload structures called by the backend and workflows.

## 📋 Graph API Reference Directory

### 1. Send Messenger / Instagram DM Message
* **Endpoint**: `POST /v19.0/me/messages`
* **Headers**: `Content-Type: application/json`
* **Query Parameters**: `access_token=<PAGE_ACCESS_TOKEN>`
* **Payload**:
  ```json
  {
    "recipient": { "id": "<RECIPIENT_PAGE_SCOPED_ID>" },
    "message": { "text": "Hello, how can we help you today?" }
  }
  ```

### 2. Retrieve Messenger / Instagram Conversation Thread
* **Endpoint**: `GET /v19.0/{conversation_id}?fields=messages{message,from,to,created_time}`
* **Query Parameters**: `access_token=<PAGE_ACCESS_TOKEN>`

### 3. Retrieve Page Comments (Facebook / Instagram)
* **Endpoint**: `GET /v19.0/{object_id}/comments`
* **Query Parameters**: `access_token=<PAGE_ACCESS_TOKEN>`

### 4. Create Facebook Feed Post
* **Endpoint**: `POST /v19.0/{page_id}/feed`
* **Payload**:
  ```json
  {
    "message": "Campaign post content",
    "access_token": "<PAGE_ACCESS_TOKEN>"
  }
  ```

### 5. Instagram Media Container Upload
* **Endpoint**: `POST /v19.0/{instagram_business_id}/media`
* **Payload**:
  ```json
  {
    "image_url": "<IMAGE_ASSET_URL>",
    "caption": "Instagram post caption",
    "access_token": "<PAGE_ACCESS_TOKEN>"
  }
  ```

### 6. Instagram Media Container Publish
* **Endpoint**: `POST /v19.0/{instagram_business_id}/media_publish`
* **Payload**:
  ```json
  {
    "creation_id": "<CONTAINER_CREATION_ID>",
    "access_token": "<PAGE_ACCESS_TOKEN>"
  }
  ```

### 7. Retrieve Analytics Page Insights
* **Endpoint**: `GET /v19.0/{page_id}/insights?metric=page_impressions,page_engagements`
* **Query Parameters**: `access_token=<PAGE_ACCESS_TOKEN>`

### 8. Send WhatsApp Text Message
* **Endpoint**: `POST /v19.0/{phone_number_id}/messages`
* **Payload**:
  ```json
  {
    "messaging_product": "whatsapp",
    "to": "<PHONE_NUMBER>",
    "type": "text",
    "text": { "body": "WhatsApp text body content" }
  }
  ```
