# SMART-4 — Staging evidence (source extraction / locale coverage QA)

**Status:** Evidence archived · docs-only · **SMART-4 verified on Staging**  
**Date:** 2026-07-03  
**SMART-4 merge SHA:** `d017709ad8811219293c601183b88f0ed943d2a5` (PR #398, squash merge to `main`)  
**Evidence archive branch:** `chore/smart-menu-smart-4-evidence-archive`  
**Operator:** Cursor agent (staging API + HTML probe; no runtime code changes in this archive)

This document records **staging verification evidence only**. No order write-path, provider publish, DB migration, flag, cutover, or production change is included.

**No secret values, tokens, connection strings, or private tenant PII are recorded.**

---

## 1. SMART-4 scope

| In scope | Out of scope |
|----------|--------------|
| Provider-side source extraction from catalog | Employee runtime identity change |
| Locale coverage QA summaries | AI translation / auto-approve |
| `GET /api/provider/menu-translations/sources` | POST materialize (disabled — 405) |
| Provider UI `/leverandor/meny/oversettelser` coverage table + honest fallback copy | Sanity mutation |
| `source_ref` guidance aligned to runtime keys | Currency / menu profile runtime |
| Missing / stale / draft / rejected / approved coverage visibility (provider admin) | Employee price / commercial exposure |
| | G5d.8 · cutover · source-of-truth switch · auto-rollout |
| | `LP_MENU_PROFILE_*` activation |

**Rules preserved:**

- Source extraction is **provider/admin-side only** — candidates are not employee-visible by themselves.
- Provider approval still required before employee display (SMART-3 fail-closed overlay unchanged).
- Employee-visible overlay requires: `approved` + locale match + hash match + non-empty `translated_text`.
- Draft / suggested / rejected / stale / missing / blank → employee sees **original provider text**.
- `source_ref`: meal = `item.key`, category = slug/key at runtime, allergen = normalized token.
- Partial coverage is **expected** — no claim that all menu text is translated.

---

## 2. Merge evidence

| Field | Value |
|-------|-------|
| PR | [#398](https://github.com/Lunchportalen/lunchportalen/pull/398) — feat(smart-menu): add source extraction and locale QA hardening |
| Merge type | Squash merge to `main` |
| Merge SHA | `d017709ad8811219293c601183b88f0ed943d2a5` |
| `origin/main` | `d017709ad8811219293c601183b88f0ed943d2a5` |
| Main CI on merge push | **PASS** (CI, CI Enterprise, CI E2E, CI Provider Meny Visual, CI AGENTS gate, Suspend RPC authz gate) |
| Runtime files (summary) | `menuTranslationSources.ts`, `translationCoverage.ts`, `providerTranslationSources.ts`, `GET /api/provider/menu-translations/sources`, `ProviderMenuTranslationsPanel.tsx`, governance + API tests |

---

## 3. Staging deploy evidence

### 3.1 Deploy model

| Fact | Detail |
|------|--------|
| Staging URL | `https://staging.app.lunchportalen.no` |
| Deploy branch | **`origin/staging`** (Vercel strategi A — not `origin/main`) |
| Initial gap | After SMART-4 merge, staging health remained `82474c47` (pre-SMART-4) while `main` was `d017709a` |
| Unblock action | Fast-forward `origin/staging` → `d017709ad8811219293c601183b88f0ed943d2a5` (staging-only ref update; no app code change) |
| Vercel build | ~3 minutes after push |

### 3.2 Post-deploy health

| Check | Result |
|-------|--------|
| Staging health commit | **PASS** — `d017709ad8811219293c601183b88f0ed943d2a5` |
| `origin/staging` | **PASS** — `d017709ad8811219293c601183b88f0ed943d2a5` |
| Deploy verdict | **PASS** |
| Probe | Local temp script `scripts/temp-smart4-post-merge-staging-probe.mjs` (not committed) |

---

## 4. API evidence (staging)

**Method:** Provider + employee login via `/api/auth/login`; REST calls with Vercel automation bypass header (no tokens logged).

| Check | Result |
|-------|--------|
| Provider login | **PASS** — 200 |
| `GET /api/provider/menu-translations/sources` (provider) | **PASS** — 200, `ok: true` |
| `POST /api/provider/menu-translations/sources` (materialize) | **PASS** — 405 `METHOD_NOT_ALLOWED` |
| Unauthenticated GET | **PASS** — 401 `UNAUTHORIZED` |
| Employee GET | **PASS** — 403 `FORBIDDEN` |
| Source candidates | **PASS** — 26 candidates |
| Locale coverage | **PASS** — 8 locales in summary |
| Sample `source_ref` | **PASS** — `category_label` / `paasmurt` / `field: label` (runtime slug) |
| Missing coverage | **PASS (expected)** — 26/26 missing per locale on staging QA data |
| Stale coverage | **PASS** — 0 stale |
| `employeeTranslationsLive` in provider report | **false** (expected — provider admin DTO) |
| Commercial fields in response | **PASS** — no `price`, `currency`, `mva`, `commission` |
| `provider_id` | Server-derived from auth context (not client-supplied) |

---

## 5. Provider UI evidence (staging)

**Route:** `/leverandor/meny/oversettelser` (not `/leverandor/meny` alone)

| Check | Result |
|-------|--------|
| Page load | **PASS** — HTTP 200 |
| Coverage table | **PASS** — «Dekning per språk» present in response |
| Fallback / partial coverage copy | **PASS** — «Delvis dekning er normalt…» present |
| Missing sources (API) | **PASS** — 26 `missingCandidates` |
| Missing sources (static HTML probe) | **N/A** — section «Kilder uten godkjent oversettelse» is **client-hydrated** after sources fetch; API evidence is authoritative |
| AI / autotranslation | **PASS** — none detected |
| Auto-approve | **PASS** — none |
| Currency / profile controls | **PASS** — none |
| Price visibility | **PASS** — none |
| Link from `/leverandor/meny` | **PASS** — «Åpne menyoversettelser» → `/leverandor/meny/oversettelser` (source) |

---

## 6. Employee runtime guard (staging)

**Endpoint:** `GET /api/order/window?weekOffset=0` (employee session)

| Check | Result |
|-------|--------|
| Static categories | **PASS** — `paasmurt` 4, `salat` 3, `varmrett` 1 (8 items) |
| Order identity | **PASS** — sample keys unchanged (`ost-skinke`, `smart3-smoke-item`, …) |
| Metadata leakage | **PASS** — no `approved_by`, `approved_at`, `original_text_hash`, `translationStatus` in payload |
| Commercial leakage | **PASS** — no `price`, `currency`, `mva`, `commission` |
| SMART-3 fail-closed overlay | **Preserved** — SMART-4 is provider-side only; no employee overlay logic changed in SMART-4 PR |

---

## 7. Explicit non-events

| Item | Status |
|------|--------|
| Production touched | **NO** |
| Production env / flags | **NO** |
| `LP_MENU_PROFILE_*` | **NOT activated** |
| G5d.8 | **NOT started** |
| Cutover | **NOT started** |
| Source-of-truth switch | **NO** |
| Auto-rollout | **NO** |
| DB / RLS | **Unchanged** (no migration in SMART-4 PR) |
| Sanity / original text | **Read-only** (catalog reads only) |

---

## 8. Known risks

1. **`main` → `staging` sync is manual** — merges to `main` do not auto-deploy staging; fast-forward `origin/staging` required after each staging-relevant merge.
2. **Server report is catalog-only** — `loadProviderTranslationSourcesReport` does not yet wire order-window / `menu_day` sources from helpers.
3. **Order-window / varmrett sources** — supported in extraction helpers but not included in live server report until explicitly wired.
4. **Missing-sources UI** — client-hydrated; use API evidence for QA sign-off.
5. **Staging coverage 0%** — expected on synthetic QA data (26/26 missing per locale); not a deploy defect.

---

## 9. Recommendation

| Item | Recommendation |
|------|----------------|
| SMART-4 on staging | **GO** — provider sources API + UI QA verified |
| Production SMART-4 | **Not verified in this doc** — staging-only evidence |
| Menu profile runtime / G5d.8 / cutover / SOT / auto-rollout | **Do not start** without explicit owner GO |
| Next optional work | Wire order-window sources into server report (separate PR); use [staging-sync-routine.md](../operations/staging-sync-routine.md) after each staging-relevant `main` merge |

---

## 10. Related docs

- Architecture: [smart-menu-language-profile-currency.md](./smart-menu-language-profile-currency.md) §16
- SMART-3 employee overlay evidence: [smart-menu-smart-3-runtime-evidence.md](./smart-menu-smart-3-runtime-evidence.md)
