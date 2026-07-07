# n8n Workflow Design & Pipeline Documentation

This page details the specifications, execution boundaries, retry strategies, and error catching layers for each of the 4 production workflows.

---

## 1. Communication Hub
* **Trigger**: `Meta Webhook Trigger` Node (inbound POST listener).
* **Inputs**: JSON POST webhook payload containing Meta events message details.
* **Outputs**: Returns a verification challenge handshake (`GET`) or response success metadata (`POST`).
* **Variables**:
  * `{{ $env.BACKEND_URL }}`: Express API endpoint.
  * `{{ $env.API_SECRET }}`: Internal security header.
* **Retry Logic**: HTTP request nodes set to 3 retry attempts with a 3000ms delay.
* **Error Handling**: Catches unhandled exceptions and routes them to the `/api/logs` database logs endpoint.
* **Related API Endpoints**:
  * `POST /api/automation/accounts/credentials`: loads connection tokens.
  * `POST /api/workflows/orchestrate`: executes outreach pipelines.

---

## 2. Publishing Hub
* **Trigger**: `Poll Queue Trigger` Node (Schedule trigger every 5 minutes).
* **Inputs**: Queries scheduled content rows from database table.
* **Outputs**: Dispatches posts to Facebook Page Feed or Instagram Container Publishing API.
* **Variables**:
  * `{{ $json.page_id }}` / `{{ $json.instagram_id }}`: Target IDs.
  * `{{ $json.access_token }}`: Decrypted page token.
* **Retry Logic**: Re-attempts publication on transient error responses (maximum 3 retries).
* **Error Handling**: Upon absolute failure, marks queue status to `failed` and saves error log in Supabase.
* **Related API Endpoints**:
  * `GET /api/automation/workflows/publish/queue`: queries queue items.
  * `POST /api/automation/workflows/publish/queue/callback`: reports completion status.

---

## 3. Sync & Monitoring Hub
* **Trigger**: `Interval Trigger` Node (Schedule trigger every 1 hour).
* **Inputs**: Connected accounts list.
* **Outputs**: Triggers verification check and insights metrics sync.
* **Related API Endpoints**:
  * `POST /api/automation/accounts/:id/test`: triggers health diagnostics checks.
  * `POST /api/analytics/sync`: saves engagement metrics records.

---

## 4. System Dispatcher
* **Trigger**: `Webhook Trigger Node` (POST input from UI actions).
* **Inputs**: Action descriptors (e.g. `manual_outbound`, `retry_job`).
* **Outputs**: Directs downstream routing flow.
* **Related API Endpoints**:
  * `POST /api/workflows/orchestrate`: initiates campaigns outreach.
