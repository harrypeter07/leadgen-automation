# Change Log - Business Communication Platform Evolution

Detailed history of all files created and modified to evolve the project into an AI-first Business Communication and Lead CRM Platform.

---

## [Phase 4: final-integration] - 2026-07-06
### Added
*   [providers/meta.ts](file:///c:/Users/ASUS/Documents/SECOND%20SEMISTER/INTERNSHIP/auto-mt/leadgen/dashboard/src/automation/providers/meta.ts): Meta Graph API integration adapters for Facebook, Instagram, Messenger, and WhatsApp Cloud APIs, with self-registration hooks.
*   [jobs/n8n.ts](file:///c:/Users/ASUS/Documents/SECOND%20SEMISTER/INTERNSHIP/auto-mt/leadgen/dashboard/src/automation/jobs/n8n.ts): n8n job dispatcher schemas, payload validations (captioning, publishing, lead extraction), and retry manager models.
*   [docs/change-log.md](file:///c:/Users/ASUS/Documents/SECOND%20SEMISTER/INTERNSHIP/auto-mt/leadgen/dashboard/docs/change-log.md): Documentation log.
*   [docs/final-audit.md](file:///c:/Users/ASUS/Documents/SECOND%20SEMISTER/INTERNSHIP/auto-mt/leadgen/dashboard/docs/final-audit.md): Architecture audit verifying backward compatibility.
*   [docs/meta-readiness.md](file:///c:/Users/ASUS/Documents/SECOND%20SEMISTER/INTERNSHIP/auto-mt/leadgen/dashboard/docs/meta-readiness.md): Meta App setup developer playbook.
*   [docs/n8n-readiness.md](file:///c:/Users/ASUS/Documents/SECOND%20SEMISTER/INTERNSHIP/auto-mt/leadgen/dashboard/docs/n8n-readiness.md): n8n node settings and webhook setup guide.

---

## [Phase 3: domain-layer] - 2026-07-06
### Added
*   [types/states.ts](file:///c:/Users/ASUS/Documents/SECOND%20SEMISTER/INTERNSHIP/auto-mt/leadgen/dashboard/src/automation/types/states.ts): Transition enums and permission rules.
*   [domain/entities.ts](file:///c:/Users/ASUS/Documents/SECOND%20SEMISTER/INTERNSHIP/auto-mt/leadgen/dashboard/src/automation/domain/entities.ts): Pure domain business logic validations (leads scoring, conversations transitions, workspaces).
*   [events/EventBus.ts](file:///c:/Users/ASUS/Documents/SECOND%20SEMISTER/INTERNSHIP/auto-mt/leadgen/dashboard/src/automation/events/EventBus.ts): Pub/sub Event Bus enabling decoupled communication.
*   [providers/ProviderRegistry.ts](file:///c:/Users/ASUS/Documents/SECOND%20SEMISTER/INTERNSHIP/auto-mt/leadgen/dashboard/src/automation/providers/ProviderRegistry.ts): Central Registry mapping active third-party adapters.
*   [webhooks/interfaces.ts](file:///c:/Users/ASUS/Documents/SECOND%20SEMISTER/INTERNSHIP/auto-mt/leadgen/dashboard/src/automation/webhooks/interfaces.ts): verification token verify signatures.
*   [observability/observability.ts](file:///c:/Users/ASUS/Documents/SECOND%20SEMISTER/INTERNSHIP/auto-mt/leadgen/dashboard/src/automation/observability/observability.ts): structured audit, metrics logging wrapper.

---

## [Phase 2: page-placeholders] - 2026-07-06
### Added
*   `dashboard/src/app/automation/crm/page.tsx`: Lead pipeline columns Kanban dashboard.
*   `dashboard/src/app/automation/campaigns/page.tsx`: Outreach scheduler, segments and throttling limits.
*   `dashboard/src/app/automation/inbox/page.tsx`: Inbox with inline CRM editor drawer and AI reply suggestions.
*   `dashboard/src/app/automation/layout.tsx`: Slack/Linear sidebar workspace swapper template.
*   API routes stubs under `/api/automation/...`.
