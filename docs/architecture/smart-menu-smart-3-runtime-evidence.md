# SMART-3 — Runtime evidence (employee approved translation display)

**Status:** Evidence archived · docs-only · **SMART-3 runtime verified on Production and Staging**  
**Date:** 2026-07-03  
**SMART-3 merge SHA:** `dbf3dc41d8bf6fc28df123336feb0f5e2761c0c1` (PR #395)  
**Evidence merge SHA:** `82474c47d4c62714b02648f200b8062171874bcc` (PR #396)  
**Operator:** Cursor agent (local Playwright + provider API smoke; no runtime code changes in this archive)

This document records **runtime verification evidence only**. No order write-path, provider publish, DB migration, flag, or cutover work is included.

**No secret values, tokens, connection strings, or private tenant PII are recorded.**

---

## 1. Scope

| In scope | Out of scope |
|----------|--------------|
| Production SMART-3 display overlay on `/api/order/window` | SMART-4 provider menu profile runtime |
| Employee `/week` approved translation visibility | Source extraction automation |
| LocaleSwitcher honest copy | AI translation |
| Fallback behavior (locale / status) | Currency resolver runtime |
| Order identity stability in window payload | Employee price visibility |
| Metadata / commercial leakage scan | G5d.8 · cutover · source-of-truth · auto-rollout |
| Staging availability diagnosis | PR #389 merge |

---

## 2. Pre-check

| Check | Result |
|-------|--------|
| `main` contains SMART-3 merge SHA | **PASS** — `dbf3dc41d8bf6fc28df123336feb0f5e2761c0c1` |
| Main CI (build, enterprise, e2e, week-visual, agents_gate, suspend-rpc-authz) | **PASS** on merge push |
| PR #389 still OPEN / not merged | **PASS** — superseded employee week label PR |
| `LP_MENU_PROFILE_*` flags | **PASS** — none activated |
| G5d.8 / cutover / source-of-truth / auto-rollout | **NOT STARTED** |
| SMART-4 | **NOT STARTED** |

---

## 3. Environments tested

| Environment | URL | Deployed commit | SMART-3 verification |
|-------------|-----|-----------------|----------------------|
| **Production** | `https://app.lunchportalen.no` | `dbf3dc41d8bf6fc28df123336feb0f5e2761c0c1` | **PASS** |
| **Staging** | `https://staging.app.lunchportalen.no` | `82474c47d4c62714b02648f200b8062171874bcc` | **PASS** |

**Historical note (2026-07-03 early):** Staging was initially behind `main` at `5ce7d51f` (SMART-3 not deployed). After `main` → `staging` promote and redeploy, staging smoke was re-run and **PASS** — see §3.1.

### 3.1 Staging verification — PASS

**Timestamp:** 2026-07-03T09:26:15Z (approx.)  
**Staging URL:** `https://staging.app.lunchportalen.no`  
**Staging commit:** `82474c47d4c62714b02648f200b8062171874bcc`  
**Includes SMART-3:** **YES** — `dbf3dc41d8bf6fc28df123336feb0f5e2761c0c1` is ancestor of staging HEAD  
**Includes evidence merge:** **YES** — PR #396 / `82474c47`

#### Provider / test setup (anonymized)

| Field | Value |
|-------|-------|
| Method | Provider REST API + employee API (`/api/order/window`); Playwright UI probe for LocaleSwitcher |
| Provider tenant | Melhus Catering AS (fixture provider A) |
| Provider admin | `kitchen-a@smoke.lunchportalen.no` (hash `3b1d957cb370`) |
| Employee | `smoke-test@lunchportalen.no` (hash `691029b926f8`) |
| Company | Company A (agreements-test fixture) |
| Employee locale | `en` via `lp_locale` cookie |
| Production touched | **NO** |

#### Seed method (staging-only)

| Step | Result |
|------|--------|
| `seed-provider-ab-fixture.mjs` | **PASS** — provider A/B fixture on uigx |
| `seed-smoke-menu-fixture.mjs` | **PASS** — menu_service_days for fixture company |
| Provider menu publish (`POST /api/provider/menu-days`) | **PASS** — `2026-07-06` varmrett published |
| Sanity patch (`menuDay-2026-07-06-BASIS-varmrett` item) | **PASS** — stable `item.key` for smoke |

#### Approved translation row (test, anonymized)

| Field | Value |
|-------|-------|
| `source_kind` | `menu_day_item` |
| `source_ref` | `smart3-smoke-item` (runtime `item.key`) |
| `field` | `title` |
| `locale` | `en` |
| `original_text` | `SMART3 Smoke Original` |
| `translated_text` | `STAGING SMART3 APPROVED TRANSLATION` |
| Status flow | `draft` → `approved` → `rejected` (cleanup) |
| Approval | Via SMART-2 provider API (`POST` create + `PATCH` approve); `approved_by` / `approved_at` server-derived |
| Post-cleanup approved rows for `smart3-smoke-item` | **0** |

#### Positive case — approved translation display

| Check | Result |
|-------|--------|
| `GET /api/order/window?weekOffset=1` with `lp_locale=en` | **PASS** — 200, 1 item |
| Translated title visible | **PASS** — `STAGING SMART3 APPROVED TRANSLATION` |
| `itemKey` / `choice_key` unchanged | **PASS** — `smart3-smoke-item` / `varmmat` |
| LocaleSwitcher + honest copy on `/week` | **PASS** |

#### Fallback cases

| Case | Staging result | Notes |
|------|----------------|-------|
| Wrong locale (`sv`, no approved row) | **PASS** — original text | |
| Missing translation (other item) | **SKIP** — only one item in window | |
| Draft (before approve) | **PASS** — original text | |
| Rejected (after cleanup) | **PASS** — original text | |
| Stale | **NOT_TESTED** | Safety |
| Hash mismatch | **NOT_TESTED** | Covered by unit/governance tests |
| Fail-closed overlay error | **NOT_SIMULATED** | Safety — unit tests assert overlay failure returns original `days` |

#### Network payload — identity and leakage

| Check | Result |
|-------|--------|
| `choice_key` unchanged | **PASS** — `varmmat` |
| `item_key` / `itemKey` unchanged | **PASS** — `smart3-smoke-item` |
| Category slug unchanged | **PASS** — `varmrett` |
| `planTier` / tier stable | **PASS** — `BASIS` |
| `date` unchanged | **PASS** — `2026-07-06` |
| No `approved_by` / `approved_at` | **PASS** |
| No `original_text_hash` / hash / status / row id | **PASS** |
| No price / currency / MVA / commission / provision | **PASS** |

#### Order submission

| Check | Result |
|-------|--------|
| New test order on staging | **NOT_RUN** |
| Order identity from window payload | **PASS** — keys stable; translated text is display-only |

#### DB / RLS / cleanup

| Check | Result |
|-------|--------|
| DB writes | **Staging-only** — uigx fixture tenant |
| Cleanup | **PASS** — approved row rejected; **0** approved rows left for `smart3-smoke-item` |

#### Logs / errors (staging)

| Check | Result |
|-------|--------|
| `/api/order/window` 500 | **None observed** |
| Overlay crash | **None** |
| Auth loop | **None** |

#### Staging known risks

1. **Staging Sanity `lunchCategory` docs** are not visible in the `perspective: "published"` CDN read path on the staging dataset — static categories (`paasmurt`, etc.) may show empty until published-perspective alignment is resolved.
2. **Smoke item** was provided through a **`menuDay` / `varmrett` patch** with stable `item.key` — full static-category parity on staging is **not proven**.
3. **Source ref alignment** remains important — provider rows must match runtime `item.key`.
4. **Mixed translated/original UI** is expected for partial coverage.

#### Staging invariants (unchanged)

- SMART-3 is **display-only** — employee locale controls display text only
- **Provider approval required** — unapproved / hash mismatch / missing → fallback to original
- **Order identity unchanged** — `choice_key`, `item_key`, category slug, tier, date
- **No price / currency / MVA / commission / provision** exposure in employee payload
- **Production not touched** · **flags OFF** · **G5d.8 / cutover NOT STARTED** · **PR #389 OPEN** · **SMART-4 NOT STARTED**

---

## 4. Production test setup (anonymized)

| Field | Value |
|-------|-------|
| Timestamp | 2026-07-03T05:11–05:16Z (approx.) |
| Method | Playwright Chromium headless + provider REST API |
| Provider (masked) | `p***@melhuscatering.no` (hash `feecde3c43af`) |
| Employee (masked) | `t***@pettersenco.no` (hash `62f34cb467a4`) |
| Provider tenant | Melhus Catering AS (Golden Path provider) |
| Company / location | Pettersen&Co · Hovedlokasjon |
| Employee locale | `en` via `lp_locale` cookie |
| Pre-test approved rows in DB | **0** |

---

## 5. Approved translation row (test, anonymized)

| Field | Value |
|-------|-------|
| `source_kind` | `menu_day_item` |
| `source_ref` | `ost-skinke` (runtime `item.key`) |
| `field` | `title` |
| `locale` | `en` |
| `original_text` | Provider original title from live `/api/order/window` (12 chars; not quoted — display-only) |
| `translated_text` | `APPROVED TEST TRANSLATION SMART3` |
| Status flow | `draft` → `approved` → `rejected` (cleanup) |
| Approval | Via SMART-2 provider API (`POST` create + `PATCH` approve); `approved_by` / `approved_at` server-derived |
| Post-cleanup approved rows | **0** |

---

## 6. Positive case — approved translation display

| Check | Result |
|-------|--------|
| Provider `/leverandor/meny/oversettelser` | **PASS** |
| Employee `/week` loads | **PASS** |
| `GET /api/order/window` with `lp_locale=en` shows translated title | **PASS** |
| LocaleSwitcher visible + honest copy | **PASS** — states approved-only partial coverage; language does not change menu/package/price/order |

---

## 7. Fallback cases

| Case | Production result | Notes |
|------|-------------------|-------|
| Wrong locale (`sv`, no approved row) | **PASS** — original text | |
| Missing translation (other item) | **PASS** — original text | |
| Draft (before approve) | **PASS** — original text | |
| Rejected (after cleanup) | **PASS** — original text | |
| Stale | **NOT_TESTED** | Safety — no prod mutation of live menu original |
| Hash mismatch | **NOT_TESTED** | Safety — covered by unit/governance tests |
| Fail-closed overlay error | **NOT_SIMULATED** | Safety — unit tests assert overlay failure returns original `days` |

---

## 8. Network payload — identity and leakage

| Check | Result |
|-------|--------|
| `choice_key` unchanged | **PASS** — `paasmurt` |
| `item_key` / `itemKey` unchanged | **PASS** — `ost-skinke` |
| Category slug unchanged | **PASS** — `paasmurt` |
| `planTier` / tier stable | **PASS** |
| `date` unchanged | **PASS** — `2026-07-03` (sample day) |
| Cutoff behavior | **UNCHANGED** — no SMART-3 change to cutoff |
| No `approved_by` / `approved_at` | **PASS** |
| No `original_text_hash` / hash / status / row id | **PASS** |
| No price / currency / MVA / commission / provision | **PASS** — forbidden scan 0 hits |

---

## 9. Order submission

| Check | Result |
|-------|--------|
| New test order in Production | **NOT_RUN** — avoid prod order noise during display verification |
| Order identity from window payload | **PASS** — keys stable; translated text is display-only, never identity |

---

## 10. LocaleSwitcher

| Check | Result |
|-------|--------|
| Re-enabled for employees | **PASS** |
| Honest partial-coverage copy | **PASS** |
| No claim all menu text translated | **PASS** |
| No claim language changes menu profile or currency | **PASS** |

---

## 11. System invariants (unchanged)

| Area | Status |
|------|--------|
| SMART-3 display-only overlay | **Confirmed** — server read model in `/api/order/window` only |
| Employee locale | Display text only — does **not** change menu profile, currency, package, or order identity |
| Provider approval required | **Confirmed** — `isEmployeeVisibleTranslation()` + hash match |
| Unapproved / stale / hash mismatch | Falls back to provider original text |
| Mixed translated/original UI | **Expected** |
| Source refs must match runtime | `item.key`, category slug, `{date}:{slug\|header}`, normalized allergen token |
| Sanity / original text | **Unchanged** — no Sanity mutation |
| Provider API/UI publish runtime | **Unchanged** |
| DB / RLS | **Unchanged** — test rows via provider API only |
| Provider API DTO | `employeeTranslationsLive: false` (provider admin view; expected) |
| Production flags | **None** — `LP_MENU_PROFILE_*` OFF |
| G5d.8 / cutover / source-of-truth / auto-rollout | **NOT STARTED** |
| PR #389 | **OPEN** — not merged |

---

## 12. Logs / errors

| Check | Result |
|-------|--------|
| `/api/order/window` 500 during smoke | **None observed** |
| Overlay crash | **None** |
| Auth loop | **None** |
| RLS errors (employee view) | **None** |
| `node:crypto` client bundle error | **None** |
| LocaleSwitcher hydration error | **None** |

Full Vercel log review not performed (dashboard-only).

---

## 13. Known risks

1. **Source ref alignment** — provider manual rows must use same refs as runtime (`item.key`, etc.); mismatch → original by design.
2. **Partial translation coverage** — mixed translated/original UI expected.
3. **Staging static-category parity** — `lunchCategory` docs on staging Sanity dataset may not appear in published-perspective CDN reads; smoke used `menuDay`/`varmrett` item patch instead.
4. **Deployment protection** — health checks without Vercel automation bypass return HTML, not JSON.

---

## 14. Recommendation

| Item | Recommendation |
|------|----------------|
| Production SMART-3 display | **GO** — runtime verified |
| Staging SMART-3 display | **GO** — runtime verified (see §3.1); static-category parity remains a separate staging ops concern |
| SMART-4 | **Do not start** without explicit owner GO |
| PR #389 | Keep OPEN until explicit decision |
| Flags / G5d.8 / cutover | **Do not activate** |

---

## 15. Next phase

**SMART-4** (provider menu profile selection), source extraction automation, AI translation, currency runtime, and employee price visibility are **not started** and require explicit owner GO after SMART-3 merge.
