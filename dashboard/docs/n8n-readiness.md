# n8n Workflow Orchestration Integration Guide

This guide details how to link the platform's job queue dispatchers directly with n8n workflow triggers.

---

## 1. Vision & Workflow Isolation
*   **The Application**: Responsible for logging jobs, storing execution states, compiling calendars, showing UI pages, and validating inputs.
*   **n8n**: Responsible for running automation logic, fetching third-party templates, querying CRM tables, and issuing retry updates.

---

## 2. Ingesting Jobs in n8n
1.  Configure a webhook node in your n8n workflow listening for `POST` payloads on a dedicated endpoint.
2.  Add a route or configuration pointing to this webhook URL inside [jobs/n8n.ts](file:///c:/Users/ASUS/Documents/SECOND%20SEMISTER/INTERNSHIP/auto-mt/leadgen/dashboard/src/automation/jobs/n8n.ts) (e.g. `n8nWebhookUrl`).
3.  The application will dispatch structured JSON jobs:
    ```json
    {
      "id": "job-1029",
      "jobType": "publish_content",
      "payload": {
        "content": "Singapore Cafe Redesign Pitch",
        "platforms": ["facebook", "instagram"],
        "mediaUrls": ["https://storage.com/mock.png"]
      }
    }
    ```

---

## 3. Returning Results to the Application
Once the n8n node finishes executing, it must notify the application of the success or error log by making an HTTP POST request to:
`https://<your-domain>/api/automation/workflows` (or a dedicated job status API endpoint) carrying the `JobResult` body:
```json
{
  "jobId": "job-1029",
  "status": "success",
  "outputData": {
    "platformPostId": "fb_post_90823149028"
  }
}
```
Or in case of errors:
```json
{
  "jobId": "job-1029",
  "status": "error",
  "errorMessage": "Rate limit exceeded. Token suspended."
}
```
The application will catch this payload inside the `handleJobResult()` wrapper, update state machine transitions, log results in the Activity Feed, and schedule retries if necessary.
