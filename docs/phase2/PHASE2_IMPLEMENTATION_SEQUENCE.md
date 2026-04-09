# Phase 2 — Implementation sequence (proposed)

**Constraint:** No big-bang release. Each batch must pass `typecheck`, `build:enterprise`, and targeted tests for touched areas.

## Phase 2A — Safe foundation (low regression risk)

**Goal:** Documentation alignment, design consistency in backoffice/CMS only, modular workspace **without** changing data contracts.

| Order | Work | Why first |
|-------|------|-----------|
| 1 | Design system **usage** pass: enforce `--lp-*`, motion, icon sizes per `docs/VISUAL_SYSTEM.md` in backoffice/content components | Visual lift; rarely touches server logic |
| 2 | CMS core **boundary** clarity: tree ↔ workspace ↔ preview pipeline documented; small refactors matching `CONTENT_WORKSPACE_PHASE2_SPLIT` direction | Maintainability |
| 3 | AI consolidation **documentation + thin UI grouping** (panels/rail order), no new APIs | Reduces cognitive load |

**Avoid in 2A:** `middleware.ts`, `/api/auth/post-login`, `order/window`, invoicing routes, onboarding routes.

## Phase 2B — Editorial and media (medium risk)

| Order | Work | Notes |
|-------|------|--------|
| 1 | Media library: single flow per `MEDIA_SYSTEM_PLAN.md`; Sanity asset patterns | Touch CDN/Sanity; test uploads and block insert |
| 2 | SEO engine consolidation in CMS (`SEO_ENGINE_PLAN.md`) | Read-only data first; avoid public homepage regressions |
| 3 | Social calendar hardening (`SOCIAL_CALENDAR_PLAN.md`) | Keep single `lib/social/calendar` |

## Phase 2C — Control towers (higher risk — tenant and ops)

| Order | Work | Notes |
|-------|------|--------|
| 1 | Company admin: dashboards linking existing `/admin/*` data | No duplicate metrics; server truth only |
| 2 | Superadmin control tower: pending approval, companies, health | Respect frozen `/superadmin/*` rules from AGENTS.md |
| 3 | Kitchen operations UI | Read-only truth; no manual overrides |
| 4 | Driver mobile UX | One-hand flows; no horizontal scroll |

## Phase 2D — Growth / ESG (cross-cutting)

- ESG and cancellation/waste narratives tied to **existing** admin and reporting (`baerekraft`, APIs).
- Coordinate with CMS only where storytelling content is authored.

## Suggested “Fase 2A” label

Use **Fase 2A** = **Phase 2A** above (design/CMS shell + docs + non-breaking refactors). Everything that touches billing, auth redirects, or order cutoffs is **not** 2A.

## Verification gate (every batch)

1. `npm run typecheck`
2. `npm run build:enterprise`
3. Relevant `vitest` + smoke where APIs change
4. Manual: employee `/week`, driver `/driver`, kitchen `/kitchen` smoke on mobile viewport
