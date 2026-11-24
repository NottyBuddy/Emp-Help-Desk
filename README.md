# Employee Help Desk

A lightweight, responsive employee help-desk workspace.

## Current preview

The root page is a standalone local preview. It has no login, no employee account requirement, and no connection to the old IndiFrame API.

Available sections:
- Overview
- Help requests (create, update status, delete)
- Knowledge base
- FAQs
- Guides and SOPs
- Team directory

New content is saved only in the current browser using localStorage. The workspace starts empty. Use **Clear workspace data** in the sidebar to clear preview content.

## Important status

This is a preview build, not a production multi-company SaaS yet. Data is local to the browser and is not shared between devices or team members. Authentication, multi-tenant database, permissions, audit history, backups, billing, and production deployment are intentionally not active in this preview.

The production Cloudflare D1 database was cleaned on 2026-11-24. All 569 rows across 21 application tables were deleted and verified at zero; the schema was preserved. This included employee accounts and sessions, attendance, breaks, KPI/source imports, call-performance data, quiz data, audit history, project records and legacy settings. The Preview D1 database was not touched. A pre-cleanup Time Travel bookmark and row-count report were saved as the `production-d1-cleanup` GitHub Actions artifact. Cloudflare Time Travel retains recovery history automatically (7 days on Workers Free, 30 days on Workers Paid), so the active database is empty but the deleted data remains restorable during that retention window. The Cloudflare Worker remains in maintenance mode: only the root status and health-check endpoints respond; every legacy API route returns HTTP 410.

## Run locally

Open `index.html` in a browser, or serve the repository with any static file server.
