# Phase C — en-GB generator apply evidence (2031-11-17)

**Status:** Evidence archived · docs-only · **generator apply-only PASS — CLASS B**
**Date:** 2026-07-07
**Main HEAD (execution):** `0b293353` — docs(menu): archive Phase C en-GB onboarding apply evidence (#441)
**Environment:** Production — `https://app.lunchportalen.no` · Sanity dataset **`production`**
**Operator:** Cursor agent (Phase C en-GB generator apply-only; single far-future week · no publish · no SOT · no auto-rollout)

This document records **verification evidence** for the **Phase C en-GB** scoped localized generator apply: **UK Lunch Pilot** week `2031-11-17`. One provider · one far-future week · single scoped apply · strict mode only.

**No secret values, tokens, passwords, connection strings, env values, or private tenant PII are recorded.**

---

## 1. Scope

| Item | State |
|------|-------|
| Phase | **Phase C** — en-GB generator apply-only |
| Market | **en-GB only** |
| Provider | UK Lunch Pilot |
| Provider ID | `e9b90cbf-8f6e-4523-94e2-49263ca61896` |
| Slug | `uk-lunch-pilot` |
| Locale / profile | `en-GB` / `uk_office_lunch` |
| Week | `2031-11-17` → `2031-11-21` (5 weekdays) |
| Week type | **Far-future** (no live orders) |
| Session type | Generator **apply-only** (single scoped apply) |
| Apply mode | `categoryScope=all_supported` · `overwriteMode=create_missing_only_strict` |
| Batch apply | **NOT RUN** |
| Publish-as-apply | **NOT RUN** |
| Publish | **NOT RUN** |
| Onboarding apply | **NOT RUN** |
| SOT | **NOT STARTED** |
| Auto-rollout | **NOT STARTED** |
| Order write-path · `lp_order_set` | **NOT TOUCHED** |
| DB / RLS migration | **NOT RUN** |
| Production flags | **UNCHANGED** |

---

## 2. Preflight

| Check | Result |
|-------|--------|
| Main HEAD | `0b293353` — docs(menu): archive Phase C en-GB onboarding apply evidence (#441) |
| Worktree | `C:\prosjekter\lunchportalen-phasec-en-gb-dryrun` (isolated clean worktree) |
| Provider status | **ACTIVE** |
| `provider_settings` | **OK** (`en-GB` · `uk_office_lunch` · GB · GBP · `Europe/London`) |
| Organization mirror | **OK** (`type=provider`) |
| Admin membership | **OK** (`provider_admin`) |
| Sanity provider mirror | **OK** (id/slug match) |
| `providerMirrorPreflight.ok` | **`true`** |
| `liveReadEnv` | Production Supabase + production Sanity **aligned** |

### Inventory (pre-apply)

| Locale | Classification |
|--------|----------------|
| `nb-NO` | **READY_FOR_SCOPED_APPLY** |
| `sv-SE` | **READY_FOR_SCOPED_APPLY** |
| `da-DK` | **READY_FOR_DRYRUN** |
| `fi-FI` | **READY_FOR_DRYRUN** |
| `en-GB` | **READY_FOR_DRYRUN** |
| `de-DE` / `fr-FR` / `es-ES` / `it-IT` | **BLOCKED_PROVIDER** |

### Pre-apply state

| Check | Result |
|-------|--------|
| Provider count | **5** |
| Order count (global) | **17** |
| Target week menuDays | **0** |
| Provider-scoped catalog docs | **0** |
| Global templates | **7** · unchanged |
| Melhus | **Unchanged** |
| Swedish Lunch Pilot | **Unchanged** |
| Danish Lunch Pilot | **Unchanged** |
| Finnish Lunch Pilot | **Unchanged** |

---

## 3. Pre-apply dryRun

| Field | Value |
|-------|-------|
| HTTP | **200** |
| `ok` | **`true`** |
| `dryRun` | **`true`** |
| `providerMirrorPreflight.ok` | **`true`** |
| `safeToApply` | **`true`** |
| `applyBlocked` | **`false`** |
| locale | `en-GB` |
| menuProfileId | `uk_office_lunch` |
| `unsupportedCategories` | **`0`** |
| Mutation performed | **`false`** |
| Summary | `createdDraftDays=5` · `createdCategories=6` · `totalGeneratedItems=26` |
| UK/English categories | **Sandwiches · Salads · Hot meals · Sushi · Poké bowls · Asian · Vegetarian** |
| Content examples | **Coronation chicken · Shepherd's pie · Chicken Caesar salad** |
| Norwegian fallback | **None in menu content** |
| Forbidden hits | **`[]`** |
| Employee economy exposure | **None** |
| Employee metadata exposure | **None** |

---

## 4. Apply

| Field | Value |
|-------|-------|
| RID | `prov_mapply_mrapgdlx_o9b92chxzvn01w1p` |
| HTTP | **200** |
| `ok` | **`true`** |
| mode | `apply` |
| Applied exactly once | **Yes** |
| Retry | **NOT RUN** (exactly one apply) |
| Rollback | **NOT NEEDED** · **NOT PERFORMED** |

### Created artifacts

| Artifact | Count / detail |
|----------|----------------|
| menuDay drafts | **15** (5 weekdays × 3 tiers: **BASIS · ENTERPRISE · LUXUS**) |
| Provider catalog docs | **1** — provider-scoped `vegetarian` |
| Updated catalog docs | **0** |
| Published docs changed | **0** |
| Extra docs / dates | **0** (exact target week only) |
| `failedDays` | **0** |

**Sample menuDay IDs (deterministic, unpublished):**

- `menuDay-e9b90cbf-8f6e-4523-94e2-49263ca61896-2031-11-17-BASIS-varmrett`
- `menuDay-e9b90cbf-8f6e-4523-94e2-49263ca61896-2031-11-21-LUXUS-varmrett`

| Field | Value |
|-------|-------|
| Publish | **NOT RUN** |
| SOT | **NOT STARTED** |
| Auto-rollout | **NOT STARTED** |

---

## 5. Read-back

| Check | Result |
|-------|--------|
| Unique weekdays | **5** (`2031-11-17` … `2031-11-21`) |
| Tier structure | **BASIS · ENTERPRISE · LUXUS** |
| Draft status | **Operational drafts** (deterministic IDs; not `drafts.*` Sanity draft prefix) |
| `approvedForPublish` | **`false` on all** |
| `customerVisible` | **`false` on all** |
| `providerRef` | `e9b90cbf-8f6e-4523-94e2-49263ca61896` |
| Dates outside week | **None** |
| Provider menuDays outside week | **0** |
| UK/English content | **Shepherd's pie · Fish pie · Roast chicken · Bangers and mash · Beef stew · Halloumi salad · Veggie cottage pie · Lentil dhal** |
| UK/English labels | **All category items English** |
| Allergens | **Present on catalog items** (canonical enum codes, same across all locales) |
| Melhus target total | **226 menuDays** (unchanged) |
| Swedish total | **15 menuDays** (unchanged) |
| Danish total | **15 menuDays** (unchanged) |
| Finnish total | **15 menuDays** (unchanged) |
| Global templates `_rev` | **Unchanged** (7 templates) |

**Classification:** **CLASS B — Apply succeeded safely**

---

## 6. Post-apply dryRun (idempotency)

| Field | Value |
|-------|-------|
| HTTP | **200** |
| `ok` | **`true`** |
| `createdDraftDays` | **`0`** |
| `updatedDraftDays` | **`0`** |
| Catalog updates | **`0`** |
| `unsupportedCategories` | **`0`** |
| Duplicates | **None** |
| `safeToApply` | **`true`** |
| `applyBlocked` | **`false`** |
| Mutation | **None** |

---

## 7. Employee / API

| Endpoint | Result |
|----------|--------|
| `/api/week` | **200** · `ok=true` |
| `/api/order/window` | **200** · `ok=true` |
| Economy exposure | **None** |
| Metadata exposure | **None** |
| UK provider leak into employee surface | **None** |
| Forbidden leak fields | **None** (no price/currency/VAT/commission/invoice/margin/cost; no `approved_by` / `approved_at` / `translated_text_hash` / `original_text_hash`) |

---

## 8. Safety

| Check | Result |
|-------|--------|
| Order count (global) | **17 → 17** |
| Order write-path | **NOT TOUCHED** |
| `lp_order_set` | **NOT TOUCHED** |
| DB / RLS | **UNCHANGED** |
| Production flags | **UNCHANGED** |
| Provider count | **5 → 5** (unchanged after generator apply) |
| Production Sanity changed only by | **15 en-GB target-week menuDays** + **1 en-GB provider-scoped vegetarian catalog doc** |
| menuDays | **Only expected en-GB target-week drafts** |
| Catalog docs | **Only expected en-GB provider-scoped vegetarian doc** |
| Publish | **NOT RUN** |
| SOT | **NOT STARTED** |
| Auto-rollout | **NOT STARTED** |
| Batch apply | **NOT RUN** |
| Publish-as-apply | **NOT RUN** |
| Melhus / Swedish / Danish / Finnish mutation | **NONE** |
| Rollback | **NOT NEEDED** · **NOT PERFORMED** |
| Secrets / password / env committed | **NO** |

---

## 9. Known risks

1. **Far-future unpublished drafts only** — no publish; customer-invisible.
2. **Protected providers untouched** — Melhus, Swedish Lunch Pilot, Danish Lunch Pilot, Finnish Lunch Pilot unchanged.
3. **Vegetarian category container title `"Vegetar"`** is a pre-existing systemic label identical across Phase C locales (en-GB / sv-SE / da-DK / fi-FI) — **not** an en-GB regression. Customer-facing item titles and descriptions are English.
4. **menuDay IDs are deterministic** (not Sanity `drafts.*` prefix) — operational drafts by design.
5. **Some allergens live on catalog items** rather than top-level menuDay docs (canonical enum codes shared across locales).
6. **No further generator applies** without separate scoped GO.
7. **SOT: NO-GO** · **Auto-rollout: NO-GO** (unchanged).

---

## 10. Next action

| Item | Action |
|------|--------|
| This document | **Archive evidence** (docs-only PR) |
| Next Phase C locale | **Onboarding dryRun-only** under separate scoped GO |
| Generator apply | **No further applies** without separate GO |
| SOT / auto-rollout | **Do not start** |

**Do not** run generator apply, onboarding apply, publish, start SOT, or start auto-rollout without separate operator GO.

---

## 11. Related documents

| Document | Role |
|----------|------|
| [`phase-c-en-gb-onboarding-apply-evidence.md`](./phase-c-en-gb-onboarding-apply-evidence.md) | Prior en-GB onboarding apply evidence (PR #441) |
| [`phase-c-en-gb-onboarding-dryrun-evidence.md`](./phase-c-en-gb-onboarding-dryrun-evidence.md) | Prior en-GB onboarding dryRun evidence (PR #440) |
| [`phase-c-fi-fi-generator-apply-evidence.md`](./phase-c-fi-fi-generator-apply-evidence.md) | Prior fi-FI generator apply evidence (PR #439) |
| [`../runbooks/phase-c-9-country-provider-rollout.md`](../runbooks/phase-c-9-country-provider-rollout.md) | Phase C operator rollout control |

**Protected Golden Path impact:** None — order write-path, `lp_order_set`, and employee order flow unchanged.
