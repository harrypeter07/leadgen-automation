# Environment Variables Reference Table

Configure the following parameters inside your Railway Node service variables dashboard.

| Variable | Scope / Purpose | Required Value / Format |
|---|---|---|
| `DATABASE_URL` | PostgreSQL Database Connection string | `postgresql://user:pass@host:port/db` |
| `ENCRYPTION_KEY` | Symmetric key for AES-256 database credentials encryption | 32-character string |
| `WHATSAPP_API_SECRET` | System-to-system auth token for n8n to fetch credentials | Secure token hash |
| `GEMINI_API_KEY` | Gemini AI response engine access key | Gemini Developer token |
| `PORT` | Local service port binding | `3001` (default) |
