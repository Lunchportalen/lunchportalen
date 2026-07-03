# SUPERSMART Phase 3A — Staging evidence (provider market profile runtime)

**Status:** Evidence archived · docs-only · **Phase 3A staging smoke PASS**  
**Date:** 2026-07-03  
**Phase 3A merge SHA:** `f90623f31098d5fbfe0de559cf68512dec896337` (PR #405)  
**Environment:** Staging only (`https://staging.app.lunchportalen.no`)  
**Operator:** Cursor agent (Playwright + Supabase staging admin snapshot/restore; no runtime code changes in this archive)

This document records **staging verification evidence only** for Phase 3A: provider market profile applied to menu runtime behind `LP_MENU_PROFILE_RESOLVER`. No order write-path, publish cutover, DB migration, Sanity mutation, or production flag work is included.

**No secret values, tokens, passwords, connection strings, or private tenant PII are recorded.**

---

## 1. Scope

| In scope | Out of scope |
|----------|--------------|
| Staging deploy @ `f90623f3` | Phase 3B (live warm dish generation per market) |
| `LP_MENU_PROFILE_RESOLVER=true` on staging only | Production flag activation |
| 9-market provider settings save + restore | G5d.8 · cutover · source-of-truth · auto-rollout |
| Provider `/leverandor/innstillinger` + `/leverandor/meny` | Runtime code changes in this PR |
| Employee `/api/order/window` display overlay (9 markets) | Catalog reset · order rewrite |
| Order identity stability | Sanity writes |
| Commercial / metadata leakage scan | DB/RLS migration |

---

## 2. Flag matrix

| Flag | Staging | Production | Purpose |
|------|---------|------------|---------|
| `LP_MENU_PROFILE_RESOLVER` | **ON** (`true`) | **OFF** (unset) | Phase 3A profile resolver + display labels |
| Other `LP_MENU_PROFILE_*` | Unchanged | **OFF** | Not part of Phase 3A smoke |

**Production:** Not touched. No production env mutation as part of this evidence.

---

## 3. Pre-check

| Check | Result |
|-------|--------|
| Staging health commit | **PASS** — `f90623f31098d5fbfe0de559cf68512dec896337` |
| Staging resolver flag | **PASS** — `LP_MENU_PROFILE_RESOLVER=true` (staging env only) |
| Production resolver flag | **PASS** — OFF |
| Provider login (Melhus `provider_admin`) | **PASS** |
| Employee login (E2E employee fixture) | **PASS** |
| Staging auth prerequisite | Melhus provider admin required `profiles` row + password sync on staging (ops repair; no schema change) |

---

## 4. Provider tenant (Melhus)

| Field | Value |
|-------|-------|
| Provider | Melhus Catering AS |
| Slug | `melhus-catering` |
| Provider ID | `11111111-1111-1111-1111-111111111111` |
| Role | `provider_admin` |
| Routes verified | `/leverandor/innstillinger` 200 · `/leverandor/meny` 200 |

---

## 5. Nine-market matrix — PASS

Each market: save operational locale via provider settings UI → verify DB `provider_settings` → verify provider menu profile label hint → restore baseline after loop.

| App | Profile ID | Country | Currency | Result |
|-----|------------|---------|----------|--------|
| **nb** | `norwegian_company_lunch` | NO | NOK | **PASS** |
| **da** | `danish_office_lunch` | DK | DKK | **PASS** |
| **de** | `german_business_lunch` | DE | EUR | **PASS** |
| **en** | `uk_office_lunch` | GB | GBP | **PASS** |
| **es** | `spanish_menu_del_dia` | ES | EUR | **PASS** |
| **fr** | `french_dejeuner` | FR | EUR | **PASS** |
| **it** | `italian_office_lunch` | IT | EUR | **PASS** |
| **fi** | `finnish_office_lunch` | FI | EUR | **PASS** |
| **sv** | `swedish_lunch` | SE | SEK | **PASS** |

**Baseline before smoke:** `locale: nb-NO`, `menu_profile_id: null`, `default_country_code: NO`, `default_currency: NOK`.

---

## 6. Employee `/api/order/window` — PASS (all 9 markets)

| Check | Result |
|-------|--------|
| HTTP status | **200** all 9 markets |
| Profile label overlay | **PASS** — `profileLabelOverlay: match-provider-profile` per market |
| Employee locale vs provider profile | **PASS** — employee `lp_locale` does not override provider-resolved profile labels |
| SMART-3 overlay ordering | **PASS** — approved translation overlay applies after profile display overlay (no identity mutation) |
| `choice_key` stable | **PASS** |
| `item_key` stable | **PASS** (e.g. `ost-skinke`, `laks-eggerore`) |
| Category key stable | **PASS** (e.g. `paasmurt`, `salat`) |
| Commercial exposure | **NONE** |
| Metadata exposure | **NONE** (no `approved_by`, `menu_profile_id`, commission/provision fields in payload) |

---

## 7. Safety

| Check | Result |
|-------|--------|
| Catalog reset | **NO** |
| `menu_service_days` count | **91 → 91** (unchanged) |
| Published orders rewritten | **NO** |
| `orders` count | **1 → 1** (unchanged) |
| Restore after smoke | **PASS** — settings restored to baseline (`menu_profile_id: null`, `locale: nb-NO`) |
| Order write-path | **NOT TOUCHED** |
| DB/RLS | **NO CHANGE** |
| Sanity | **NOT TOUCHED** |
| Production flags | **OFF** |
| G5d.8 / cutover / SOT | **NOT STARTED** |

---

## 8. Gates (local @ `f90623f3`)

| Gate | Result |
|------|--------|
| `npm run typecheck` | **PASS** |
| `npm run lint` | **PASS** (design-token warnings only) |
| `npm run ci:commercial-hardcodes-guard` | **PASS** |
| `profileMenuRuntime.test.ts` | **PASS** 14/14 |
| `protected-golden-path.test.ts` | **PASS** 28/28 |
| `npm run test:golden-path` | **PASS** 101/101 |
| `npm run check:rls-drift` | **PASS** |

---

## 9. Enterprise gap (explicit)

| Item | Status |
|------|--------|
| Live warm meal generation | Still **Sanity `mealIdea` + `generateWeekMenu`** — unchanged |
| Profile warm dish bank | **Preview/suggestions only** (`isPreviewOnly: true`) |
| Full market-specific dish generation | **NOT IMPLEMENTED** — Phase 3B separate PR |
| Phase 3B | **NOT STARTED** |

---

## 10. Artifacts (local only — not committed)

| Artifact | Committed |
|----------|-----------|
| `_tmp-phase3a-melhus-smoke-result.json` | **NO** |
| `scripts/temp-*.mjs` (smoke + staging auth repair) | **NO** |
| `.env.local` | **NO** |

---

## 11. Go / no-go

| Decision | Status |
|----------|--------|
| Phase 3A staging verification | **PASS** |
| Phase 3B | **BLOCKED** until explicit GO |
| Production `LP_MENU_PROFILE_RESOLVER` | **BLOCKED** until explicit GO |
| G5d.8 / cutover / SOT | **NOT STARTED** |

**Recommendation:** Keep Phase 3A code on staging with resolver ON for continued soak. Do not promote resolver to Production or start Phase 3B without a scoped PR and explicit operator GO.
