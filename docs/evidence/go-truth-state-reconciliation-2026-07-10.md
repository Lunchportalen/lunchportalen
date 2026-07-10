# GO Truth State Reconciliation

**Status:** Evidence archived · docs-only · **authoritative reconciliation index**
**Date:** 2026-07-10
**Main HEAD (reconciliation):** `ae9ec929` — feat(menu): align MSDI trigger for localized SOT snapshots (#479)
**Audit type:** Read-only reconciliation. No SOT start. No auto-rollout. No production mutation authorized by this document.

This document is the **single reconciliation index** for Lunchportalen GO tracks: 21 markets/languages, menu E2E, economy/billing SOT, and localized-generator SOT gates. It resolves contradictions between planning catalogs, runbooks, and merged evidence on main.

**No secret values, tokens, passwords, connection strings, env values, or private tenant PII are recorded.**

---

## 1. Executive verdict (2026-07-10)

| Area | Verdict |
|------|---------|
| **Protected Golden Path** | **FROZEN / PASS** — order path locked; `test:golden-path` PASS |
| **Phase C (9 launch locales)** | **COMPLETE** — 9 production providers; evidence chain #446–#458 |
| **Phase D (12 rich markets)** | **SOURCE_ONLY** — 0 production footprint |
| **21-market registry** | **MERGED** — `lib/i18n/localeRegistry.ts` (#464) |
| **Generator apply** | **LIVE** — `LP_LOCALIZED_FIXED_MENU_GENERATOR` ON |
| **SOT runtime (production)** | **CONTAINED OFF** — F4 partial cutover contained 2026-07-10; env flags removed |
| **SOT cutover (broad)** | **NO-GO** — Gate F4b (MSDI trigger alignment) required before re-attempt |
| **Auto-rollout** | **NO-GO · DEFERRED** |
| **Billing SOT** | **SPLIT / NO-first** — five parallel price truths; Tripletex/EHF NO-only |

**Bottom line:** Generator and Phase C rollout are production-proven. Menu SOT **code exists** (#472–#476) but **production runtime is OFF** after F4 containment. Commercial MSDI snapshots remain **partially localized** (DKK price only); name/VAT blocked by DB trigger until F4b.

---

## 2. Contradictions reconciled

| Contradiction | Stale source | Authoritative truth | Resolution |
|---------------|--------------|---------------------|------------|
| Phase C “7 pending” vs 9 providers | `lib/provider-onboarding/phaseCLocales.ts` (`coverage: pending`) | [`final-phase-c-rollout-summary-readiness-audit.md`](./final-phase-c-rollout-summary-readiness-audit.md) — 9 providers, 120 menuDays | **Production inventory is authoritative.** `phaseCLocales.ts` is a planning catalog not synced post-rollout; do not use it alone for GO decisions. |
| Gate B/C “MISSING” | `localized-generator-sot-cutover-design.md` §3 (pre-reconciliation) | PR #468 rollback · PR #469 publish proof | **PASS (archived).** Design doc updated by this reconciliation PR. |
| Gate E “conditional READY” (visibility gap) | [`final-sot-readiness-audit.md`](./final-sot-readiness-audit.md) §8 (2026-07-09) | PR #471 visibility/materialization proof | **Residual closed.** Superseded by [`final-scoped-sot-cutover-readiness-check.md`](./final-scoped-sot-cutover-readiness-check.md). |
| “No SOT flag in code” | Earlier audits (2026-07-09) | PR #472–#476 merged; F4 evidence | **Flags exist in code; production env OFF** after F4 containment (#478). |
| `customerVisible=0` / `approved=0` for all generated docs | Cutover design §2 (pre-reconciliation) | Gate B + visibility proof artifacts | **One Danish doc** publish-visible with proof scaffolding; Italian week **0 menuDays** after rollback drill. |
| Readiness runbook “Phase C IN PROGRESS” | `localized-generator-sot-rollout-readiness.md` §8.1 | Phase C final audit PASS | **Phase C COMPLETE.** Runbook updated. |
| `docs/evidence/` absent locally | Workspace snapshot during exploratory audit | Merged on main (#422+) | **Evidence archive exists on main.** This reconciliation indexes it. |

---

## 3. Twenty-one markets / languages — classification

### 3.1 Three-tier model (do not conflate)

| Tier | Count | Canonical source | Drives |
|------|-------|------------------|--------|
| **UI app locales** | 9 | `APP_LOCALES` in `localeRegistry.ts` | LocaleSwitcher, routed UI bundles |
| **Generator locales** | 9 | `SUPPORTED_MENU_LOCALES` + `dishBanks/localeData.ts` | Generate + apply |
| **Market locales** | **21** | `SUPPORTED_MARKET_LOCALES` in `localeRegistry.ts` | Registry / planning identity only |

Registry law: market locales **must not** drive order, billing, price, publish, SOT, or provider-owned menu identity without explicit GO.

### 3.2 Phase C — 9 launch locales (generator-capable)

| Locale | Market | Profile | Production provider | Provider ID | Generator | Dish bank | Production menuDays (2026-07-10) | Notes |
|--------|--------|---------|---------------------|-------------|-----------|-----------|----------------------------------|-------|
| `nb-NO` | NO | `norwegian_company_lunch` | Melhus Catering AS | `11111111-1111-1111-1111-111111111111` | Yes | Yes | 226 | **Protected** — live pilot |
| `sv-SE` | SE | `swedish_lunch` | Swedish Lunch Pilot | `a08e4742-c89d-48c5-a6a8-cf8532179083` | Yes | Yes | 15 | **Protected** |
| `da-DK` | DK | `danish_office_lunch` | Danish Lunch Pilot | `799ba3a2-a127-48a0-87b7-87944a2f42a3` | Yes | Yes | 15 | Gate B/F4 proof target; 1 doc publish-visible |
| `fi-FI` | FI | `finnish_office_lunch` | Finnish Lunch Pilot | `3ce485a7-0bd6-4308-9381-f734692b667c` | Yes | Yes | 15 | Far-future drafts |
| `en-GB` | UK | `uk_office_lunch` | UK Lunch Pilot | `e9b90cbf-8f6e-4523-94e2-49263ca61896` | Yes | Yes | 15 | Far-future drafts |
| `de-DE` | DE | `german_business_lunch` | German Lunch Pilot | `ae7a6495-9ded-4f76-98cf-050ea6385160` | Yes | Yes | 15 | Far-future drafts |
| `fr-FR` | FR | `french_dejeuner` | French Lunch Pilot | `c482495c-d209-4f21-a5de-e1daf5318f90` | Yes | Yes | 15 | Far-future drafts |
| `es-ES` | ES | `spanish_menu_del_dia` | Spanish Lunch Pilot | `97e5b254-8f6f-4d0d-9c12-3596c14392ac` | Yes | Yes | 15 | Far-future drafts |
| `it-IT` | IT | `italian_office_lunch` | Italian Lunch Pilot | `50eb1ebc-d1a9-4f6e-9737-a0415fddeaaa` | Yes | Yes | **0** | Gate C rollback drill deleted 15 drafts |

**Staging matrix:** [`localized-generator-9-locale-staging-matrix-evidence.md`](./localized-generator-9-locale-staging-matrix-evidence.md) — all 9 **PASS** (L1–L8).

### 3.3 Phase D — 12 rich-market locales (registry only)

All **`SOURCE_ONLY`** per `phaseDLocales.ts` and [`phase-d-rich-market-expansion.md`](../rollout/phase-d-rich-market-expansion.md):

| # | Locale | Market | Profile | Currency | Generator | Production footprint |
|---|--------|--------|---------|----------|-----------|----------------------|
| 1 | `en-US` | US | `us_office_lunch` | USD | No dish bank | 0 |
| 2 | `en-CA` | CA | `canadian_office_lunch` | CAD | No dish bank | 0 |
| 3 | `nl-NL` | NL | `dutch_office_lunch` | EUR | No dish bank | 0 |
| 4 | `nl-BE` | BE | `belgian_dutch_office_lunch` | EUR | No dish bank | 0 |
| 5 | `fr-BE` | BE | `belgian_french_office_lunch` | EUR | No dish bank | 0 |
| 6 | `de-AT` | AT | `austrian_office_lunch` | EUR | No dish bank | 0 |
| 7 | `de-CH` | CH | `swiss_german_office_lunch` | CHF | No dish bank | 0 |
| 8 | `fr-CH` | CH | `swiss_french_office_lunch` | CHF | No dish bank | 0 |
| 9 | `en-IE` | IE | `irish_office_lunch` | EUR | No dish bank | 0 |
| 10 | `fr-LU` | LU | `luxembourg_office_lunch` | EUR | No dish bank | 0 |
| 11 | `en-AU` | AU | `australian_office_lunch` | AUD | No dish bank | 0 |
| 12 | `en-SG` | SG | `singapore_office_lunch` | SGD | No dish bank | 0 |

---

## 4. Menu E2E — freeze and proof layers

### 4.1 Protected Golden Path — FROZEN / PASS

Authoritative: [`docs/PROTECTED_GOLDEN_PATH.md`](../PROTECTED_GOLDEN_PATH.md)

```
Sanity publish → webhook → menu_service_days / menu_service_day_items
→ GET /api/week (price-free) → POST /api/orders → lp_order_set
→ /leverandor/ordrer → lp_order_advance_status
```

| Layer | Status | Evidence |
|-------|--------|----------|
| Contract tests | **PASS** | `npm run test:golden-path` (101 tests) |
| CI guard | **Enforced** | `scripts/ci/guard-protected-golden-path.mjs` |
| Production manual E2E | **PASS** | `docs/launch/p0-2-production-manual-smoke-evidence.md` |
| Playwright full chain | **GAP** | Week load + visual only; no browser publish→order replay |

### 4.2 Localized generator E2E (GO track)

| Check | Status | Evidence |
|-------|--------|----------|
| 9-locale staging matrix | **PASS** | [`localized-generator-9-locale-staging-matrix-evidence.md`](./localized-generator-9-locale-staging-matrix-evidence.md) |
| Employee economy strip | **PASS** | `employeeSafeMapper.ts` + matrix scans |
| Gate B — approval stage | **PASS** | [`localized-generator-publish-workflow-proof-evidence.md`](./localized-generator-publish-workflow-proof-evidence.md) |
| Gate C — rollback drill | **PASS** | [`localized-generator-rollback-drill-evidence.md`](./localized-generator-rollback-drill-evidence.md) |
| Visibility → MSDI (generated doc) | **PASS** | [`localized-generator-visibility-materialization-proof-evidence.md`](./localized-generator-visibility-materialization-proof-evidence.md) |
| F1 dry-run (SOT resolver) | **PASS** | [`localized-generator-sot-dry-run-proof-evidence.md`](./localized-generator-sot-dry-run-proof-evidence.md) |
| F4 scoped cutover | **PARTIAL · CONTAINED** | [`danish-sot-cutover-f4-evidence.md`](./danish-sot-cutover-f4-evidence.md) |
| F4b MSDI trigger alignment | **NOT STARTED** | #479 merged; production re-cutover **NO-GO** until verified |

### 4.3 Employee safety (hard stop — unchanged)

- `/api/week` and `/api/order/window` remain **price-free**
- Generator economy stripped via `employeeSafeMapper.ts`
- Employee UI locale **cannot** override provider `menuLocale`

---

## 5. Economy / billing — SOT status

### 5.1 Five parallel price truths (not unified)

From [`docs/engineering/commercial-inventory.md`](../engineering/commercial-inventory.md):

| ID | Source | Runtime today | Role |
|----|--------|---------------|------|
| **A** | `provider_price_rules` | Yes | Provider menu display/margin |
| **B** | Price preview resolver | Diagnostics | Preview strip |
| **C** | `fallbackProviderMenuPrices()` | Yes | Publish validation — not DB-backed |
| **D** | `TIER_PRICE_CENTS` (90/130/170 NOK ex VAT) | Yes | **Golden Path / MSDI / `lp_order_set`** |
| **E** | `agreements` + billing | Yes | **Customer invoicing** (Tripletex/EHF NO) |

### 5.2 Generator economy (internal only)

- `countryEconomyDefaults.ts` — VAT/cost defaults for **19 markets**
- Used in generator preview panel only; **not** employee or order SOT
- Stripped before employee surface

### 5.3 F4 commercial snapshot finding (critical for non-NO SOT)

Visibility proof (#471) and F4 cutover (#478) established:

| Signal | Employee menu (Sanity) | MSDI commercial snapshot |
|--------|------------------------|--------------------------|
| Danish varmrett text | «Kylling i karry» (generated) | **Varmrett** (global tier product name) |
| Price | N/A on `/week` | **10500** ex-VAT (DKK mapping applied in F4) |
| VAT | N/A | **0.15** (trigger forces `products.vat_rate`; DK expects 0.25) |

**Classification:** Option A (accept tier-product/NOK-msdi v1) vs Option B (localized MSDI mapping + trigger alignment). F4 proved **partial Option B** — price only. **Gate F4b required** before broad non-NO SOT.

### 5.4 Billing tracks (separate from menu SOT)

| Track | Status |
|-------|--------|
| NO customer invoicing (Tripletex/EHF) | **Live** |
| Global Billing Engine schema | **Foundation only** — no runtime cutover |
| Commission ledger (5%) | **Display estimate** — no production ledger |
| `lib/commercial/marketConfigs.ts` | **INERT** — not runtime SOT |

---

## 6. SOT gates — reconciled matrix

| Gate / phase | Status (2026-07-10) | Evidence |
|--------------|---------------------|----------|
| A — Phase C stability | **PASS** | #446–#458 · staging matrix · post-launch monitoring |
| B — Publish workflow proof | **PASS (approval + visibility)** | #469 · #471 |
| C — Rollback drill | **PASS** | #468 |
| D — SOT cutover design | **PASS** | #465 |
| E — Final SOT readiness audit | **PASS (superseded)** | #470 · visibility proof closed residual |
| Visibility/materialization | **PASS** | #471 |
| F — Implementation plan | **PASS** | #472 |
| F0 — Runtime hook (default OFF) | **PASS** | #473 |
| F1 — Dry-run proof | **PASS** | #474 |
| F — Scoped cutover execution | **PARTIAL · CONTAINED** | #478 — flags removed; partial MSDI preserved |
| F4b — MSDI trigger alignment | **APPLIED IN PRODUCTION** | #479 merged; migration `20260810120000` in production ledger — see [`f4b-msdi-trigger-apply-readiness-check.md`](./f4b-msdi-trigger-apply-readiness-check.md) |
| F — Broad SOT cutover GO | **NO-GO** | Awaiting F4b verification + owner GO |
| Auto-rollout | **NO-GO · DEFERRED** | — |

### Production runtime flags (2026-07-10 post-containment)

| Flag | Production |
|------|------------|
| `LP_MENU_PROFILE_RESOLVER` | **ON** |
| `LP_LOCALIZED_FIXED_MENU_GENERATOR` | **ON** |
| `LP_LOCALIZED_GENERATOR_SOT_ENABLED` | **OFF** (removed post-F4) |
| `LP_LOCALIZED_GENERATOR_SOT_PROVIDER_ALLOWLIST` | **Absent** |
| `LP_LOCALIZED_GENERATOR_SOT_MSDI_LOCALIZED_MAPPING_ENABLED` | **Absent** |
| `LP_LOCALIZED_GENERATOR_AUTO_ROLLOUT_ENABLED` | **Absent** |

Kill-switch: master SOT flag OFF or empty allowlist ⇒ legacy behavior (proven in F1 dry-run).

---

## 7. Launch decision matrix (reconciled)

| Phase | Status |
|-------|--------|
| A — Canary (Melhus nb-NO) | **PASS** |
| B — Single provider apply (Melhus + sv-SE) | **PASS** |
| C — Multi-provider 9-country | **COMPLETE** |
| D — SOT activation | **PARTIAL · CONTAINED** — F4 attempted; runtime OFF; F4b pending |
| E — Auto-rollout | **DEFERRED · NO-GO** |

---

## 8. Evidence index (authoritative archive)

See [`docs/evidence/README.md`](./README.md) for the full catalog. Key documents:

| Document | Role |
|----------|------|
| This file | **Reconciliation index** |
| [`final-phase-c-rollout-summary-readiness-audit.md`](./final-phase-c-rollout-summary-readiness-audit.md) | Phase C completion |
| [`final-sot-readiness-audit.md`](./final-sot-readiness-audit.md) | Gate E (2026-07-09; superseded on visibility) |
| [`final-scoped-sot-cutover-readiness-check.md`](./final-scoped-sot-cutover-readiness-check.md) | Pre-F4 readiness |
| [`danish-sot-cutover-f4-evidence.md`](./danish-sot-cutover-f4-evidence.md) | F4 partial + containment |
| [`docs/engineering/localized-generator-sot-cutover-design.md`](../engineering/localized-generator-sot-cutover-design.md) | Gate D design (gates updated) |
| [`docs/runbooks/localized-generator-sot-rollout-readiness.md`](../runbooks/localized-generator-sot-rollout-readiness.md) | Master readiness runbook |
| [`docs/engineering/commercial-inventory.md`](../engineering/commercial-inventory.md) | Billing parallel-truth audit |

---

## 9. Next actions (each requires separate GO)

| Priority | Action | Type |
|----------|--------|------|
| 1 | Merge F4b readiness evidence PR | docs-only |
| 2 | **Danish scoped SOT re-cutover verification** — read-back with SOT flags OFF unless explicit GO | read-only first |
| 3 | Billing migration ledger reconciliation (11 pending) | read-only audit — separate track |
| 4 | Broad SOT cutover GO | **NO-GO** — SOT runtime OFF |
| 5 | Auto-rollout | **NO-GO** |
| 6 | Phase D apply | **NO-GO** |

**Exact next GO prompt (separate GO only):**

```text
GO Danish scoped SOT re-cutover verification — read-only production read-back first, SOT flags OFF unless explicit scoped GO, no auto-rollout
```

---

## 10. Explicit non-goals

This document does **not** authorize:

- SOT runtime activation
- Auto-rollout
- Production mutation
- Order-path changes
- Billing/Stripe cutover
- Phase D apply

**STOP.** Reconciliation is documentation truth only.
