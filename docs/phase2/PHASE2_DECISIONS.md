# Phase 2 — Decisions (planning)

These are **planning decisions** for CMS-led productization. They do not change runtime until implemented and gated.

## D1 — Single stack truth

- **Decision:** Supabase (auth, tenant data, operational core) + Sanity (content) + Next.js App Router + Vercel remain the only production stack. No parallel CMS or admin product.
- **Rationale:** AGENTS.md and existing architecture; reduces drift and security surface.

## D2 — CMS as control surface, not operational substitute

- **Decision:** Backoffice/CMS is the editorial and growth control plane. Employee week ordering, kitchen production lists, driver stops, and B2B invoicing **stay** on their existing APIs and server contracts.
- **Rationale:** Fase 1 boundaries (`weekPlan` not employee truth; `GET /api/week` + `order/window` for ops).

## D3 — Design system source of truth

- **Decision:** Canonical visual primitives remain **`app/globals.css`** (`--lp-*`) with **`lib/design/README.md`** and **`docs/VISUAL_SYSTEM.md`** as documentation layers. Phase 2 extends **usage consistency** and optional token documentation — not a second token file competing with `:root`.
- **Rationale:** Repo already documents this; Avensia/Umbraco-grade feel comes from disciplined application, not duplicate variables.

## D4 — AI inside CMS, not new orchestration layer (initially)

- **Decision:** Consolidate AI entry points **toward** backoffice content/editor flows and existing APIs; avoid introducing a new “AI orchestrator” service until consolidation map shows a single choke point is worth it.
- **Rationale:** User constraint “do not create parallel systems”; map-first in `AI_CMS_CONSOLIDATION.md`.

## D5 — Company admin “control tower” = evolve existing `/admin/*`

- **Decision:** Professional company-admin UX is delivered by **structuring and completing** routes under `app/admin/**` (e.g. people, locations, agreement, insights, orders, sustainability) rather than a new `/company-dashboard` app.
- **Rationale:** Frozen role landing and existing navigation patterns.

## D6 — Social calendar = existing `lib/social/*` + `SocialContentCalendar`

- **Decision:** One social editorial pipeline centered on **`lib/social/calendar`**, **`SocialContentCalendar.tsx`**, and related executors — extended, not forked.
- **Rationale:** Code already exists; Phase 2 makes it the single obvious path.

## D7 — Implementation phasing

- **Decision:** Ship in **2A / 2B / 2C** style batches (see `PHASE2_IMPLEMENTATION_SEQUENCE.md`). Documentation and low-risk visual consistency before touching auth, order window, or invoicing.

## Review

Revisit after first implementation sprint; update this file with ADR-style IDs if decisions change.
