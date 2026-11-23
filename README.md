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

The previous Cloudflare D1 database has not yet been wiped. Before deleting production rows, inspect the live D1 schema and take a backup. The Cloudflare Worker is now in maintenance mode: only the root status and health-check endpoints respond; every legacy API route returns HTTP 410. The Worker no longer imports or calls the old employee, session, helpdesk, or weekly-data route handlers, so those routes cannot read or write the old D1 database.

## Run locally

Open `index.html` in a browser, or serve the repository with any static file server.
