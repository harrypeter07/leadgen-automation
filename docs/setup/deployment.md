# Production Deployment Checklist

Follow these steps when bringing the social integration live.

1. **Database Schema Deployment**: Run migrations to initialize the required connected accounts, audit log, and publishing queue tables.
2. **Setup Meta Developer App**: Select "Business" type app, link to portfolio, and generate System User Token.
3. **Configure Railway Service Settings**: Link repository, load environment keys, and verify `/health` responds.
4. **Link Accounts**: Open the Scraper Console Settings UI, select "Link New Account" and fill in System Token, WABA ID, and Page ID.
5. **Verify Connections**: Click **Test Connection** on the settings card, confirm status transitions to `Healthy` and permissions populate.
6. **Import n8n Workflows**: Configure backend endpoints inside n8n global settings and activate workflows.
7. **Webhook registration**: Confirm verify challenge tokens handshake successfully.
