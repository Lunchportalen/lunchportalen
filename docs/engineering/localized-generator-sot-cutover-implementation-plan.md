# Localized generator SOT cutover implementation plan

**Status:** IMPLEMENTATION PLAN ONLY · **SOT NOT STARTED** · **auto-rollout NOT STARTED**
**Date:** 2026-07-09
**Main HEAD (plan audit):** `d6228a45` — docs(menu): archive localized generator visibility materialization proof (#471)
**Design authority:** [`localized-generator-sot-cutover-design.md`](./localized-generator-sot-cutover-design.md)
**Evidence chain:** Gates A–E + visibility/materialization proof archived on main (#458–#471)

This document describes **exactly how Gate F SOT cutover must be implemented later**. Merging this document does **not** start SOT, does **not** change runtime, does **not** authorize production mutation, publish, generator apply, onboarding apply, Phase D apply, billing/Stripe work, or any order write-path change. Every executable step requires its own separate, scoped operator GO.

**No secret values, tokens, passwords, connection strings, env values, or private tenant PII are recorded.**

---

## 1. Purpose

- **Plan** a future SOT cutover for the localized fixed menu generator — implementation sequencing, flags, tests, read-back, rollback, and boundaries.
- **Confirm** this document does **not** start SOT. No authoritative-source switch occurs by merging this plan.
- **Confirm** this document does **not** change runtime. No code, tests, migrations, scripts, or production flags are modified by this PR.
- **Confirm** this document does **not** authorize production mutation. No Sanity patch, no Supabase write, no publish, no materialization trigger, no billing action.

Gate F planning closes the "how to implement cutover" gap left after Gates A–E and the visibility/materialization proof. Gate F **cutover execution** remains a separate future GO.

---

## 2. Current readiness state

| Gate / track | Status | Evidence |
|---|---|---|
| Gate A — Phase C stability | **PASS** | Phase C chain #446–#458 · launch chain #459–#462 · post-launch monitoring #462 |
| Gate B — Publish workflow proof | **PASS** | PR #469 · [`localized-generator-publish-workflow-proof-evidence.md`](../evidence/localized-generator-publish-workflow-proof-evidence.md) |
| Gate C — Rollback drill | **PASS** | PR #468 · [`localized-generator-rollback-drill-evidence.md`](../evidence/localized-generator-rollback-drill-evidence.md) |
| Gate D — SOT cutover design | **PASS** | PR #465 · design doc on main |
| Gate E — Final SOT readiness audit | **Archived** | PR #470 · [`final-sot-readiness-audit.md`](../evidence/final-sot-readiness-audit.md) |
| Visibility/materialization proof | **PASS** | PR #471 · [`localized-generator-visibility-materialization-proof-evidence.md`](../evidence/localized-generator-visibility-materialization-proof-evidence.md) |
| Gate F — SOT cutover | **NOT STARTED** | Requires implementation PR + separate explicit cutover GO |
| Auto-rollout | **NOT STARTED · DEFERRED** | No generator coupling to `runMenuWeekRollout*` |
| Phase D (12 locales) | **SOURCE_ONLY** · 0 production footprint | `phaseDLocales` governance tests |
| Billing / Stripe | **Separate track** · untouched by SOT gates | Global Billing Engine own gates |

**Repo scan (2026-07-09):** `LP_LOCALIZED_GENERATOR_SOT*` absent from `lib/`, `app/`, `components/` — no accidental activation path exists today.

---

## 3. What SOT means

**SOT (source of truth) cutover** means: **generated localized menu content becomes the authoritative input for provider menu materialization and downstream employee visibility for explicitly enrolled providers** — flowing through the existing publish/materialization chain (`menu_service_days` → employee `/week`) without changing any order write contract.

Target hierarchy (unchanged):

```
provider_settings (menuProfileId, locale, country)
        ↓
menu profile resolver (LP_MENU_PROFILE_RESOLVER)
        ↓
localized generator (LP_LOCALIZED_FIXED_MENU_GENERATOR) — apply creates Sanity drafts/catalog
        ↓
SOT authoritative-source selection (NEW — per enrolled provider, flag-gated)
        ↓
existing publish / materialization chain → menu_service_days → employee /week
        ↓
order write-path (UNCHANGED — lp_order_set)
```

### What SOT does not mean

- SOT does **not** change the order write-path. `lp_order_set`, RPC wrappers, cutoff (`orders_cutoff_0800`, GUC path), order identity, item keys, variant slugs, and tenant scoping remain byte-identical in behavior.
- SOT does **not** imply auto-rollout. No cron, no batch apply, no scheduled publish. `LP_LOCALIZED_GENERATOR_AUTO_ROLLOUT_ENABLED` remains OFF and deferred.
- SOT does **not** imply Phase D apply. The 12 Phase D locales stay `SOURCE_ONLY` with zero production footprint.
- SOT does **not** imply billing/Stripe activation. No invoices, charges, payment status changes, or billing wiring into the menu chain.
- SOT does **not** imply publish. Generated drafts become employee-visible **only** through the existing `approvedForPublish` + `customerVisible` publish workflow with scoped GO.
- SOT does **not** relax tenant isolation, employee API safety, or fail-closed behavior anywhere.

---

## 4. Proposed cutover scope

Plan only — no cutover is authorized by this document.

| Dimension | Scoped default |
|---|---|
| Providers | **One** provider on first cutover — explicit allowlist entry only |
| Week/date | **One** far-future week or single `service_date` — smallest safe scope |
| Package/tier | **One** tier (e.g. `BASIS`) or smallest materialization scope proven in visibility proof |
| Docs | Minimum doc set for one weekday + one category (e.g. one `menuDay` varmrett doc) |
| Expansion | Only after read-back gates PASS — never provider-wide or market-wide in Gate F |
| Enrollment | Allowlist-based; empty allowlist ⇒ SOT inert even if master flag ON |

**Forbidden in Gate F cutover:**

- Broad rollout across 9 Phase C providers.
- Multi-week batch publish.
- Auto-approval of generated docs.
- Melhus or any protected provider unless explicitly scoped as the single target (Melhus is customer-critical — default out of bounds).

---

## 5. Required feature flags / kill switches

Proposed flags — **design + plan only; introduced in Phase F0 implementation PR with defaults OFF**. Names follow existing `LP_*` convention (`lib/menu-generator/featureFlag.ts`, `lib/menu-profile/featureFlag.ts`).

| Flag | Purpose | Default |
|---|---|---|
| `LP_LOCALIZED_GENERATOR_SOT_ENABLED` | Master switch for SOT authoritative-source selection | **OFF** |
| `LP_LOCALIZED_GENERATOR_SOT_PROVIDER_ALLOWLIST` | Comma-separated provider IDs enrolled in SOT; empty ⇒ inert | **empty** |
| `LP_LOCALIZED_GENERATOR_SOT_DRY_RUN` | Log/compare-only: computes SOT decision and diff without serving it | **OFF** |
| `LP_LOCALIZED_GENERATOR_AUTO_ROLLOUT_ENABLED` | Reserved for deferred auto-rollout track — **not part of Gate F** | **OFF** (future) |

### Kill switch behavior

- `LP_LOCALIZED_GENERATOR_SOT_ENABLED=OFF` ⇒ immediate revert to current behavior for all providers. No Sanity deletion, no Supabase mutation, no republish required.
- Removing a provider from allowlist ⇒ same revert scoped to that provider.
- Flag evaluation **fail-closed**: missing/malformed env ⇒ treated as OFF; malformed allowlist entries ⇒ ignored (provider not enrolled), logged with RID.
- `LP_LOCALIZED_FIXED_MENU_GENERATOR=OFF` continues to disable apply UI/route independently (existing rollback lever, unchanged).

### Required env verification (before any cutover GO)

- `/superadmin/system` health shows env/runtime OK — no DEGRADED cause from new flags.
- Flag state read back and archived in cutover evidence (flag **names** and ON/OFF state only — never secret values).
- Restart/redeploy law: flag changes require redeploy; verification post-deploy, pre-enrollment.

### Accidental activation prevention

- No SOT flag exists in code today (verified).
- Implementation PR must wire flags only at the authoritative-source selection point — not in order path, not in webhook, not in billing.
- Default-OFF tests required before any cutover GO (see §16).
- CI governance test must assert `LP_LOCALIZED_GENERATOR_SOT_ENABLED` default OFF in production env bag fixtures.

---

## 6. Materialization architecture

### Existing publish predicate (unchanged)

`app/api/webhooks/sanity/menu-day/route.ts`:

- `menuDayIsPublishVisible(doc)` requires **both** `approvedForPublish=true` **and** `customerVisible=true`.
- If not visible → unpublish path deletes materialized rows.
- Gate B proved approval-only (`approvedForPublish=true`, `customerVisible=false`) creates **zero** `menu_service_days` rows.

### `menu_service_days` materialization path

`lib/menu-publish/syncMenuServiceDaysFromMenuDay.ts`:

1. Resolve provider-scoped **ACTIVE** agreements matching weekday + tier (`agreement_delivery_days`).
2. Resolve companies and locations for those agreements.
3. UPSERT one `menu_service_days` row per location per `service_date`.
4. Call `syncMenuServiceDayItemsAfterMenuDayPublish` for item snapshots.

**Tenant chain required (proven in visibility proof):** `ACTIVE agreement → agreement_delivery_days (weekday+tier) → company → company_location`. Without this chain, materialization is impossible — fail-closed.

### `menu_service_day_items` behavior (current runtime)

`lib/menu-publish/syncMenuServiceDayItems.ts`:

- After MSD upsert, snapshots **tier product catalog** rows from global `products` table (`company_id IS NULL`, allowed SKUs: Paasmurt, Salatboks, Varmrett, etc.).
- Prices from `TIER_PRICE_CENTS` in `lib/menu-publish/tierPricing.ts` — **NOK-denominated defaults** (e.g. BASIS 9000 øre).
- Fetches varmrett projection from Sanity for display metadata, but commercial line identity comes from tier products — not generated localized menuDay body.
- Visibility proof (#471) confirmed: 3 `menu_service_day_items` rows with tier product names/prices, **not** generated localized content ("Kylling i karry").

### Known finding — Gate F implementation work item

**Evidence (#471 §9):** `menu_service_day_items` currently snapshot **tier-products / NOK prices** (Paasmurt, Salatboks, Varmrett at default NOK pricing), **not** generated localized content. Localized employee-facing menu text flows from Sanity `menuDay`; commercial line snapshots flow from global tier products.

**Why this matters for SOT:** SOT makes generated localized menuDays authoritative for materialization and employee visibility. If msdi snapshots remain NOK tier products while the provider market is DKK/de-DE/fr-FR/etc., cutover may expose correct Sanity menu text in `/week` but **wrong commercial identity/pricing** in order-adjacent surfaces that consume msdi — or create market confusion in proof read-back.

### Required decision (before cutover GO — not fixed in this PR)

| Option | Description | Implication |
|---|---|---|
| **A — SOT v1 accepts tier-product snapshots** | msdi remains global tier product identity; SOT only changes which Sanity menuDay is authoritative for menu text / varmrett projection | Faster cutover; per-market commercial naming/pricing deferred; must document NOK leakage risk for non-Norwegian markets |
| **B — msdi sync must include localized content** | Change item sync to map generated `mealTitle`/description/allergens and per-market price/currency from provider price rules before cutover | Larger implementation scope; required for commercial correctness in non-NB markets |

**Planning recommendation (fail-closed):** Treat Option B as the default requirement for non-`nb-NO` enrolled providers unless owner explicitly accepts Option A residual risk per market. Document the chosen option in cutover evidence before Gate F4.

**This PR does not implement either option.** It records the decision as a mandatory Gate F implementation work item.

---

## 7. Data model and content mapping work items

Plan only — mapping work happens in Phase F0 implementation PR(s).

### Generated `menuDay` must provide (Sanity)

| Field | Role |
|---|---|
| `providerRef` | Provider scope — must match Supabase `providers.id` |
| `date` / `service_date` | Materialization key |
| `planTier` (BASIS/LUXUS/ENTERPRISE) | Agreement tier match |
| `mealTitle` | Localized display title (generated docs use this; may lack top-level `allergens[]`) |
| `meal` ref / embedded meal | Description, allergens when present |
| `approvedForPublish` / `customerVisible` | Publish gate — both required for materialization |
| Category key (e.g. varmrett) | Tier catalog alignment |

### Materialization needs (Supabase)

| Entity | Source today | SOT consideration |
|---|---|---|
| `menu_service_days` | Webhook from visible menuDay + tenant chain | Row per location; `state=published`; provider_id scoped |
| `menu_service_day_items` | Tier products + `TIER_PRICE_CENTS` | **Decision required (§6)** — localized vs global snapshot |
| `agreement_delivery_days` | Company agreement config | Weekday key format `mon` not `monday` (`menuDaySyncShared.ts`) |

### Mapping rules to define in implementation

| Concern | Plan |
|---|---|
| Localized title | `mealTitle` → employee `/week` display; varmrett projection GROQ |
| Description / allergens | From `meal` ref; fallback fail-closed if incomplete |
| Tier/package snapshots | Default: global `products` SKUs per tier; SOT may require provider-scoped product rules |
| Per-market price/currency | Provider `provider_settings.currency` + price rules; avoid hardcoded NOK in non-NB markets |
| Fallback if generated content incomplete | Fail-closed: do not materialize msdi with empty categories; log RID + skip |
| NOK leakage prevention | Read-back must assert currency/price matches provider market for enrolled provider |
| Economy/metadata leakage | Employee API must not expose price rules, commission, billing fields — existing regression gates |

---

## 8. Protected Golden Path boundaries

Per [`docs/PROTECTED_GOLDEN_PATH.md`](../PROTECTED_GOLDEN_PATH.md):

| Invariant | Gate F rule |
|---|---|
| Order write-path | **UNCHANGED** — `app/api/orders/*`, `lib/orders/rpcWrite.ts`, `lib/orders/orderWriteGuard.ts` |
| `lp_order_set` | **UNCHANGED** — no SQL, RPC signature, GUC, or trigger change |
| Employee order contract | Item keys, variant slugs, `provider_id`/`company_id`/`location_id` stable |
| Cutoff enforcement | Employee 08:00 cutoff; provider advances via `lp_order_advance_status` GUC only |
| Pricing/order snapshot logic | **UNCHANGED** unless future PR explicitly scopes commercial snapshot work (Option B) |
| Billing/Stripe | Separate — no wiring into menu publish, `/week`, cutoff, provider order status |
| Invoice sending | **FORBIDDEN** in Gate F |
| Checkout/payment | **FORBIDDEN** in Gate F |
| Customer order mutation | **FORBIDDEN** — order count must match pre/post every session |
| Golden path tests | `npm run test:golden-path` + `guard-protected-golden-path.test.mjs` **required** before any cutover |

**Expectation:** SOT cutover should require **no protected file changes**. If implementation reveals otherwise → design escalation + new protected-path audit — not silent edit. Any protected touch declares **`Protected Golden Path Impact`** in PR body.

**G5d.8 reconciliation:** If cutover touches employee menu assembly hook (`LP_MENU_PROFILE_RUNTIME_COMPATIBILITY_HOOK`), reconcile with [`docs/runbooks/g5d8-planning.md`](../runbooks/g5d8-planning.md) — byte/schema parity evidence, `canProceedToRuntimeHook` governance.

---

## 9. Step-by-step future implementation plan

Each phase requires its own GO. Default: **forbidden** unless phase explicitly allows.

### Phase F0 — Implementation PR (code only, default OFF)

| | |
|---|---|
| **Allowed** | Add SOT flags to `lib/menu-generator/featureFlag.ts`; authoritative-source selection hook; dry-run logging; allowlist parser; governance tests; default-OFF CI proofs |
| **Forbidden** | Production flag ON; any Sanity/Supabase mutation; publish; cutover; billing touch; order path touch |
| **Required tests** | typecheck, lint, commercial-hardcodes-guard, golden-path, new SOT flag default-OFF tests |
| **Abort** | Any protected file change without audit; any default-ON flag |
| **Rollback** | Revert PR — no production state exists |
| **Evidence** | Implementation PR merged; flags verified OFF on main |

### Phase F1 — Dry-run proof (one provider/doc/week)

| | |
|---|---|
| **Allowed** | `LP_LOCALIZED_GENERATOR_SOT_DRY_RUN=ON` in preview/staging; compare SOT vs current source for one scoped provider/week; log diff with RID |
| **Forbidden** | Production mutation; serving SOT output to employees; publish; materialization |
| **Required tests** | Dry-run no-serve proof; non-enrolled provider invariance |
| **Abort** | Unexpected source diff affecting orders; leakage in dry-run output |
| **Rollback** | Flag OFF — instant |
| **Evidence** | Dry-run log archive (docs or CI artifact — no secrets) |

### Phase F2 — Staging-like / local verification

| | |
|---|---|
| **Allowed** | Full flag stack OFF except dry-run; local/staging employee API regression; materialization unit tests with mocked provider |
| **Forbidden** | Production Supabase/Sanity writes |
| **Required tests** | materialization tests, localized generator tests, employee API tests, anonymous 401 |
| **Abort** | Test failure on scope isolation or msdi content mismatch |
| **Rollback** | N/A — no production touch |
| **Evidence** | Test run summary in PR or ops log |

### Phase F3 — Production read-only preflight

| | |
|---|---|
| **Allowed** | Read-only GROQ/Supabase queries; flag state read-back; inventory counts; employee anonymous 401; order count |
| **Forbidden** | Any mutation; flag ON in production |
| **Required checks** | Gates A–E + visibility proof on main; implementation PR merged; all flags OFF; allowlist empty; Phase D footprint 0; billing untouched |
| **Abort** | Any drift vs evidence baselines; unexpected proof artifacts |
| **Rollback** | N/A |
| **Evidence** | Preflight checklist archived |

### Phase F4 — Scoped production SOT cutover (one provider/doc/week)

| | |
|---|---|
| **Allowed** | **Separate explicit GO only** — enable SOT for one allowlisted provider; optional single publish if not already visible; read-back |
| **Forbidden** | Auto-rollout; multi-provider; multi-week; billing; order mutation; Phase D apply; Melhus unless explicit target |
| **Required tests** | golden-path; employee scoped check; provider mirror check |
| **Abort** | Order count change; wrong-tenant materialization; economy/metadata leakage; msdi NOK in non-NB market without accepted risk |
| **Rollback** | Kill switch first (§12); then doc-level revert |
| **Evidence** | Cutover evidence PR (docs-only) |

### Phase F5 — Read-back and employee/API safety

| | |
|---|---|
| **Allowed** | Production read-only queries; authenticated employee route spot-check for scoped tenant only |
| **Forbidden** | Broad employee testing on unrelated tenants |
| **Required** | §11 monitoring checklist complete |
| **Abort** | Any leakage or unexpected msdi content |
| **Rollback** | Trigger §12 |
| **Evidence** | Included in cutover evidence PR |

### Phase F6 — Rollback / kill-switch validation

| | |
|---|---|
| **Allowed** | Disable SOT flag; verify instant revert; optional `customerVisible=false` on scoped doc |
| **Forbidden** | Order deletion; global template deletion; Melhus touch |
| **Required** | Kill-switch test in staging first; production validation under rollback GO |
| **Abort** | Revert does not restore prior source within SLA |
| **Rollback** | N/A — this phase **is** rollback validation |
| **Evidence** | Rollback step log in evidence PR |

### Phase F7 — Post-cutover evidence PR

| | |
|---|---|
| **Allowed** | Docs-only archive: counts, RIDs, flag states, PASS/FAIL per step, msdi decision (Option A/B) |
| **Forbidden** | Code change |
| **Required** | All §11 checks documented |
| **Evidence** | Merged evidence PR on main |

### Phase F8 — Broader rollout decision (separate GO)

| | |
|---|---|
| **Allowed** | Readiness review for second provider / additional weeks |
| **Forbidden** | Implicit expansion from F4 success |
| **Required** | Repeat F0–F7 pattern per scope |
| **Evidence** | New gate audit |

---

## 10. Cutover preconditions

All must be true before Gate F4 production cutover GO:

- [ ] Gates A–E evidence merged on main (#458–#470).
- [ ] Visibility/materialization proof merged on main (#471).
- [ ] Phase F0 implementation PR merged; **all SOT flags default OFF** on production.
- [ ] Production flags verified OFF immediately before cutover (read-back with RID).
- [ ] Provider allowlist contains **exactly one** target provider ID — no wildcards.
- [ ] Target provider, date/doc, tier scoped and documented in GO prompt.
- [ ] msdi decision (Option A or B) documented — §6.
- [ ] Tenant chain exists for target (agreement + delivery day + company + location) **or** scoped scaffolding GO issued separately.
- [ ] No active orders on proof `service_date` for target scope (far-future dates preferred).
- [ ] Rollback boundary documented (§12).
- [ ] `npm run test:golden-path` PASS on cutover commit.
- [ ] Employee/API tests PASS; anonymous 401 PASS.
- [ ] No billing coupling — synthetic test companies remain paused if used.
- [ ] G5d.8 hook reconciliation complete if hook is in blast radius.

---

## 11. Read-back and monitoring plan

Required for every SOT session and cutover:

### Sanity read-back

- Target doc `approvedForPublish`, `customerVisible`, `_rev`, `providerRef`, `mealTitle`.
- Adjacent docs in same week unchanged.
- Global template count (7) and sample `_rev` unchanged.
- Provider mirror doc present for enrolled provider.

### Supabase read-back

- `menu_service_days` count for provider + `service_date` — expect scoped delta only.
- `menu_service_day_items` count and **content** — names, SKUs, price cents, currency.
- Orders: global count unchanged (currently 17); Melhus count unchanged.
- No new `provider_invoices`; billing tables untouched.

### Provider / tenant checks

- Provider mirror unchanged unless expected.
- Protected providers (Melhus) unchanged unless explicit target.
- Wrong provider cannot see or update scoped materialization.

### Employee / API checks

- Anonymous `/api/week` and `/api/order/window`: **401**.
- Authenticated employee route: scoped check only — no economy fields, no metadata leakage, no Phase D leakage, no cross-tenant bleed.

### Audit fields to capture

`rid`, `providerId`, `weekStart`, `serviceDate`, `menuLocale`, `menuProfileId`, `sotEnabled`, `allowlistHit`, `dryRun`, `msdiDecision`, `orderCountPre`, `orderCountPost`, `msdCountPre`, `msdCountPost`, `msdiCountPost`.

### Hard stops

- Order count delta → STOP.
- Economy/metadata leakage → STOP.
- Phase D production footprint > 0 → STOP.
- Unexpected msdi NOK in scoped non-NB market without accepted risk → STOP.
- Any batch/cron-like apply pattern → STOP (auto-rollout guard).

---

## 12. Rollback plan

### Order of operations

1. **Kill switch first:** `LP_LOCALIZED_GENERATOR_SOT_ENABLED=OFF` and/or remove provider from allowlist → instant source revert, no data deletion.
2. **Publish revert if needed:** `customerVisible=false` on exact doc(s) → webhook unpublish path deletes `menu_service_days` row (proven in visibility proof §11).
3. **Optional:** `approvedForPublish=false` on exact doc (Gate B artifact path).
4. **Never** delete orders, order history, or global templates.
5. **Never** mutate Melhus unless explicitly targeted in the scoped GO.

### Supabase materialized row cleanup

- Unpublish path handles msd deletion when `customerVisible=false`.
- `menu_service_day_items` follow msd lifecycle via sync.
- Test-tenant scaffolding (visibility proof company/agreement/location) cleanup deferred — requires **separate scoped GO**; do not delete in cutover rollback unless explicitly authorized.

### Draft doc rollback (Gate C boundary)

- May delete session-created drafts only if: `approvedForPublish=false` AND `customerVisible=false`, provider-scoped, session-traceable.
- Published docs require publish-rollback path — not draft deletion.

### Forbidden always

- Deleting 7 global `lunchCategory` templates.
- Touching `lp_order_set` or order write-path.
- Provider-wide rollback when scope was one doc/week.
- Billing/Stripe mutations as rollback mechanism.

---

## 13. Auto-rollout boundary

- **Auto-rollout remains NO-GO.** No change from readiness runbook §8.
- Gate F cutover is **manual, scoped, single-provider** — no cron, no `runMenuWeekRollout*`, no batch generator apply.
- `LP_LOCALIZED_GENERATOR_AUTO_ROLLOUT_ENABLED` must not be introduced as ON in Gate F.
- No provider-wide rollout. No market-wide rollout.
- Any auto-rollout requires: separate design audit, proof, governance tests, and explicit product GO (phase E).

---

## 14. Phase D boundary

- Phase D remains **SOURCE_ONLY** — 0 production providers, settings, Sanity docs beyond the 9 known.
- No Phase D production apply in Gate F.
- No Phase D provider activation.
- No Phase D publish.
- No Phase D SOT coupling until separate scoped GO.
- `phaseDLocales` governance tests must continue PASS through all Gate F work.

---

## 15. Billing boundary

- Billing/Stripe remains a **separate track** (#463 and successors).
- No invoices, charges, or payment status changes in Gate F.
- No billing migrations apply unless separate GO.
- SOT cutover must **not** depend on billing readiness.
- Synthetic proof companies must remain billing-excluded (`paused_at` set) if used for materialization scaffolding.
- `provider_invoices` count must remain unchanged through cutover sessions.

---

## 16. Required tests before any future SOT cutover

All must PASS on the cutover commit (or implementation PR for F0):

| Command / suite | Purpose |
|---|---|
| `npm run typecheck` | Type safety |
| `npm run lint` | Lint gate |
| `npm run ci:commercial-hardcodes-guard` | No hardcoded commercial leaks |
| `npm run test:golden-path` | Protected Golden Path |
| `node scripts/ci/guard-protected-golden-path.test.mjs` | CI protected-path guard |
| Employee API tests | `/api/week`, `/api/order/window` contracts |
| Anonymous 401 regression | Unauthenticated fail-closed |
| Materialization tests | `syncMenuServiceDays*`, webhook predicate |
| Localized generator tests | Apply, idempotency, provider scope |
| SOT flag default-OFF tests | **New in F0** — master flag OFF ⇒ inert |
| Provider allowlist tests | Empty allowlist ⇒ no enrollment |
| Kill-switch tests | Flag OFF ⇒ instant revert |
| Dry-run tests | No serve to employees |
| No auto-rollout tests | No `runMenuWeekRollout*` coupling from generator SOT |
| No Phase D leakage tests | `phaseDLocales`, language-menu-separation |
| No billing coupling tests | Menu chain independent of billing |
| No `lp_order_set` mutation tests | orders-idempotency, orders-set-menu-scope |

Focused governance (from design doc §11):

`tests/governance/protected-golden-path.test.ts`, `tests/api/orders-idempotency.test.ts`, `tests/api/orders-set-menu-scope.test.ts`, `tests/providers/providerProductionStatusFlow.test.ts`, `tests/providers/providerProductionCutoff.test.ts`, `tests/lib/i18n/localeRegistry.test.ts`, `tests/lib/provider-onboarding/phaseDLocales.test.ts`, `tests/governance/language-menu-separation-contracts.test.ts`, `tests/i18n/language-does-not-change-menu-identity.test.ts`.

---

## 17. Decision matrix

| Decision | State after this plan merges |
|---|---|
| **READY FOR IMPLEMENTATION PR** | **YES** — Gate F planning complete; proceed to Phase F0 when explicitly authorized |
| **NOT READY FOR SOT CUTOVER** | **YES** — until F0 implementation PR merged, default-OFF tests exist, msdi decision made, and F3 preflight PASS |
| **SOT CUTOVER GO** | Requires separate explicit operator GO after all preconditions (§10) |
| **Auto-rollout** | **NO-GO · DEFERRED** |
| **Phase D apply** | **NO-GO** |
| **Billing activation** | **NO-GO** — separate track |

---

## 18. Exact future GO prompts

Each prompt is a **separate authorization**. None are implied by this document.

### 1. Implementation PR (Phase F0)

```text
GO implement localized generator SOT runtime hook — default OFF, provider allowlist, dry-run, no production mutation
```

### 2. Dry-run proof (Phase F1)

```text
GO dry-run localized generator SOT for one provider/week — no production mutation
```

### 3. Scoped production cutover (Phase F4)

```text
GO scoped SOT cutover for one provider/week — explicit production mutation allowed, no auto-rollout
```

### 4. Rollback validation (Phase F6)

```text
GO rollback scoped SOT cutover — exact provider/week only, no auto-rollout
```

### 5. Auto-rollout design (deferred track)

```text
GO auto-rollout design audit — docs-only, no rollout
```

### 6. Merge this planning PR (current action)

```text
GO merge SOT cutover implementation planning PR — docs-only, no SOT start, no production mutation
```

---

## Explicit non-goals

This document and its PR do **not** include and do **not** authorize:

- SOT start or authoritative-source change.
- Auto-rollout in any form.
- Publish of any document.
- Production mutation (Supabase or Sanity).
- Generator apply, onboarding apply, or Phase D apply.
- Billing/Stripe work or invoice sending.
- Order write-path or `lp_order_set` changes.
- Production flag changes.
- Code, test, migration, or script changes.
- Revert of test scaffolding or proof artifacts.
- Fix of msdi tier-product/NOK snapshot behavior (§6 — separate implementation work).

**STOP.** Next action requires a separate explicit GO.
