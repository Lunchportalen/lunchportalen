# SUPERSMART Phase 3B — Staging evidence (profile warm dish generation)

**Status:** Evidence archived · docs-only · **Phase 3B staging/preview smoke PASS**  
**Date:** 2026-07-04  
**Phase 3B merge SHA:** `d2ca1dbb1bc683c65ce91fd155214d22c629bdbc` (PR #407)  
**Environment:** PR preview + staging Supabase (`LP_MENU_PROFILE_RESOLVER=true` on preview/staging only)  
**Operator:** Cursor agent (Playwright + Supabase staging admin snapshot/restore; no runtime code changes in this archive)

This document records **verification evidence only** for Phase 3B: market-specific hot meal/default generation from the in-code profile warm dish bank, gated by `LP_MENU_PROFILE_RESOLVER`. No order write-path, publish cutover, DB migration, Sanity schema change, or production flag work is included.

**No secret values, tokens, passwords, connection strings, or private tenant PII are recorded.**

---

## 1. Scope

| In scope | Out of scope |
|----------|--------------|
| Profile warm dish bank → deterministic Mon–Fri suggestions | Production flag activation |
| `POST /api/provider/menu-days/varmrett/generate` (provider workspace) | G5d.8 · cutover · source-of-truth · auto-rollout |
| `GET /api/provider/menu-days/varmrett/suggestions` | Cron `mealIdea` rollout replacement |
| 9-market suggestions smoke (PR preview) | Runtime code changes in this archive |
| nb POST generate spot-check (week `2026-09-07`) | Catalog reset · order rewrite |
| Employee `/api/order/window` boundaries | DB/RLS migration |
| Flag OFF = legacy flow unchanged | Sanity schema mutation |
| Flag ON = profile bank generation (staging/preview) | Sanity draft cleanup (optional, separate) |

---

## 2. Flag matrix

| Flag | Staging / preview | Production | Purpose |
|------|-------------------|------------|---------|
| `LP_MENU_PROFILE_RESOLVER` | **ON** (`true`) | **OFF** (unset) | Phase 3B generation gate + resolver |
| Other `LP_MENU_PROFILE_*` | Unchanged sub-flags | **OFF** | G5c preview panel etc. unchanged |

**Production:** Not touched. No production env mutation as part of this evidence.

---

## 3. Merge reference

| Field | Value |
|-------|-------|
| PR | [#407](https://github.com/Lunchportalen/lunchportalen/pull/407) — `feat(provider-menu): generate market-specific hot meals from profile bank` |
| Branch | `feat/provider-menu-profile-hot-meal-generation` (squash-merged, deleted) |
| Commit | `d2ca1dbb1bc683c65ce91fd155214d22c629bdbc` |
| Prior main | `94b42032` — Phase 3A evidence archive (#406) |

---

## 4. Flag behavior

| Mode | Behavior |
|------|----------|
| **Flag OFF** | Legacy provider varmrett flow unchanged; generation APIs return inactive / legacy path |
| **Flag ON** | Resolved `menu_profile_id` (from locale/settings) + warm dish bank → deterministic suggestions and draft writes via `varmrettSharedWrite` |

Fallback: empty bank or resolver inactive → fail-closed to legacy/manual flow.

---

## 5. Nine-market suggestions — PASS (PR preview)

Preview target: `lunchportalen-git-feat-provider-menu-profi-a85671-lunchportalen.vercel.app`  
Test week: `2026-09-07` (Mon–Fri)  
Provider: Melhus Catering AS (`melhus-catering`)

| App | Profile ID | Country | Currency | Suggestions | Titles match bank |
|-----|------------|---------|----------|-------------|-------------------|
| **nb** | `norwegian_company_lunch` | NO | NOK | **PASS** (5) | **PASS** |
| **da** | `danish_office_lunch` | DK | DKK | **PASS** (5) | **PASS** |
| **de** | `german_business_lunch` | DE | EUR | **PASS** (5) | **PASS** |
| **en** | `uk_office_lunch` | GB | GBP | **PASS** (5) | **PASS** |
| **fi** | `finnish_office_lunch` | FI | EUR | **PASS** (5) | **PASS** |
| **fr** | `french_dejeuner` | FR | EUR | **PASS** (5) | **PASS** |
| **it** | `italian_office_lunch` | IT | EUR | **PASS** (5) | **PASS** |
| **es** | `spanish_menu_del_dia` | ES | EUR | **PASS** (5) | **PASS** |
| **sv** | `swedish_lunch` | SE | SEK | **PASS** (5) | **PASS** |

Generation banner visible on `/leverandor/meny` when resolver active. Current-week blocked dates returned via `skippedDates` (published/order-locked/provider-authored safety).

---

## 6. nb POST generate spot-check — PASS

| Check | Result |
|-------|--------|
| Market | nb / `nb-NO` → `norwegian_company_lunch` |
| Week | `2026-09-07` … `2026-09-11` |
| Response | **200** `{ ok: true, source: "profile_bank" }` |
| Applied dates | **5/5** Mon–Fri |
| Titles vs profile bank | **PASS** (deterministic seed) |
| Row shape | **draft** · `autoFilled: true` · `providerOverride: false` (all tiers) |
| `menu_service_days` count | **91 → 91** (unchanged — drafts not synced) |
| `orders` count | **1 → 1** (unchanged) |
| Catalog count/titles | **Unchanged** |

Mon–Fri titles (nb bank, provider-scoped seed):

| Date | Title |
|------|-------|
| 2026-09-07 | Kyllinggryte med ris og grønnsaker |
| 2026-09-08 | Vegetarisk gryte med rotgrønnsaker og byggryn |
| 2026-09-09 | Ovnsbakt laks med poteter og agurksalat |
| 2026-09-10 | Kjøttkaker med brun saus, poteter og ertestuing |
| 2026-09-11 | Lasagne med salat |

---

## 7. Employee `/api/order/window` — PASS

| Check | Result |
|-------|--------|
| HTTP status | **200** |
| Profile label overlay | **PASS** — market-specific varmrett label (nb: «Varmrett») |
| `choice_key` | **Stable** |
| `item_key` | **Stable** (e.g. `ost-skinke`, `laks-eggerore`) |
| Category key | **Stable** (e.g. `paasmurt`, `salat`, `varmrett`) |
| Commercial exposure | **NONE** |
| Metadata exposure | **NONE** |

Verified after nb POST generate; order identity unchanged.

---

## 8. Safety

| Check | Result |
|-------|--------|
| Catalog reset | **NO** |
| Orders rewritten | **NO** |
| Order write-path | **NOT TOUCHED** |
| `lp_order_set` | **NOT TOUCHED** |
| DB/RLS | **NO MIGRATION** |
| Sanity schema | **NO CHANGE** (draft `menuDay` writes via existing write path only) |
| Production flags | **OFF** |
| G5d.8 / cutover / SOT / auto-rollout | **NOT STARTED** |
| Provider settings restore | **PASS** after smoke |

---

## 9. Gates (local @ `d2ca1dbb`)

| Gate | Result |
|------|--------|
| CI (PR #407) | **PASS** — build, enterprise, e2e, agents_gate, provider-meny-visual, Vercel |
| `npm run typecheck` | **PASS** |
| `npm run lint` | **PASS** |
| `npm run ci:commercial-hardcodes-guard` | **PASS** |
| `generateWeekMenu.test.ts` | **PASS** |
| `profileWarmDishGeneration.test.ts` | **PASS** |
| `profileMenuRuntime.test.ts` | **PASS** |
| `protected-golden-path.test.ts` | **PASS** |
| `npm run test:golden-path` | **PASS** 101/101 |
| `npm run check:rls-drift` | **PASS** |

---

## 10. Known risk (non-blocking)

| Item | Detail |
|------|--------|
| Future-week draft Sanity `menuDay` docs | Melhus staging retains draft varmrett rows for **2026-09-07–11** after nb POST generate spot-check |
| Reset API behavior | `varmrett/reset` restores to generated baseline (same content); does not delete draft docs |
| Impact | **Low** — unpublished future week; no `menu_service_days` or order sync |
| Cleanup | **Optional separate ops** — not part of Phase 3B merge or this archive |

---

## 11. Enterprise status

| Item | Status |
|------|--------|
| Phase 3B on main | **COMPLETE** @ `d2ca1dbb` |
| Production cutover | **NOT STARTED** |
| `LP_MENU_PROFILE_RESOLVER` in production | **OFF** — explicit GO required |
| Cron `mealIdea` rollout | **Unchanged** — separate from provider workspace generation |
| G5d.8 / cutover / SOT | **NOT STARTED** |

---

## 12. Artifacts (local only — not committed)

| Artifact | Committed |
|----------|-----------|
| `_tmp-phase3b-melhus-smoke-result.json` | **NO** |
| `_tmp-phase3b-nb-generate-spotcheck-result.json` | **NO** |
| `scripts/temp-phase3b-*.mjs` | **NO** |
| `.env.local` | **NO** |

---

## 13. Go / no-go

| Decision | Status |
|----------|--------|
| Phase 3B staging/preview verification | **PASS** |
| Phase 3B merged to main | **DONE** (#407 @ `d2ca1dbb`) |
| Production `LP_MENU_PROFILE_RESOLVER` | **BLOCKED** until explicit GO |
| G5d.8 / cutover / SOT | **NOT STARTED** |

**Recommendation:** Keep resolver ON on staging/preview for soak. Do not promote resolver or generation cutover to production without scoped PR, regression gates, and explicit operator GO. Optional Sanity cleanup of Melhus future-week drafts is separate ops work.
