# IndiFrame Agent Command Centre

Source snapshot of the IndiFrame Agent Command Centre.

Live application: https://indiframe-agent.hatchable.site

## Features
- Inbound and outbound calling scripts with full visible text
- Customer objection library, FAQ and product quick reference
- Weekly knowledge quiz with score history
- Customer role-play simulator with rubric-based feedback
- Daily KPI leaderboard
- Individual coaching recommendations from KPI and quiz performance
- Manager-controlled team profiles and daily KPI entry

## Project layout
- public/: browser application
- api/: authenticated Hatchable API handlers
- migrations/: PostgreSQL schema
- hatchable.toml: authentication and data access configuration

This folder is a source mirror. The live hosted deployment and database remain managed by Hatchable. Do not publish secrets or customer data in this repository.
