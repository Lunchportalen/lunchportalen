# Phase 4 master — delivery, media, preview, invalidation

## Scope statement

Phase 4 **locks the read path contract** from **Umbraco** (Umbraco Cloud) to **Next.js** for **public website CMS content** after migration: **published Delivery API consumption**, **preview consumption** (distinct from published), **Media Delivery API** usage, **cache and invalidation rules**, and **webhook-driven revalidation** expectations.

Operational domains (menu, menuContent, weekPlan, orders, tenants, billing, immutable logs, etc.) remain **outside** Umbraco and **outside** this contract except where Next **composes** them with CMS pages at render time (e.g. pricing blocks calling app APIs — behavior already noted in Phase 2–3 block models).

## What Phase 4 locks

| Area | Lock |
|------|------|
| **Published truth** | Umbraco **Delivery API** (explicitly enabled and indexed) is the sole editorial source for migrated public CMS pages and their published properties |
| **Preview truth** | Preview is **not** published truth; it uses Umbraco-supported preview/draft mechanisms and **must not** share output cache with published |
| **Media** | CMS media URLs and transforms flow through **Media Delivery API** as a **separate** enablement from content Delivery |
| **Index operations** | **DeliveryApiContentIndex** (or product-equivalent) **rebuild** after model/deploy changes is a **mandatory operational step**, not optional hygiene |
| **Secrets** | No Delivery keys, preview signing secrets, webhook secrets, or Management/API User secrets in the **browser** |
| **End state** | After cutover for a content type family, **one** published read path — no permanent dual-read |

## What Phase 4 explicitly does NOT implement

- Code in this repo for Delivery clients, preview routes, `draftMode` wiring, or webhook handlers.
- ETL, migration jobs, redirect execution, or production cutover.
- Umbraco backoffice UI beyond **referencing** editor trigger points for preview.
- Claims that Cloud portal steps are “done” without **verified** portal state.

## Dependency on signed Phase 0–1 and Phase 2–3 outputs

| Dependency | Why |
|------------|-----|
| [Phase 0–1 ADR and authority](../phase-0-1/01-ADR-headless-umbraco-target.md) | Next = shell; Umbraco = editorial authority for public CMS |
| [Phase 0–1 preview/delivery prerequisites](../phase-0-1/13-preview-delivery-foundation-prereqs.md) | Preview bypasses cache; Delivery/Media separate |
| [Phase 0–1 secrets matrix](../phase-0-1/12-secrets-and-environment-matrix.md) | Server-only secrets naming |
| [Phase 2–3 content model](../phase-2-3/20-content-model-master.md) | Document types, blocks, cultures inform **what** Delivery returns |
| [Phase 2–3 navigation/SEO](../phase-2-3/26-navigation-seo-and-settings-model.md) | Slug, canonical, culture rules inform **lookup** contract |
| [Phase 2–3 media model](../phase-2-3/24-media-localization-and-dictionary-model.md) | Alt, focal point, media invariants |
| [Phase 2–3 open blockers](../phase-2-3/37-open-questions-and-blockers.md) | Unresolved items **carry forward**; they can block Phase 4 signoff where they blur URLs, cultures, or payload shape |

## Hard gate: no migration execution before Phase 4 exit

**Real migration work** (ETL, switching production reads, decommissioning legacy write paths for migrated types) **must not begin** until:

1. `52-phase-4-exit-checklist.md` is **fully satisfied** (binary).
2. All **blocker-grade** items in `51-open-blockers-phase-4.md` are **resolved or explicitly time-boxed with named owner and decision** — *fuzzy contracts are not sufficient for execution*.

Phase 4 completion means **contracts and prerequisites are explicit**, not that **Umbraco Cloud toggles are verified** unless checklist items requiring verification are checked.

## Document map

| Question | Primary doc |
|----------|-------------|
| What does published Delivery guarantee? | `41-published-delivery-contract.md` |
| How may Next consume and map it? | `42-next-fetch-and-mapping-contract.md` |
| How does preview work end-to-end? | `43-preview-contract.md` |
| How do images/files resolve? | `44-media-delivery-contract.md` |
| What is cached where? | `45-cache-invalidation-and-topology.md` |
| What fires revalidation? | `46-webhooks-and-revalidation-contract.md` |
| Gated / member-only public pages? | `47-protected-content-decision.md` |
| Per-environment expectations? | `48-environment-behavior-matrix.md` |
