# Localized Generator SOT Dry-Run Proof Evidence

**Status:** Evidence archived · docs-only · **SOT dry-run proof PASS**
**Date:** 2026-07-10
**Main HEAD (archive):** `4836f2bc` — feat(menu): add localized generator SOT runtime hook default off (#473)
**Phase:** F1 — dry-run proof (simulated env only; no production env change)
**Design authority:** [`docs/engineering/localized-generator-sot-cutover-implementation-plan.md`](../engineering/localized-generator-sot-cutover-implementation-plan.md)

This document records the scoped dry-run proof that the Gate F0 SOT runtime hook correctly evaluates authoritative-source decisions for **Danish Lunch Pilot** without mutation, without production env changes, and without starting SOT cutover.

**No secret values, tokens, passwords, connection strings, env values, or private tenant PII are recorded.**

---

## 1. Scope

| Item | State |
|------|-------|
| Purpose | Phase F1 dry-run proof — verify SOT hook decision logic for one provider/week/doc |
| Production mutation | **NONE** |
| Production env change | **NONE** — all dry-run cases used simulated `env` bags in local process only |
| SOT cutover | **NOT STARTED** |
| Auto-rollout | **NOT STARTED** |
| Publish / generator apply / onboarding apply / Phase D apply | **NOT RUN** |
| Sanity mutation | **NONE** |
| Supabase mutation | **NONE** |
| Billing/Stripe | **NOT TOUCHED** |
| Order write-path · `lp_order_set` | **NOT TOUCHED** |
| Hook wiring | **UNCHANGED** — not wired to `/week`, webhook, materialization serve, or orders |

---

## 2. Target provider / week / doc

| Field | Value |
|-------|-------|
| Provider | Danish Lunch Pilot |
| ProviderId | `799ba3a2-a127-48a0-87b7-87944a2f42a3` |
| Locale / profile | `da-DK` / `danish_office_lunch` |
| Doc | `menuDay-799ba3a2-a127-48a0-87b7-87944a2f42a3-2031-11-03-BASIS-varmrett` |
| Date / week | `2031-11-03` (Monday, far-future) |
| Tier | `BASIS` |
| Generated content | `mealTitle`: «Kylling i karry» |
| Why safe | Far-future date; prior visibility/materialization proof (#471) scoped; dry-run is decision-only |

---

## 3. Production read-only preflight (2026-07-10)

| Check | Result |
|-------|--------|
| Danish provider row (Supabase) | **Exists** — `Danish Lunch Pilot` · id `799ba3a2-a127-48a0-87b7-87944a2f42a3` |
| Target doc (Sanity production) | **Exists** — `_rev A9KxU337ELsycETkokQcEf` · `approvedForPublish=true` · `customerVisible=true` · `providerRef` match · `planTier=BASIS` · `date=2031-11-03` |
| SOT flags in production runtime | **Not wired** — `resolveLocalizedGeneratorSotDecision` / `isLocalizedGeneratorSotEnabled` absent from `app/` routes |
| Production env SOT activation | **None** — no live env mutation performed in this session |
| Auto-rollout | **Not enabled** — resolver always returns `autoRollout: false` |
| Phase D | **Source-only** — governance tests confirm 12 targets `SOURCE_ONLY` |
| Orders (global) | **17** — unchanged |
| `menu_service_days` Danish | **1 row** — `service_date 2031-11-03` · `state published` (visibility proof artifact) |
| `menu_service_days` total | **87** |
| Billing tables | **Not queried for mutation** — no invoice/charge actions |

---

## 4. Dry-run execution method

- **Harness:** local Node process importing `resolveLocalizedGeneratorSotDecision` and `buildLocalizedGeneratorSotProviderControl` from main @ `4836f2bc`
- **Env simulation:** in-memory `env` object passed to resolver — **not** written to Vercel, `.env`, or production runtime
- **Target providerId:** `799ba3a2-a127-48a0-87b7-87944a2f42a3` for all cases
- **Abort conditions:** any `hasMutationIntent: true`, any `sourceOfTruthChanged: true`, any `canServeGeneratedAsAuthoritative: true`, any production write → **STOP** (none occurred)

---

## 5. Dry-run cases tested

### Case 1 — No env (default OFF)

| Field | Result |
|-------|--------|
| `sotMasterEnabled` | `false` |
| `selectedSource` | `legacy` |
| `wouldSelectGenerated` | `false` |
| `hasMutationIntent` | `false` |
| `controlStatus` | `inactive` |
| Reasons | `kill_switch_off`, `sot_master_flag_off` |
| **PASS** | Default OFF ⇒ legacy |

### Case 2 — SOT enabled, empty allowlist

| Field | Result |
|-------|--------|
| Env | `LP_LOCALIZED_GENERATOR_SOT_ENABLED=true` only |
| `providerAllowlisted` | `false` |
| `wouldSelectGenerated` | `false` |
| `selectedSource` | `legacy` |
| Reasons | `provider_not_in_allowlist` |
| **PASS** | Enabled without allowlist ⇒ legacy |

### Case 3 — SOT enabled, wrong provider allowlisted

| Field | Result |
|-------|--------|
| Allowlist | Melhus `11111111-1111-1111-1111-111111111111` |
| Target | Danish pilot |
| `providerAllowlisted` | `false` |
| `wouldSelectGenerated` | `false` |
| **PASS** | Wrong allowlist ⇒ legacy for Danish |

### Case 4 — Danish allowlisted + dry-run (primary proof)

| Field | Result |
|-------|--------|
| Env | `SOT_ENABLED=true` · `ALLOWLIST=799ba3a2-…` · `DRY_RUN=true` |
| `sotEligible` | `true` |
| `dryRun` | `true` |
| `wouldSelectGenerated` | **`true`** |
| `selectedSource` | `legacy` (F0 fail-closed — no serve) |
| `canServeGeneratedAsAuthoritative` | `false` |
| `hasMutationIntent` | `false` |
| `controlStatus` | `dry_run` |
| Reasons | `dry_run_observe_only`, `would_select_generated_when_wired` |
| **PASS** | Dry-run reports future generated authoritative path without mutation |

### Case 5 — Malformed master flag

| Field | Result |
|-------|--------|
| Env | `LP_LOCALIZED_GENERATOR_SOT_ENABLED=yes` (invalid) |
| `sotMasterEnabled` | `false` |
| `wouldSelectGenerated` | `false` |
| **PASS** | Fail-closed to OFF |

### Case 6 — Kill switch (master OFF, allowlist + dry-run present)

| Field | Result |
|-------|--------|
| Env | allowlist + dry-run only; master absent |
| `sotMasterEnabled` | `false` |
| `wouldSelectGenerated` | `false` |
| **PASS** | Kill switch ⇒ legacy |

### Case 7 — Auto-rollout flag present (ignored)

| Field | Result |
|-------|--------|
| Env | SOT + allowlist + dry-run + `AUTO_ROLLOUT_ENABLED=true` |
| `autoRollout` | **`false`** (resolver invariant) |
| `wouldSelectGenerated` | `true` |
| `hasMutationIntent` | `false` |
| Reasons include | `auto_rollout_forbidden` |
| **PASS** | Auto-rollout not coupled to SOT dry-run |

---

## 6. Summary results

| Requirement | Result |
|-------------|--------|
| Default OFF ⇒ legacy | **PASS** |
| Enabled + not allowlisted ⇒ legacy | **PASS** |
| Wrong allowlist ⇒ legacy | **PASS** |
| Allowlisted + dry-run ⇒ `wouldSelectGenerated=true` | **PASS** |
| No mutation intent | **PASS** — all cases `hasMutationIntent: false` |
| `canServeGeneratedAsAuthoritative` remains false (F0) | **PASS** |
| Auto-rollout false | **PASS** |
| Kill-switch / malformed env fail-closed | **PASS** |

---

## 7. Boundaries verified

| Boundary | Result |
|----------|--------|
| Phase D | **SOURCE_ONLY** — no production activation |
| Billing/Stripe | **Untouched** — no billing calls or invoice actions |
| Protected Golden Path | **Untouched** — no order-path file changes |
| `lp_order_set` | **Untouched** |
| Employee/API | Hook not wired — no economy/metadata exposure introduced |
| msdi / Gate F work item | **`tier_products_global_catalog` v1** documented · `msdiLocalizedMappingBlocked: true` — localized item mapping still requires separate PR before cutover |

---

## 8. Tests run (local @ `4836f2bc`)

| Command | Result |
|---------|--------|
| `npm run typecheck` | **PASS** |
| `npm run lint` | **PASS** |
| `npm run ci:commercial-hardcodes-guard` | **PASS** |
| `npm run test:golden-path` | **PASS** (101 tests) |
| `npm run test:run` | **PASS** (5226 tests) |
| Focused: `localizedGeneratorSotFeatureFlag.test.ts` | **PASS** |
| Focused: `localizedGeneratorSotResolver.test.ts` | **PASS** |
| Focused: `localized-generator-sot-runtime-hook-governance-contracts.test.ts` | **PASS** |

---

## 9. Decision

| Item | State |
|------|-------|
| Dry-run proof | **PASS** |
| SOT cutover ready | **NO** — requires separate scoped cutover GO, msdi decision, F3 preflight |
| SOT started | **NO** |
| Auto-rollout started | **NO** |
| Production mutation | **NONE** |

---

## 10. Next action

| Item | Action |
|------|--------|
| This document | Archive evidence (docs-only PR) |
| Next gate | Scoped production SOT cutover planning/preflight — **separate GO** |

**Exact next GO prompt (separate GO only):**

```text
GO merge SOT dry-run proof evidence PR — docs-only, no SOT start, no production mutation
```

After evidence merge, cutover itself requires:

```text
GO scoped SOT cutover for one provider/week — explicit production mutation allowed, no auto-rollout
```

**STOP.** Do not start SOT. Do not auto-rollout. Do not publish. Do not mutate production.
