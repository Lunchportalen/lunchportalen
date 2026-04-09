# Phase 2B — Boundaries and safety

## 1. Out of scope (do not touch)

| Area | Reason |
|------|--------|
| Auth, login, post-login, middleware role landing | Frozen per AGENTS.md |
| Onboarding / registration / phone normalization | Frozen |
| Employee `/week`, `weekPlan`, orders, windows | Operational truth — explicit exclusion |
| Billing | Exclusion |
| Supabase project layout / Vercel deploy config | Unless CMS-only env var documented elsewhere |
| SEO / social / ESG / control towers | Phase 2C+ per brief |

## 2. Sensitive CMS-adjacent surfaces (change only with care)

| Surface | Risk |
|---------|------|
| `app/api/backoffice/content/tree/**` | Structure truth; bugs → wrong parent or cycles |
| `app/api/backoffice/content/tree/move/**` | Same; must stay idempotent and validated |
| Page save / publish routes for `content_pages` | Public site truth |
| `lib/cms/render/**`, `CmsBlockRenderer`, public page renderer | Single pipeline law |
| `lib/cms/media/resolveMedia.ts`, `resolveBlockMediaDeep.ts` | Broken resolution → broken images site-wide |
| Preview route(s) for CMS | Must match publish |
| Design-scope loaders (Phase 2A) | Tree/media must respect tokens — no duplicate design injection |

## 3. Safe changes (typical)

- Wiring `ContentTree.tsx` to **existing** GET tree + POST move (no new tables).
- Mediearkiv UX polish using **existing** APIs.
- Documentation under `docs/phase2b/**`.
- Tests that lock API contracts for tree and media.

## 4. Unsafe without design review

- Adding `company_id` to `media_items` or changing RLS (tenant model).
- Hard delete on `media_items` while blocks reference UUIDs.
- Client-only slug/path updates when moving tree nodes.
- New block fields that bypass `resolveBlockMediaDeep`.

## 5. Proof checklist (post-implementation)

- [ ] Preview and published page show same resolved image URLs for UUID-backed blocks.
- [ ] CMS design scope (2A) still applies to workspace chrome after tree wiring.
- [ ] No new parallel types for “TreeNode v2” in `lib/cms/model`.
