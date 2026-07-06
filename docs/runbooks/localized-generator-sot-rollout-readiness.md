# Localized fixed menu generator — SOT and rollout readiness plan

**Status:** PLAN ONLY · **SOT NOT STARTED** · **auto-rollout NOT STARTED**  
**Date:** 2026-07-06  
**Main HEAD (planning audit):** `5db00381` — Phase B sv-SE production apply evidence (#428)  
**Production code commit (generator chain):** `325afbce` — dryRun idempotency (#420)  
**Evidence archive:** [`docs/evidence/localized-generator-production-evidence.md`](../evidence/localized-generator-production-evidence.md)

This runbook defines **enterprise readiness gates** for the next phase: source-of-truth (SOT) planning, provider-by-provider rollout, rollback, observability, and 9-market launch. It is **not** implementation authorization.

**No secret values, tokens, passwords, connection strings, or private tenant PII are recorded.**

---

## 1. Current production state

### 1.1 Flags (production)

| Flag | State | Notes |
|------|-------|-------|
| `LP_MENU_PROFILE_RESOLVER` | **ON** | SUPERSMART resolver live |
| `LP_LOCALIZED_FIXED_MENU_GENERATOR` | **ON** | Generator panel + apply route enabled |
| SOT / auto-rollout flags | **NONE active** | No cutover flag exists yet for localized generator SOT |

**Do not** activate additional flags without scoped owner GO.

### 1.2 Code chain (merged to main)

| PR | Capability |
|----|------------|
| [#415](https://github.com/Lunchportalen/lunchportalen/pull/415) | Localized fixed provider menu generator |
| [#416](https://github.com/Lunchportalen/lunchportalen/pull/416) | Localized provider menu surface (labels + fixed choices) |
| [#418](https://github.com/Lunchportalen/lunchportalen/pull/418) | Enterprise apply flow (full week menu) |
| [#419](https://github.com/Lunchportalen/lunchportalen/pull/419) | Production apply safety (`create_missing_only_strict`) |
| [#420](https://github.com/Lunchportalen/lunchportalen/pull/420) | Catalog dryRun idempotency (`sanityServer` + `isProviderScoped`) |
| [#421](https://github.com/Lunchportalen/lunchportalen/pull/421) | Production evidence archive (this plan's predecessor) |

**Production deploy target for generator behavior:** `325afbce` (runtime unchanged by #421 docs-only merge).

### 1.3 Sanity (production)

| Item | State |
|------|-------|
| Global `lunchCategory-vegetarian` | Seeded (createIfNotExists — non-destructive) |
| `vegetarian` `displayOrder` | 6 |
| `varmrett` `displayOrder` | 7 |
| Global templates | Unchanged by seed |
| Melhus canary docs | Provider vegetarian + 15 varmrett drafts (week `2031-03-31`) |

### 1.4 Canary apply (production — single authorized session)

| Field | Value |
|-------|-------|
| Provider | Melhus Catering AS · `11111111-1111-1111-1111-111111111111` |
| Week | `2031-03-31` → `2031-04-04` |
| Mode | `create_missing_only_strict` |
| Created | Provider vegetarian doc + **15** menuDay tier-docs (5 weekdays × 3 tiers) |
| Not changed | Påsmurt catalog `_rev`, global templates, published docs, orders |

### 1.5 Post–PR #420 dryRun verification

At `325afbce`: `createdDraftDays=0`, vegetarian `would_skip_existing_category`, `would_create_category=false`, catalog updates=0, no mutation.

### 1.6 Known limitations (carry forward)

1. Fixed categories apply via **week-aggregated** provider `lunchCategory` docs — not per-day catalog rows.
2. Varmrett apply creates **15** Sanity documents per 5-day week (BASIS/LUXUS/ENTERPRISE per weekday).
3. Canary drafts are **far-future** and **unpublished**.
4. `replace_catalog_with_confirmation` requires explicit phrase + confirmation token — never default.
5. **No SOT / auto-rollout** has started; employee order path remains on existing materialization contracts until separate GO.

### 1.7 Provider onboarding prerequisites (before first generator apply)

Before the **first** localized generator apply for a **new** provider, the following must exist and resolve:

| Prerequisite | Required | Notes |
|--------------|----------|-------|
| Supabase `providers` row | Yes | `id`, `name`, `slug`, `status` |
| `organizations` mirror row | Yes | Same `id` as provider · `type=provider` |
| `provider_settings` row | Yes | `locale`, `menu_profile_id`, country, currency, timezone |
| `provider_admin` membership + auth | Yes | Provider-scoped login for `/leverandor/meny` and apply route |
| **Sanity provider mirror document** | **Yes** | `_id` == Supabase `providers.id` · see §1.8 |
| Profile resolves | Yes | `menuLocale`, `menuProfileId`, country, currency via resolver |

**Do not** proceed to production apply until all rows above exist **and** Sanity provider mirror is verified read-only.

### 1.8 Sanity provider mirror requirement

`menuDay` and provider-scoped `lunchCategory` documents reference `provider._ref` in Sanity. If the provider mirror document is missing, apply can fail **before any menuDays are created** (often HTTP 500 with empty body on production apply route).

| Item | Requirement |
|------|-------------|
| **When** | **Before first generator apply** for any new provider |
| **How** | Run `syncProviderToSanity` (`lib/cms/syncProviderToSanity.ts`) — upserts Sanity `provider` doc from Supabase row |
| **Nature** | Provider **metadata mirror** only — not menu content |
| **Verification** | Read-only GROQ: `*[_type == "provider" && _id == $providerId][0]{_id,name,"slug":slug.current}` must return doc |
| **Identity** | Sanity `_id` and slug must match Supabase `providers.id` and `providers.slug` |

**Production learning (2026-07-06):** Swedish Lunch Pilot first apply attempt failed because Sanity provider mirror was missing. Mirror was synced from Supabase; apply then succeeded. See §3.4 and evidence PRs #427 / #428.

**Onboarding checklist addition:** `syncProviderToSanity` is mandatory between provider auth setup and first dryRun/apply.

**Code enforcement (main @ #429+):** Localized generator apply/dryRun runs read-only provider mirror preflight in code. Missing or mismatched mirror returns structured blocker (`provider_mirror_*`) — apply stops before Sanity writes (no HTTP 500 empty body). dryRun sets `applyBlocked=true` and `safeToApply=false`; operator must verify `safeToApply=true` before scoped apply GO. Apply route does **not** auto-sync mirror to production Sanity.

---

## 2. Hard gates before SOT

All gates must **PASS** before any SOT planning cutover or broad rollout. Any **FAIL** → **STOP**.

### 2.1 Employee safety (hard stop)

| Gate | Verification | Fail action |
|------|--------------|-------------|
| No employee economy exposure | `/api/week`, `/api/order/window` — scan for `unit_price`, `commission`, `invoice`, currency fields | STOP |
| No employee metadata exposure | Same APIs — scan for `approved_by`, hash fields, internal audit keys | STOP |
| Employee locale cannot override provider `menuLocale` | Provider settings `locale` + `menuProfileId` drive surface; employee UI reads materialized menu only | STOP if cross-locale bleed |

### 2.2 Order identity (Protected Golden Path)

| Gate | Verification |
|------|--------------|
| Order write-path unchanged | No edits to `lp_order_set`, order RPC wrappers, cutoff GUC without Protected Golden Path audit |
| Order count stable | Pre/post apply dryRun: provider order count unchanged |
| Order identity stable | `/api/order/window` item keys stable across consecutive reads |
| No order deletion on rollback | Rollback deletes **draft Sanity docs only** — never orders |

### 2.3 Catalog safety

| Gate | Verification |
|------|--------------|
| Strict mode default | UI + API default `overwriteMode=create_missing_only_strict` |
| No silent catalog update | `catalogDiffWouldUpdateExisting=false` on dryRun before apply |
| DryRun idempotency | Post-apply dryRun: `createdDraftDays=0`, existing categories `skipped_existing` |
| Replace catalog gated | `replace_catalog_with_confirmation` requires phrase + token; blocked without both |
| Published protection | Apply must not mutate published menuDays or published catalog without explicit mode + GO |

### 2.4 Rollback path proven

| Gate | Verification |
|------|--------------|
| Draft-only rollback | Canary rollback: delete provider vegetarian + menuDay drafts only if `approvedForPublish=false` and `customerVisible=false` |
| Global templates protected | Rollback must **never** delete global `lunchCategory` templates |
| Flag rollback documented | `LP_LOCALIZED_FIXED_MENU_GENERATOR=OFF` disables apply UI/route without deleting Sanity |

### 2.5 Provider-specific readiness

Per provider before first apply:

| Check | Required |
|-------|----------|
| Supabase provider + organizations mirror + `provider_settings` | Yes |
| `provider_admin` membership/auth | Yes |
| **Sanity provider mirror document** | **Yes** — verified read-only before apply |
| `provider_settings.menuProfileId` set | Yes |
| `provider_settings.locale` matches profile market | Yes |
| `LP_MENU_PROFILE_RESOLVER` resolves profile | Yes |
| Profile resolves: `menuLocale`, `menuProfileId`, country, currency | Yes |
| Existing catalog snapshot documented | Yes |
| Far-future week selected (no live orders on target week) | Yes |
| DryRun PASS with `unsupportedCategories=[]` | Yes |

**STOP** (fail-closed) if any of:

| Stop condition | Action |
|----------------|--------|
| Sanity provider mirror missing | Sync via `syncProviderToSanity`; re-verify read-only; **do not apply** |
| Provider slug/id mismatch between Supabase and Sanity mirror | Fix mirror; **STOP** |
| `providerRef` cannot resolve in Sanity | **STOP** — apply will fail on `menuDay` / catalog writes |
| dryRun requires metadata that does not exist | **STOP** — fix onboarding prerequisites first |
| `would_update` on existing provider catalog in strict mode | **STOP** — separate GO required |

### 2.6 Locale-specific readiness

All 9 locales must pass checklist in §4 before that market's providers enter rollout queue.

---

## 3. Provider rollout model

**Principle:** One provider at a time · dryRun first · apply only after explicit GO · **no auto-apply**.

### 3.1 Rollout sequence (per provider)

**Safe onboarding → apply order** (each step must PASS before the next):

```
0. Onboarding (Supabase + auth)
   - create provider in Supabase (e.g. lp_provider_create)
   - create organizations mirror row
   - upsert provider_settings (locale, menuProfileId, country, currency, timezone)
   - create provider_admin membership + auth user

1. Sanity provider mirror (mandatory before apply)
   - syncProviderToSanity(providerId)
   - verify read-only: Sanity provider doc exists; _id == providers.id; slug matches

2. Pre-snapshot (read-only)
   - order count (global + provider-scoped)
   - provider lunchCategory docs + _rev
   - menuDay docs for target week (expect 0 on clean week)
   - /api/week + /api/order/window (employee spot-check if applicable)

3. dryRun-only (mandatory — clean far-future week)
   - overwriteMode: create_missing_only_strict
   - categoryScope: all_supported
   - dryRun: true
   - Expected: unsupportedCategories=[]; catalog updates=0 for existing catalogs
   - Archive dryRun/onboarding evidence (docs PR)

4. Operator GO review
   - Review dryRun diff summary
   - Confirm week is far-future OR explicitly approved near-term GO
   - Confirm no catalog would_update
   - Separate scoped GO required for apply

5. Apply (single session, single idempotencyKey)
   - dryRun: false
   - Same inputs as pre-apply dryRun
   - No blind retry — read Sanity before any retry

6. Read-back
   - Sanity: created docs, tier count (15 for 5-day varmrett), draft flags
   - Catalog _rev unchanged for skipped categories
   - Localized labels on provider menu surface

7. Post-apply dryRun (idempotency)
   - createdDraftDays=0
   - existing categories skipped_existing
   - vegetarian != would_create_category (when catalog was created in apply)

8. Safety regression + evidence archive
   - order count unchanged
   - employee APIs PASS
   - no economy/metadata leak
   - archive apply evidence (docs PR)
```

**First-time provider rule:** Steps 0 → 1 → 3 (dryRun) must complete **before** any step 5 apply GO. Step 1 is **not optional** — missing mirror caused production apply failure in sv-SE session (§3.4).

### 3.2 Apply mode policy

| Mode | Use |
|------|-----|
| `create_missing_only_strict` | **Default** — only missing provider docs + missing menuDay drafts |
| `create_future_menu_days_only` | Varmrett-only; skips all catalog categories |
| `create_missing_only` | **Legacy — do not use in production rollout** |
| `replace_catalog_with_confirmation` | **Forbidden** without explicit operator phrase + token + separate GO |

### 3.3 Explicit non-goals

- No batch apply across providers
- No scheduled/cron apply
- No auto-rollout coupling (`runMenuWeekRollout*` remains forbidden)
- No publish as part of apply (publish is separate workflow)
- **SOT remains NO-GO** until separate design GO
- **Auto-rollout remains NO-GO** — no cron/batch until separate product GO
- Employee economy and internal metadata must remain hidden on employee APIs
- Order write-path and **`lp_order_set`** must remain untouched

### 3.4 Evidence reference — sv-SE provider #2 (first non-nb apply)

| Item | Reference |
|------|-----------|
| Onboarding + dryRun evidence | PR [#427](https://github.com/Lunchportalen/lunchportalen/pull/427) · [`phase-b-provider-2-sv-se-onboarding-evidence.md`](../evidence/phase-b-provider-2-sv-se-onboarding-evidence.md) |
| Production apply evidence | PR [#428](https://github.com/Lunchportalen/lunchportalen/pull/428) · [`phase-b-sv-se-production-apply-evidence.md`](../evidence/phase-b-sv-se-production-apply-evidence.md) |
| Provider | Swedish Lunch Pilot · `a08e4742-c89d-48c5-a6a8-cf8532179083` · `sv-SE` / `swedish_lunch` |
| Week applied | `2031-09-01` → `2031-09-05` (far-future drafts only) |
| **Learning** | First apply attempt **failed** — missing Sanity provider mirror (HTTP 500, empty body) |
| **Fix** | Provider mirror synced from Supabase before retry; apply then **PASS** |
| Apply RID | `prov_mapply_mr8g5iyz_5qaxbt6yyyjwxcge` |

**Operator takeaway:** Always run `syncProviderToSanity` and verify mirror read-only **before** first generator apply for any new provider.

---

## 4. Country / locale checklist (9 markets)

Each locale requires **staging smoke + production dryRun spot-check** on a provider configured with that `menuLocale` before rollout queue entry.

| Locale | Market | `menuProfileId` (authoritative registry) |
|--------|--------|---------------------------------------------|
| `nb-NO` | Norway | `norwegian_company_lunch` |
| `sv-SE` | Sweden | `swedish_lunch` |
| `da-DK` | Denmark | `danish_office_lunch` |
| `fi-FI` | Finland | `finnish_office_lunch` |
| `de-DE` | Germany | `german_business_lunch` |
| `en-GB` | United Kingdom | `uk_office_lunch` |
| `fr-FR` | France | `french_dejeuner` |
| `es-ES` | Spain | `spanish_menu_del_dia` |
| `it-IT` | Italy | `italian_office_lunch` |

### 4.1 Per-locale verification matrix

For **each** locale, record PASS/FAIL:

| # | Check | Method |
|---|-------|--------|
| L1 | Category labels localized | `/leverandor/meny` — no Norwegian labels when locale ≠ nb-NO |
| L2 | Dish bank populated | Generator preview shows locale dishes for all enabled categories |
| L3 | Allergens formatted | Catalog + menuDay allergens use allowlist; locale-appropriate display on menuDay |
| L4 | No Norwegian fallback | Serialized preview/draft must not contain `Påsmurt`, `Salatboks`, `Ost & Skinke` when locale ≠ nb-NO |
| L5 | Employee locale boundary | Employee `/week` shows materialized menu; employee browser locale does **not** override provider `menuLocale` on provider surface |
| L6 | Economy hidden | `/api/week`, `/api/order/window` — no commercial fields |
| L7 | dryRun capability | `unsupportedCategories=[]` for provider with full profile |
| L8 | Strict dryRun idempotency | After staging apply on clean week — post dryRun PASS |

**Launch readiness for 9 countries:** all 9 locales **L1–L8 PASS** on staging; production dryRun spot-check per market before first production apply in that market.

---

## 5. SOT readiness — boundary definition

**SOT (source of truth)** for localized generator rollout means: **generated localized menu content becomes the authoritative input for provider menu materialization and downstream employee visibility** — without changing order write contracts.

### 5.1 What SOT **would** change (future — not started)

| Domain | Potential change |
|--------|------------------|
| Provider menu catalog | Generated localized fixed categories become primary provider `lunchCategory` source for enrolled providers |
| Varmrett menuDays | Generated drafts promoted through existing publish workflow become employee-visible menu days |
| Profile resolver | Resolver output + generator output aligned as single profile truth for enabled providers |
| Observability | SOT audit events linking generator apply → publish → employee `/week` |

### 5.2 What SOT **must not** change

| Domain | Boundary |
|--------|----------|
| Order write-path | **`lp_order_set`**, order RPC, cutoff enforcement — **LOCKED** |
| Employee order identity | Item keys, variant slugs, tenant scoping — unchanged |
| RLS / DB schema | No migration without separate audit |
| Global Sanity templates | Seed-only; never deleted in rollback |
| Published docs without GO | No silent republish |
| Auto-rollout | **Deferred** — no cron/batch until separate product GO |

### 5.3 Source-of-truth hierarchy (target state)

```
provider_settings (menuProfileId, locale, country)
        ↓
menu profile resolver (LP_MENU_PROFILE_RESOLVER)
        ↓
localized generator (LP_LOCALIZED_FIXED_MENU_GENERATOR) — apply creates Sanity drafts/catalog
        ↓
existing publish / materialization chain → menu_service_days → employee /week
        ↓
order write-path (UNCHANGED — lp_order_set)
```

**SOT cutover GO** is required before step 3 output replaces ad-hoc manual catalog editing as authoritative for enrolled providers.

### 5.4 Employee-safe boundary

Employees consume **materialized** menu days only. Generator apply creates **draft** Sanity docs. SOT must not expose generator internals, economy config, or profile mapping proposals on employee APIs.

---

## 6. Rollback

### 6.1 Flag rollback

| Action | Effect |
|--------|--------|
| `LP_LOCALIZED_FIXED_MENU_GENERATOR=OFF` | Hides generator apply UI; blocks apply API — **no Sanity deletion** |
| `LP_MENU_PROFILE_RESOLVER=OFF` | **Separate SUPERSMART rollback** — not part of localized generator rollback |

### 6.2 Provider apply rollback (draft-only)

**Allowed** when docs were created in controlled apply session:

| Doc type | Delete allowed if |
|----------|-------------------|
| Provider-scoped `lunchCategory` | Created in session · `providerRef` matches · not order-locked |
| `menuDay` drafts | `approvedForPublish=false` · `customerVisible=false` · target week · providerRef matches |

**Forbidden:**

- Delete global templates
- Delete published menuDays
- Delete existing catalog docs predating apply
- Touch orders or order history

### 6.3 Published protection

Apply and rollback must respect:

- `approvedForPublish=true` → **no delete, no overwrite** without publish workflow rollback
- Order-locked catalog items → apply blocked by `assertCatalogWriteAllowed`

### 6.4 Rollback verification checklist

After rollback:

- dryRun shows prior `would_create` state for removed docs only
- order count unchanged
- employee APIs PASS
- global template `_rev` unchanged

---

## 7. Observability

### 7.1 Apply audit fields (required in logs/responses)

| Field | Purpose |
|-------|---------|
| `rid` | Trace ID |
| `providerId` | Tenant scope |
| `weekStart` | Target week |
| `menuLocale` | Resolved locale |
| `menuProfileId` | Profile used |
| `categoryScope` | `all_supported` / etc. |
| `overwriteMode` | Must log strict mode |
| `dryRun` | true/false |
| `idempotencyKey` | Dedup / session trace |

### 7.2 Diff summary counts (dryRun + apply)

| Metric | Alert if unexpected post-apply dryRun |
|--------|--------------------------------------|
| `createdDraftDays` | > 0 |
| `updatedDraftDays` | > 0 |
| `createdCategories` | > 0 when category already exists |
| `updatedCategories` | > 0 in strict mode |
| `skippedExistingCategories` | Drop without explanation |
| `unsupportedCategories` | > 0 |
| `blockedPublishedCategories` | > 0 without operator review |

### 7.3 Per-session safety checks

| Check | When |
|-------|------|
| Order count (provider) | Before + after apply/dryRun |
| Employee `/api/week` | After apply on providers with live employees |
| Employee `/api/order/window` | After apply |
| Economy/metadata scan | Every production session |
| Sanity `_rev` snapshot | Pre/post for existing catalog categories |

### 7.4 Evidence retention

Archive each production session to `docs/evidence/` (docs-only PR) with:

- commit SHA
- provider + week
- dryRun summary JSON (redacted)
- read-back counts
- safety PASS/FAIL

---

## 8. Launch decision matrix

| Phase | GO criteria | NO-GO triggers |
|-------|-------------|----------------|
| **A — Canary complete** | Melhus canary + PR #420 dryRun PASS · evidence archived | Any catalog _rev drift · order mutation · employee leak |
| **B — Single provider apply** | Phase A + per-provider dryRun PASS + operator GO + read-back PASS + post dryRun idempotent | `would_update` on existing catalog · publish touched · idempotency fail |
| **C — Multi-provider rollout** | Phase B repeated per provider · 9-locale checklist complete for each market | Any provider FAIL · locale fallback detected |
| **D — SOT activation** | Phase C stable · publish workflow proven · rollback drill PASS · separate SOT design GO | Order path touched · auto-rollout requested · missing rollback proof |
| **E — Auto-rollout** | **DEFERRED** — not in scope | Any batch/cron apply proposal |

### 8.1 Current position

| Phase | Status |
|-------|--------|
| A — Canary complete | **PASS** (Melhus · nb-NO) |
| B — Single provider apply | **PASS** (Melhus weeks + Swedish Lunch Pilot sv-SE week `2031-09-01` — evidence #425–#428) |
| C — Multi-provider rollout control | **IN PROGRESS** — factory/runbook/readiness plan; **no live onboarding without scoped GO** |
| D — SOT activation | **NOT STARTED** · **NO-GO** |
| E — Auto-rollout | **DEFERRED** · **NO-GO** |

Provider mirror preflight (PR #430) + production smoke (PR #431) are archived. Phase C onboarding is controlled via:

- [`docs/runbooks/phase-c-9-country-provider-rollout.md`](phase-c-9-country-provider-rollout.md)
- [`docs/evidence/phase-c-9-country-launch-readiness-plan.md`](../evidence/phase-c-9-country-launch-readiness-plan.md)
- `lib/provider-onboarding/*` + `scripts/ops/provider-onboarding/phase-c-onboard-provider.mjs`

---

## 9. Recommended next steps (each requires separate GO)

1. **Phase C provider onboarding** — factory `--dry-run` then gated `--apply` for next locale (`da-DK` first). Includes mandatory `syncProviderToSanity`.
2. **Generator dryRun** — require `providerMirrorPreflight.ok=true`, `safeToApply=true`, `applyBlocked=false`.
3. **Evidence archive** after onboarding and after dryRun.
4. **Menu apply** — separate scoped GO only (one provider · one far-future week).
5. **SOT design doc** — plan only until all 9 locales pass gates and explicit SOT GO.
6. **Do not** start SOT, auto-rollout, or additional production applies without explicit operator GO.

---

## 10. Related documents

| Document | Role |
|----------|------|
| [`docs/evidence/localized-generator-production-evidence.md`](../evidence/localized-generator-production-evidence.md) | Production verification archive |
| [`docs/evidence/phase-b-provider-2-sv-se-onboarding-evidence.md`](../evidence/phase-b-provider-2-sv-se-onboarding-evidence.md) | Provider #2 sv-SE onboarding + dryRun (#427) |
| [`docs/evidence/phase-b-sv-se-production-apply-evidence.md`](../evidence/phase-b-sv-se-production-apply-evidence.md) | First non-nb production apply + mirror prerequisite (#428) |
| [`docs/evidence/pr430-production-smoke-evidence.md`](../evidence/pr430-production-smoke-evidence.md) | Provider mirror preflight production smoke (#431) |
| [`docs/runbooks/phase-c-9-country-provider-rollout.md`](phase-c-9-country-provider-rollout.md) | Phase C operator rollout control |
| [`docs/evidence/phase-c-9-country-launch-readiness-plan.md`](../evidence/phase-c-9-country-launch-readiness-plan.md) | Phase C readiness matrix + next GO prompt |
| [`lib/cms/syncProviderToSanity.ts`](../../lib/cms/syncProviderToSanity.ts) | Sanity provider mirror upsert (mandatory before first apply) |
| [`lib/provider-onboarding/`](../../lib/provider-onboarding/) | Phase C onboarding planner/execute contracts |
| [`docs/runbooks/g5d8-planning.md`](g5d8-planning.md) | G5d.8 / compatibility SOT boundary (separate track) |
| [`docs/PROTECTED_GOLDEN_PATH.md`](../PROTECTED_GOLDEN_PATH.md) | Order write-path lock |
| [`AGENTS.md`](../../AGENTS.md) | Enterprise law · fail-closed · RC gates |

**STOP.** This plan does not authorize SOT, auto-rollout, production apply, Sanity mutation, flag activation, or order-path changes.
