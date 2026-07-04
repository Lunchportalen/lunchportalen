# SUPERSMART Production Cutover Plan

**Status:** PLAN ONLY — cutover **NOT STARTED**  
**Date:** 2026-07-04  
**Main HEAD (audit):** `d15ce7ca` — Phase 3B evidence archived (#408)  
**Operator note:** No production flags enabled. No runtime changes in this document.

---

## Status

- Phase 1 complete
- Phase 2 complete
- Phase 3A complete
- Phase 3B complete
- Evidence archived (`docs/evidence/supersmart-phase3a-staging-evidence.md`, `docs/evidence/supersmart-phase3b-staging-evidence.md`)
- Sanity production testdata cleanup complete (15 unpublished Melhus `menuDay-*` docs removed 2026-07-04)
- Preview/staging Sanity dataset mismatch fixed (Preview → `staging` dataset)
- **Production flag currently OFF**

---

## Scope

SUPERSMART menu profile runtime:

- provider locale/market → `menu_profile_id`
- provider workspace profile labels
- employee order-window profile labels
- market-specific hot meal generation from profile bank (Phase 3B)
- deterministic only
- no AI runtime
- no auto-approve

**Out of scope for this cutover:** G5d.8, source-of-truth switch, auto-rollout, cron `mealIdea` replacement, DB/RLS migration, Sanity schema change, order write-path changes.

---

## Production readiness (audit snapshot 2026-07-04)

| Check | Result |
|-------|--------|
| Main @ `d15ce7ca` | Phase 3A (#405) + 3B (#407) + evidence (#406, #408) on `main` |
| Production deploy | `dpl_ByuvBsmmoHpf1buNFmoEKhP7R2Tx` → `app.lunchportalen.no` (alias `lunchportalen-git-main-lunchportalen.vercel.app`) |
| Staging deploy | `dpl_7XE1RBEDum7Z5AhFWjjZVyNRpHyv` → `staging.app.lunchportalen.no` |
| Production health | `GET https://app.lunchportalen.no/api/health` → `ok: true` (2026-07-04) |
| Staging evidence | Phase 3A + 3B PASS (Melhus + 9-market) |
| Golden Path | Required PASS before GO |
| RLS drift | Required PASS before GO |
| Production Sanity test artifacts | Cleared (0 Melhus docs 2026-09-07–11) |

---

## Env / flag audit (read-only, 2026-07-04)

### Primary flag

| Flag | Production | Staging | Preview |
|------|------------|---------|---------|
| `LP_MENU_PROFILE_RESOLVER` | **OFF** (unset) | **ON** (`true`) | **ON** (`true`) |

### Other `LP_MENU_PROFILE_*` flags

| Flag | Production | Staging | Preview |
|------|------------|---------|---------|
| `LP_MENU_PROFILE_FIXED_CATEGORIES` | OFF (unset) | OFF | ON |
| `LP_MENU_PROFILE_MAPPING_DRAFT_API` | OFF | OFF | ON |
| `LP_MENU_PROFILE_RUNTIME_MAPPING_PROPOSAL` | OFF | OFF | ON |
| `LP_MENU_PROFILE_WARM_DISH_PREVIEW` | OFF | OFF | ON |
| `LP_MENU_PROFILE_WEEK_SHADOW_READ` | OFF | OFF | OFF |
| `LP_MENU_PROFILE_PUBLISH_SHADOW` | OFF | OFF | OFF |
| `LP_MENU_PROFILE_COMPATIBILITY_CUTOVER` | OFF | OFF | OFF |

**Production cutover requires only `LP_MENU_PROFILE_RESOLVER`.** Do not enable draft-chain or shadow flags in Production unless a separate, scoped GO exists.

### Sanity dataset mapping

| Target | `NEXT_PUBLIC_SANITY_DATASET` |
|--------|------------------------------|
| Production | `production` |
| Staging (custom env) | `staging` |
| Preview | `staging` (fixed 2026-07-04) |
| Development | `production` |

Project ID (all): `4udoq5d8`.

### Supabase project mapping

| Target | `NEXT_PUBLIC_SUPABASE_URL` |
|--------|----------------------------|
| Production | `https://hkpokyapzarefrgqzkos.supabase.co` |
| Staging | `https://uigxsboqeruxflgzqztl.supabase.co` |
| Preview | `https://hkpokyapzarefrgqzkos.supabase.co` (prod DB — Preview smokes must not mutate live tenants) |

---

## Production flag

**Primary flag:** `LP_MENU_PROFILE_RESOLVER`

**Production default:** OFF (unset or explicit `false`)

**Behavior when ON:**

- Resolves `menu_profile_id` from provider locale/settings
- Applies profile labels in provider workspace and employee order-window overlay
- Enables profile-bank warm dish suggestions/generation (Phase 3B) when provider invokes generate APIs

**Behavior when OFF:** Legacy flow unchanged (fail-closed to existing paths).

---

## Hard invariants

- order write-path unchanged
- `lp_order_set` unchanged
- `choice_key` unchanged
- `item_key` unchanged
- category key unchanged
- cutoff unchanged
- no commercial exposure to employee
- no metadata exposure to employee
- no DB/RLS migration
- no Sanity schema change
- no catalog reset
- no order rewrite
- Protected Golden Path must remain PASS

---

## Pre-cutover checklist

- [ ] `main` deploy healthy on Production
- [ ] `GET /api/health` on Production → `ok: true`
- [ ] Production Sanity dataset = `production`
- [ ] Production Supabase = `hkpokyapzarefrgqzkos`
- [ ] Production `LP_MENU_PROFILE_RESOLVER` = OFF (confirm before and documented in run log)
- [ ] Staging evidence complete (Phase 3A + 3B)
- [ ] `npm run test:golden-path` PASS on `main`
- [ ] `npm run check:rls-drift` PASS on `main`
- [ ] `npm run ci:commercial-hardcodes-guard` PASS on `main`
- [ ] No pending PRs affecting order/menu runtime or Protected Golden Path
- [ ] Owner **GO enable LP_MENU_PROFILE_RESOLVER production** received (separate from this plan doc)
- [ ] Rollback owner identified and available during smoke window

---

## Rollout sequence

1. Confirm Production health (`/api/health`, superadmin system status if available).
2. Confirm Production `LP_MENU_PROFILE_RESOLVER` is OFF.
3. Record Production deployment ID and git SHA at cutover start.
4. **Dry-run (optional, recommended):** Owner command **GO production cutover dry-run** — read-only verification only; no flag change.
5. Owner command **GO enable LP_MENU_PROFILE_RESOLVER production**.
6. Set `LP_MENU_PROFILE_RESOLVER=true` in Vercel **Production** env only.
7. Redeploy Production (required — env change alone is insufficient for Next.js build-time reads where applicable; redeploy ensures runtime truth).
8. Run Production smoke **immediately** (within 15 minutes of deploy ready).
9. Monitor for 24h: health, employee `/week`, provider `/leverandor/meny`, order counts, incident channel.
10. Keep flag ON only if smoke PASS and no stop conditions triggered.

---

## Canary / limited activation

**Default recommendation:** Single-flag, full Production activation **only after** dry-run GO — no auto-rollout.

If owner requires phased exposure:

| Phase | Scope | Flag | Allowed verification |
|-------|-------|------|----------------------|
| **C0** | Read-only | OFF | Re-run staging evidence scripts against Production URLs (no writes) |
| **C1** | Flag ON, observe only | ON | Provider settings + `/api/order/window` read paths; **no** `POST .../varmrett/generate` on live providers |
| **C2** | One pilot provider (Melhus) | ON | Manual provider workspace checks; generate only with explicit per-action GO |
| **C3** | All providers | ON | Full smoke matrix |

**Rules:**

- Never use Preview env (prod Supabase) for generate/write tests against live data.
- Never run profile generate on customer-facing weeks without owner GO.
- Canary must not enable additional `LP_MENU_PROFILE_*` flags unless separately approved.

---

## Production smoke

Run immediately after Production redeploy with flag ON.

### Core checks

| # | Check | Pass criteria |
|---|-------|---------------|
| 1 | Provider settings load | `/leverandor/innstillinger` loads; locale/profile fields sane |
| 2 | Provider menu load | `/leverandor/meny` loads; no crash; catalog intact |
| 3 | Employee order window | `GET /api/order/window` → `ok: true`; stable `orderId` / choice identity |
| 4 | Order identity | Existing orders unchanged (count + sample IDs) |
| 5 | Commercial boundary | Employee response has **no** price, currency, MVA, commission, provision, invoice fields |
| 6 | Metadata boundary | Employee response has **no** `approved_by`, `approved_at`, `translated_text`, internal hash |
| 7 | Profile labels | Provider + employee labels render when flag ON (spot-check nb + one non-NO market) |
| 8 | Catalog | No reset; catalog item counts unchanged for pilot providers |
| 9 | Orders | No rewrite; `orders` / `order_items` counts stable |
| 10 | Sanity | No unexpected Production Sanity mutations during smoke |
| 11 | DB/RLS | `check:rls-drift` still PASS post-deploy |
| 12 | Health | `/api/health` → `ok: true` |

### 9-market verification (Production-safe plan)

Verify without mutating live providers:

| Market | Read-only path | Write forbidden unless GO |
|--------|----------------|---------------------------|
| nb, da, de, en, fi, fr, it, es, sv | `GET /api/provider/menu-days/varmrett/suggestions?week=…` on **staging** with flag ON (already PASS in Phase 3B evidence) | `POST .../varmrett/generate` on Production |
| Production spot-check | `GET /api/order/window` per locale fixture (employee) | Any catalog/menuDay write |
| Label spot-check | Provider settings save **on staging only** (9-market matrix archived) | Production provider settings bulk save |

**Production 9-market GO:** Separate owner approval. Prefer read-only employee window checks on Production after flag ON.

---

## Rollback

If **any** smoke fails or stop condition triggers:

1. Owner command **GO rollback production resolver** (or equivalent explicit instruction).
2. Set `LP_MENU_PROFILE_RESOLVER=false` or **remove** the variable from Vercel Production env.
3. Redeploy Production.
4. Confirm `GET /api/health` → `ok: true`.
5. Confirm employee `/api/order/window` returns legacy behavior (flag OFF).
6. Confirm provider menu/settings load without profile resolver side effects.
7. Re-run Golden Path tests on `main`.
8. File incident summary: timestamp, deployment ID, flag state, failed check, rollback deployment ID.

**Target rollback time:** &lt; 30 minutes from failure detection.

---

## Stop conditions

Stop immediately and rollback if:

- `/api/order/window` fails or returns 5xx for authenticated employee fixtures
- employee sees price / currency / MVA / commission / provision / invoice data
- employee sees `approved_by` / `approved_at` / `translated_text` / internal hash / draft metadata
- order identity changes for existing orders
- catalog resets or catalog item counts drop unexpectedly
- orders rewritten or `lp_order_set` errors spike
- unexpected Sanity Production mutations (menuDay drafts on live weeks without GO)
- DB/RLS drift detected
- `/api/health` fails on Production
- Vercel deploy mismatch (flag ON but deployment not from expected `main` SHA)
- Protected Golden Path tests fail

---

## Owner GO gates

Required **separate** owner commands (do not combine):

| Gate | Command | Effect |
|------|---------|--------|
| Dry-run | **GO production cutover dry-run** | Read-only audit + smoke plan walkthrough; **no flag change** |
| Enable | **GO enable LP_MENU_PROFILE_RESOLVER production** | Set Production flag ON + redeploy + smoke |
| Rollback | **GO rollback production resolver** | Set Production flag OFF + redeploy + verify legacy |

This plan document alone is **not** a GO to cut over.

---

## Not included

- G5d.8
- source-of-truth switch
- auto-rollout
- AI runtime
- manual Production data edits (Sanity/Supabase) except explicit cleanup already completed
- enabling shadow/draft-chain `LP_MENU_PROFILE_*` flags in Production
- Preview env used as Production write target

---

## Evidence references

| Document | Purpose |
|----------|---------|
| `docs/evidence/supersmart-phase3a-staging-evidence.md` | 9-market provider settings + employee window boundaries |
| `docs/evidence/supersmart-phase3b-staging-evidence.md` | Profile bank suggestions + generate spot-check + Golden Path |
| `docs/engineering/G5d-menu-profile-cutover-audit.md` | Runtime truth map and invariants |
| `docs/PROTECTED_GOLDEN_PATH.md` | Order/menu pilot constraints |

---

## Post-cutover (if smoke PASS)

- Archive Production cutover evidence doc (separate PR, docs-only).
- Keep `LP_MENU_PROFILE_RESOLVER=ON` under monitoring; no further flags without new GO.
- Schedule optional Phase 4 items (if any) as separate scoped work — not part of this cutover.
