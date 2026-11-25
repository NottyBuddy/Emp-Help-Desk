# Employee Help Desk

Responsive Employee Help Desk preview with a shared Cloudflare D1 backend foundation.

## Current state
- Static preview remains available at https://nottybuddy.github.io/Emp-Help-Desk/
- Existing browser-local CRUD remains active until a workspace access key is configured.
- New additive D1 tables are defined in `helpdesk-schema.sql`; they do not drop or modify legacy tables.
- Worker API routes support workspace-scoped requests, articles, FAQs, guides, team records, overview counts, and request notifications.
- API routes fail closed unless both `HELP_DESK_ACCESS_KEY` and `WORKSPACE_ID` Worker secrets/vars are configured.
- The browser UI does not expose private shared data yet. This is deliberate: no login screen was requested, and a public static page must not contain a private workspace credential.

## Required Cloudflare configuration before shared mode
Set Worker secret `HELP_DESK_ACCESS_KEY` to a strong random value and Worker variable `WORKSPACE_ID` to a unique workspace identifier. Never commit either value or put it in frontend JavaScript. The current single-key gate is suitable only for one trusted workspace; separate companies require per-workspace membership/authentication before multi-company use.

The API uses the production D1 binding configured in `wrangler.toml`. The deploy workflow applies only additive `CREATE TABLE IF NOT EXISTS` statements before deploying the Worker. It does not delete legacy data. Preview D1 is not targeted by this production workflow.

## API
- `GET /api/health` — public health/configuration status (no data).
- Authenticated with `Authorization: Bearer <HELP_DESK_ACCESS_KEY>`:
  - `GET /api/overview`
  - `GET|POST /api/requests`, `GET|PATCH|DELETE /api/requests/:id`
  - Same CRUD shape for `articles`, `faqs`, `guides`, and `team`.
  - `GET /api/notifications`

## Current limitations
- Login UI intentionally remains disabled.
- The shared API is gated but the static UI is still localStorage-only until a private credential-delivery/access flow is approved and configured.
- Current shared API gate supports one workspace key. Multi-company membership, per-user roles, secure invite/onboarding, attachment storage, notification delivery channels, audit trail, and backups are not complete.
- File attachments are not enabled because no private object-storage binding has been configured.
- Do not put employee or confidential company information into the public preview.

## Previous data cleanup
On 2026-11-24, 569 rows across 21 legacy production tables were deleted and verified at zero; schema was preserved and Preview D1 was untouched. Cloudflare Time Travel retains recoverable history for its configured retention period (7 days on Workers Free, 30 days on Workers Paid). The Worker no longer exposes legacy API routes.
