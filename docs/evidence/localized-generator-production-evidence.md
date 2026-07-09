# Localized fixed menu generator — Production evidence archive

**Status:** Evidence archived · docs-only · **production verification PASS**  
**Date:** 2026-07-05  
**Production commit:** `325afbce344f1a13abce06b687006daa069dc897` (main HEAD after PR #420)  
**Environment:** Production — `https://app.lunchportalen.no` · Sanity dataset **`production`**  
**Operator:** Cursor agent (read-only verification + controlled canary apply; no SOT / auto-rollout)

This document records **verification evidence only** for the localized fixed menu generator launch chain through PR #420. It is the authoritative trace before any further rollout (SOT, auto-rollout, or additional production applies).

**No secret values, tokens, passwords, connection strings, or private tenant PII are recorded.**

---

## 1. PR chain

| PR | Title | Merge commit (main) |
|----|-------|---------------------|
| [#415](https://github.com/Lunchportalen/lunchportalen/pull/415) | feat(menu): build localized fixed provider menu generator | `361f088248664b7a461e256d973c7aec3362867a` |
| [#416](https://github.com/Lunchportalen/lunchportalen/pull/416) | fix(menu): localize provider menu surface categories and fixed choices | `1ab72e3c5da3f03a4b375a1d0973a1731de5f62b` |
| [#418](https://github.com/Lunchportalen/lunchportalen/pull/418) | feat(menu): add enterprise provider apply flow for localized fixed week menu | `df16c5c2` (squash on main) |
| [#419](https://github.com/Lunchportalen/lunchportalen/pull/419) | fix(menu): prevent implicit catalog updates in localized generator apply | `e6363fa8a23691609c700869c8c29a38cb45f6c2` |
| [#420](https://github.com/Lunchportalen/lunchportalen/pull/420) | fix(menu): make localized generator catalog dryRun idempotent after apply | `325afbce344f1a13abce06b687006daa069dc897` |

**Capability at production:** 8/8 fixed categories supported · `unsupportedCategories=[]`.

---

## 2. Production flags

| Flag | Production | Notes |
|------|------------|-------|
| `LP_MENU_PROFILE_RESOLVER` | **ON** | Pre-existing resolver; unchanged by canary |
| `LP_LOCALIZED_FIXED_MENU_GENERATOR` | **ON** | Enables localized generator panel + apply route |

**SOT / auto-rollout:** Not started.

---

## 3. Production Sanity readiness

| Check | Result |
|-------|--------|
| Global `lunchCategory-vegetarian` template | **Seeded** (createIfNotExists only — not full destructive seed) |
| `lunchCategory-vegetarian` `displayOrder` | **6** |
| `lunchCategory-varmrett` `displayOrder` | **7** (patched from 6) |
| Existing global templates | **Unchanged** (no destructive seed run) |
| Provider-scoped docs | Only missing categories created under strict apply |

---

## 4. Production canary apply — PASS

Controlled first production apply (single session; `create_missing_only_strict`; no catalog replace).

| Field | Value |
|-------|-------|
| Provider | Melhus Catering AS |
| Provider ID | `11111111-1111-1111-1111-111111111111` |
| Week start | `2031-03-31` (weekdays through `2031-04-04`) |
| Mode | `create_missing_only_strict` · `categoryScope=all_supported` · `dryRun=false` |
| Deploy at apply | `e6363fa8` (pre–PR #420; apply safety from #419) |

**Created:**

| Artifact | Detail |
|----------|--------|
| Provider-scoped vegetarian doc | `lunchCategory-11111111-1111-1111-1111-111111111111-vegetarian` · 3 items · allergens set |
| Varmrett menuDay drafts | **15 docs** = 5 weekdays × 3 plan tiers (BASIS, LUXUS, ENTERPRISE) |

**Not mutated:**

| Check | Result |
|-------|--------|
| Existing Påsmurt provider catalog `_rev` | **Unchanged** (`WMYow9Ig064KslncDIr3Bi`) |
| Global template `_rev` values | **Unchanged** |
| Published docs | **None changed** |
| Catalog updates under strict mode | **0** |
| Order count (Melhus) | **17 → 17** (unchanged) |
| All canary menuDays | `approvedForPublish=false` · `customerVisible=false` |

**Pre–PR #420 note:** Post-apply dryRun at `e6363fa8` incorrectly reported `vegetarian: would_create_category` due to CDN-stale catalog read in diff path. Sanity read-back confirmed doc existed. Fixed in PR #420.

---

## 5. PR #420 production dryRun-only verification — PASS

After merge and production deploy of `325afbce`:

| Input | Value |
|-------|-------|
| Provider | Melhus · `11111111-1111-1111-1111-111111111111` |
| Week | `2031-03-31` |
| Mode | `create_missing_only_strict` · `dryRun=true` only |

| Check | Result |
|-------|--------|
| `/api/health` commit | **`325afbce344f1a13abce06b687006daa069dc897`** |
| `createdDraftDays` | **0** |
| `updatedDraftDays` | **0** |
| `vegetarian` status | **`would_skip_existing_category`** |
| `would_create_category` (vegetarian) | **false** |
| Catalog updates | **0** |
| `unsupportedCategories` | **`[]`** |
| Sanity mutation during dryRun | **NONE** |
| Canary docs after dryRun | 15 tier-docs · 5 unique weekdays · no duplicates · no extra dates |

**Staging smoke (pre-merge):** PASS on `bab39f14` · week `2031-04-07` · post-apply dryRun idempotent.

---

## 6. Safety regression

| Check | Result |
|-------|--------|
| `/api/week` | **PASS** |
| `/api/order/window` | **PASS** |
| Order count | **17** (unchanged across canary + dryRun verify) |
| Order write-path | **NOT TOUCHED** |
| `lp_order_set` | **NOT TOUCHED** |
| Employee economy exposure | **NONE** |
| Employee metadata exposure | **NONE** |
| DB/RLS | **UNCHANGED** (no migration in this chain) |
| Production flags | **UNCHANGED** (resolver + generator ON as above) |
| Apply route unauthenticated | **401** |
| SOT | **NOT STARTED** |
| Auto-rollout | **NOT STARTED** |

---

## 7. Known limitations

1. **Week-aggregated catalog merge** — Fixed categories (sandwich, salad, vegetarian, sushi, poke, asian) apply via provider-scoped `lunchCategory` docs aggregated at week level, not per-day item docs.
2. **Tier model for varmrett** — Apply creates **15** Sanity `menuDay` documents per 5-day week (one per weekday × BASIS/LUXUS/ENTERPRISE), not 5 single docs.
3. **Canary scope** — Week `2031-03-31` drafts are far-future and **unpublished** (`approvedForPublish=false`, `customerVisible=false`).
4. **Strict mode default** — `create_missing_only_strict` skips existing provider catalog docs; legacy `create_missing_only` could implicit-update catalogs (blocked by #419).
5. **No SOT / auto-rollout** — Menu source-of-truth cutover and automated rollout are **not** started; separate GO required.
6. **No additional production apply** — Further applies require explicit operator GO.

---

## 8. Protected Golden Path impact

| Area | Impact |
|------|--------|
| Order write-path · `lp_order_set` | **None** — not modified in PR chain |
| Employee `/week` order flow | **None** — read-only verification only |
| Provider production status flow | **None** — canary used future-week drafts only |

---

## 9. Recommendation

Production localized generator chain is **verified and clean** at `325afbce`. Safe next steps (each requires separate GO):

1. Production dryRun re-check after any future deploy (no apply).
2. SOT planning / cutover (not started).
3. Auto-rollout (not started).
4. Additional provider applies (not authorized).

**Do not** run production apply, start SOT, or start auto-rollout without explicit operator GO.
