# Phase 2B — Risks

## High

| Risk | Mitigation |
|------|------------|
| **Tree UI / DB divergence** — editors trust mock tree while DB differs | Wire `GET /api/backoffice/content/tree` first; remove mock as default |
| **Move breaks URLs** — reparenting interacts with slug rules | Server-side validation only; reuse existing slug/path helpers; add tests |
| **Media contract drift** — `MEDIA_API_CONTRACT.md` vs upload route | **Mitigated in 2B2:** contract documents upload + DELETE + variants/displayName |

## Medium

| Risk | Mitigation |
|------|------------|
| **Orphan block refs** if media deleted | `DELETE` exists for superadmin; blocks do not FK — editors must accept stale UUIDs until content updated; Mediearkiv warns on delete |
| **Superadmin-only media** vs future company_admin | Explicit phase; do not partially relax RLS in 2B without tenant design |
| **Variants** implemented ad hoc in multiple places | One `metadata` schema + one resolution helper |

## Low

| Risk | Mitigation |
|------|------------|
| **Expanded tree** slow on large sites | Pagination/virtualization later; not v2 model |
| **AI** writing duplicate `media_items` | Idempotent insert rules + dedupe by url hash optional later |

## Residual after 2B1

| Risk | Note |
|------|------|
| **Sort order race** | Two editors moving pages concurrently could produce duplicate `tree_sort_order`; acceptable short-term; consider DB-side ordering or recompute later. |
| **Append-only move** | Move dialog appends at end of target sibling list; fine-grained reorder among siblings without changing parent is not implemented. |
| **Delete gap** | No tree delete — users cannot remove pages from tree UI until a safe DELETE/soft-delete flow exists. |

## Residual after 2B2

| Risk | Note |
|------|------|
| **Variant keys in editor** | Blocks can carry `mediaVariantKey` but inspector UI for it may be partial — resolution path is implemented server-side. |
| **Storage object on DELETE** | Row delete does not necessarily remove binary from Supabase Storage — optional cleanup deferred. |

## Regression vectors

- `EditorStructureTree` confused with site tree — clarify in code comments and QA checklist.
- Double resolution paths (client vs server) for images — keep order documented in `resolveMedia` comments.
