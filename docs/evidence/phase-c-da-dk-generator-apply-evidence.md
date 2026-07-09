# Phase C — da-DK generator apply evidence (2031-11-03)

**Status:** Evidence archived · docs-only · **generator apply-only PASS**  
**Date:** 2026-07-07  
**Main HEAD (archive):** `ec63c096` — docs(menu): archive Phase C da-DK provider onboarding evidence (#434)  
**Environment:** Production — `https://app.lunchportalen.no` · Sanity dataset **`production`**  
**Operator:** Cursor agent (Phase C da-DK generator apply-only final clean run; no SOT · no auto-rollout · no publish)

This document records **verification evidence** for the first **Phase C da-DK** scoped localized generator apply: **Danish Lunch Pilot** week `2031-11-03`. One provider · one far-future week · single scoped apply · strict mode only.

**No secret values, tokens, passwords, connection strings, env values, or private tenant PII are recorded.**

---

## 1. Scope

| Item | State |
|------|-------|
| Phase | **Phase C** — da-DK generator apply-only |
| Market | **da-DK only** |
| Provider | Danish Lunch Pilot |
| Provider ID | `799ba3a2-a127-48a0-87b7-87944a2f42a3` |
| Slug | `danish-lunch-pilot` |
| Locale / profile | `da-DK` / `danish_office_lunch` |
| Week | `2031-11-03` → `2031-11-07` (5 weekdays) |
| Week type | **Far-future** (no live orders) |
| Session type | Generator **apply-only** (single scoped apply) |
| Apply mode | `categoryScope=all_supported` · `overwriteMode=create_missing_only_strict` |
| Batch apply | **NOT RUN** |
| Publish-as-apply | **NOT RUN** |
| Publish | **NOT RUN** |
| SOT | **NOT STARTED** |
| Auto-rollout | **NOT STARTED** |
| Order write-path · `lp_order_set` | **NOT TOUCHED** |
| DB / RLS migration | **NOT RUN** |
| Production flags | **UNCHANGED** |

---

## 2. Preflight

| Check | Result |
|-------|--------|
| Main HEAD | `ec63c096` (or newer origin/main at archive time) |
| Worktree | `C:\prosjekter\lunchportalen-dadk-final-readback` (isolated clean clone) |
| Provider exists | **Yes** |
| `provider_settings` | **OK** (`da-DK` · `danish_office_lunch` · DK · DKK · `Europe/Copenhagen`) |
| Organization mirror | **OK** (`type=provider`) |
| Admin membership | **OK** (`provider_admin`) |
| Sanity provider mirror | **OK** (id/slug match) |
| `providerMirrorPreflight.ok` | **`true`** |
| `liveReadEnv` | Production Supabase + production Sanity **aligned** |

### Inventory (read-only)

| Locale | Classification |
|--------|----------------|
| `nb-NO` | **READY_FOR_SCOPED_APPLY** |
| `sv-SE` | **READY_FOR_SCOPED_APPLY** |
| `da-DK` | **READY_FOR_DRYRUN** |

Remaining Phase C locales: **BLOCKED_PROVIDER** (unchanged).

### Pre-apply state

| Check | Result |
|-------|--------|
| Target week menuDays | **0** |
| Provider-scoped catalog docs | **0** |
| Order count (global) | **17** |
| Order count (Danish) | **0** |
| Order count (Melhus) | **17** |
| Order count (Swedish) | **0** |
| Melhus target week | **0** |
| Swedish target week | **0** |

### Pre-apply dryRun

| Field | Value |
|-------|-------|
| RID | `prov_mapply_mr9rou8c_2n9rz5bfz78l8u3l` |
| HTTP | **200** |
| `ok` | **`true`** |
| `dryRun` | **`true`** |
| `providerMirrorPreflight.ok` | **`true`** |
| `safeToApply` | **`true`** |
| `applyBlocked` | **`false`** |
| `unsupportedCategories` | **`0`** |
| Catalog updates | **`0`** |
| Mutation performed | **`false`** |
| wouldCreate catalog | **`vegetarian` only** |
| wouldCreate draft days | **5 weekdays** (summary) |
| Danish labels | **Smørrebrød · Salater · Varm ret · Vegetarisk** |
| Norwegian fallback | **None** (`Påsmurt` / `Salatboks` hits **`[]`**) |
| menuLocale | `da-DK` |

---

## 3. Apply

| Field | Value |
|-------|-------|
| RID | `prov_mapply_mr9rouz8_k89tur64mgwzktnx` |
| HTTP | **200** |
| `ok` | **`true`** |
| Retry | **NOT RUN** (exactly one apply) |
| Rollback | **NOT NEEDED** · **NOT PERFORMED** |

### Created artifacts

| Artifact | Count / detail |
|----------|----------------|
| menuDay drafts | **15** (5 weekdays × 3 tiers: **BASIS · ENTERPRISE · LUXUS**) |
| Provider catalog docs | **1** — `lunchCategory-799ba3a2-a127-48a0-87b7-87944a2f42a3-vegetarian` |
| Updated catalog docs | **0** |
| Published docs changed | **0** |
| Extra docs / dates | **0** (exact target week only) |

**Sample menuDay IDs (deterministic, unpublished):**

- `menuDay-799ba3a2-a127-48a0-87b7-87944a2f42a3-2031-11-03-BASIS-varmrett`
- `menuDay-799ba3a2-a127-48a0-87b7-87944a2f42a3-2031-11-07-LUXUS-varmrett`

---

## 4. Read-back

| Check | Result |
|-------|--------|
| Unique weekdays | **5** (`2031-11-03` … `2031-11-07`) |
| Tier structure | **BASIS · ENTERPRISE · LUXUS** |
| Draft status | **Operational drafts** (deterministic IDs; not `drafts.*` Sanity draft prefix) |
| `approvedForPublish` | **`false` on all** |
| `customerVisible` | **`false` on all** |
| `providerRef` | `799ba3a2-a127-48a0-87b7-87944a2f42a3` |
| Danish content (examples) | Kylling i karry · Falafeltallerken · Linsegryde |
| Danish category labels | Smørrebrød · Salater · Varm ret · Vegetarisk |
| Allergens | **Present on catalog items** (e.g. hvete, sesam, melk); menuDay docs use `mealTitle` **without** top-level `allergens[]` |
| Melhus target week | **0** (total **226** — unchanged) |
| Swedish target week | **0** (total **15** — unchanged) |
| Global templates `_rev` | **Unchanged** |

**Classification:** **CLASS B — Apply succeeded safely**

---

## 5. Post-apply dryRun

| Field | Value |
|-------|-------|
| RID | `prov_mapply_mr9rqugg_627vzbm2yv80jgu1` |
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

## 6. Employee / API

| Endpoint | Result |
|----------|--------|
| `/api/week` | **200** · `ok=true` |
| `/api/order/window` | **200** · `ok=true` |
| Economy exposure | **None** |
| Metadata exposure | **None** |
| Forbidden leak fields | **None** (no price/currency/VAT/commission/invoice/margin/cost; no `approved_by` / `approved_at` / `translated_text_hash` / `original_text_hash`) |

---

## 7. Safety

| Check | Result |
|-------|--------|
| Order count (global) | **17 → 17** |
| Order count (Danish) | **0 → 0** |
| Order count (Melhus) | **17 → 17** |
| Order count (Swedish) | **0 → 0** |
| Order write-path | **NOT TOUCHED** |
| `lp_order_set` | **NOT TOUCHED** |
| DB / RLS | **UNCHANGED** |
| Production flags | **UNCHANGED** |
| Production Sanity changed only by | **15 Danish target-week menuDays** + **1 Danish provider-scoped vegetarian catalog doc** |
| Publish | **NOT RUN** |
| SOT | **NOT STARTED** |
| Auto-rollout | **NOT STARTED** |
| Batch apply | **NOT RUN** |
| Publish-as-apply | **NOT RUN** |
| Melhus | **Untouched** |
| Swedish Lunch Pilot | **Untouched** |
| Rollback needed | **NO** |
| Rollback performed | **NO** |
| Secrets / password / env committed | **NO** |

---

## 8. Known risks

1. **Far-future unpublished drafts only** — no customer-visible menu surface for this week.
2. **menuDay IDs are deterministic** — not `drafts.*` Sanity draft prefix; unpublished state is `approvedForPublish=false` + `customerVisible=false`.
3. **Fixed categories use global templates** — only **vegetarian** received a provider-scoped catalog doc in this apply.
4. **Allergens on catalog items** — not top-level on menuDay documents.
5. **No further generator applies** without a separate scoped GO.
6. **SOT: NO-GO** · **Auto-rollout: NO-GO** (unchanged).

---

## 9. Next action

| Item | Action |
|------|--------|
| This document | **Archive evidence** (docs-only PR) |
| Next locale onboarding | **Separate scoped GO only** (e.g. `fi-FI` when ready) |
| SOT | **Do not start** |
| Auto-rollout | **Do not start** |
| Generator apply retry | **Do not run** for week `2031-11-03` (idempotent post-apply dryRun PASS) |

**Exact next GO prompt (separate scoped GO only):**

```text
GO Phase C fi-FI provider onboarding dryRun-only — or next locale per rollout plan
```

**Do not** run production menu apply, publish, start SOT, or start auto-rollout without separate operator GO.

---

## 10. Related documents

| Document | Role |
|----------|------|
| [`phase-c-da-dk-provider-onboarding-evidence.md`](./phase-c-da-dk-provider-onboarding-evidence.md) | Prior da-DK onboarding + generator dryRun evidence |
| [`phase-c-9-country-launch-readiness-plan.md`](./phase-c-9-country-launch-readiness-plan.md) | Phase C readiness plan |
| [`../runbooks/phase-c-9-country-provider-rollout.md`](../runbooks/phase-c-9-country-provider-rollout.md) | Phase C operator rollout control |
| [`phase-b-sv-se-production-apply-evidence.md`](./phase-b-sv-se-production-apply-evidence.md) | Prior sv-SE apply evidence (separate GO) |
| [`pr430-production-smoke-evidence.md`](./pr430-production-smoke-evidence.md) | Provider mirror preflight production smoke |

**Protected Golden Path impact:** None — order write-path, `lp_order_set`, and employee order flow unchanged.
