# Phase 2 — CMS core boundary

**Intent:** Define what “CMS core” means in this repo so operational lunch logic, employee surfaces, and editorial content stay **separated by contract**.

## 1. Layers (conceptual)

| Layer | Responsibility | Primary code areas |
|-------|------------------|-------------------|
| **Operational core** | Orders, cutoffs, agreements, billing, kitchen/driver lists | `lib/agreement/*`, `app/api/order/*`, `app/api/week`, kitchen/driver APIs, Supabase RLS expectations |
| **Content & growth** | Pages, blocks, SEO, social editorial, marketing overlays | `app/(backoffice)/backoffice/content/**`, Sanity fetchers, `lib/cms/*`, `lib/social/*` |
| **Identity & tenant** | Auth, roles, profiles, company scope | `lib/auth/*`, `middleware.ts` (path only), `/api/auth/post-login` |

## 2. CMS “core” UI (this codebase)

The **canonical CMS workspace** is:

- **Route shell:** `app/(backoffice)/backoffice/content/**` layouts and `_workspace/ContentWorkspaceLayout.tsx` (tree slot + `ContentEditor`).
- **Tree:** `app/(backoffice)/backoffice/content/_tree/ContentTree.tsx` — **currently bootstrapped with mock roots** (`getMockRoots`); persistence-driven tree is a **Phase 2B** deliverable, not assumed here.
- **Editor:** `ContentWorkspace.tsx` (+ split modules: `ContentWorkspacePageEditorShell`, `ContentWorkspaceEditorMountRouter`, etc.) — block list, inspector, preview, publish flows.
- **Preview / published:** Must keep shared render pipeline (block renderers, public routes) — see `docs/refactor/WEEK_SOURCE_OF_TRUTH_DECISION.md` for operational vs editorial split.

## 3. Hard boundaries (must not blur)

1. **Employee week UI** = `/week` + `order/window` + `GET /api/week` for menu data — **not** Sanity `weekPlan` as hidden truth (`docs/refactor/PHASE1B_WEEKPLAN_RUNTIME_BOUNDARY.md`).
2. **No client-side role guessing** for security — server layout/guards (AGENTS.md D4, E5).
3. **Invoicing / B2B 14-day** — unchanged contracts; CMS may *link* to reporting copy, not invent billing.

## 4. Data flow (simplified)

```
Sanity (content documents, assets, SEO fields)
        ↓
Next.js server components / route handlers
        ↓
Editor + preview (CMS core)
        ↓
Public site / marketing pages

Supabase (profiles, orders, agreements, billing)
        ↓
Operational APIs
        ↓
Employee / kitchen / driver / admin surfaces
```

Cross-links (e.g. CTA to order) are **UI** only; they must not write operational state without the existing API contracts.

## 5. Phase 2 work implied by this boundary

| Area | Work |
|------|------|
| Tree | Replace mock roots with API-backed tree — `CONTENT_TREE_IMPLEMENTATION_PLAN.md` (future stream B doc) |
| Workspace | Continue modular splits — `CONTENT_WORKSPACE_PHASE2_SPLIT.md` (future) |
| AI | Consolidate into CMS rails — `AI_CMS_CONSOLIDATION.md` |

## 6. Sensitive files (touch only with care)

- `middleware.ts`, `app/api/auth/post-login/route.ts`, `lib/auth/getAuthContext.ts`
- `app/api/order/window/route.ts`, `app/api/week/route.ts`
- `app/superadmin/**` frozen flows per AGENTS.md

CMS core work should **default** to `app/(backoffice)/backoffice/content/**` and `lib/cms/**` until a decision explicitly extends scope.
