# G5d.8 Planning

**Status:** PLAN ONLY — G5d.8 **NOT STARTED** · SOT **NOT STARTED** · auto-rollout **NOT STARTED**  
**Date:** 2026-07-04  
**Main HEAD (audit):** `c35672cd` — Phase 4 production monitor evidence (#411)  
**Prior runtime merge:** `616c54c2` — Phase 4 enterprise menu profile control (#410)

This runbook defines the **next control phase** before any source-of-truth (SOT) cutover. It is **not** implementation, **not** Production flag activation, and **not** authorization to merge runtime work.

**No secret values, tokens, passwords, or private tenant PII are recorded.**

---

## Status

| Item | State |
|------|--------|
| SUPERSMART Phase 1–4 | **DONE** — merged + production monitor PASS |
| `LP_MENU_PROFILE_RESOLVER` in Production | **ON** (SUPERSMART cutover complete) |
| Phase 4 enterprise control layer | **LIVE** (`/superadmin/menu-profiles`, provider health UI, generation audit) |
| G5d.3–G5d.7 chain (compatibility / shadow) | **Merged in repo** — flags **OFF** in Production |
| G5d.7c runtime hook (`LP_MENU_PROFILE_RUNTIME_COMPATIBILITY_HOOK`) | **Implemented, not Production-active** |
| **G5d.8** | **NOT STARTED** |
| SOT switch | **NOT STARTED** |
| Auto-rollout | **NOT STARTED** |

---

## Scope

**G5d.8** in this repository is the **production activation control phase** for the G5d compatibility-cutover chain — not a repeat of SUPERSMART resolver cutover (already live).

G5d.8 planning covers:

1. **Readiness gates** before any Production activation of G5d-specific flags (primarily `LP_MENU_PROFILE_RUNTIME_COMPATIBILITY_HOOK`).
2. **Evidence requirements** (Preview smoke, parity, rollback proof) inherited from G5d.6e / G5d.7 design.
3. **Stop conditions** and **rollback** paths that protect Golden Path, employee boundaries, and catalog/order stability.
4. **Owner GO gates** separating: implement · stage · verify · SOT planning.
5. **Explicit boundary** between what is already live (SUPERSMART resolver + Phase 4) vs what remains preview/staging-only (shadow, draft, hook, SOT).

G5d.8 **does not** authorize:

- Making candidate profile output **orderable** without a separate product GO.
- Source-of-truth switch or auto-rollout.
- Enabling draft-chain / shadow flags in Production without scoped GO.

---

## Not included

| Excluded | Reason |
|----------|--------|
| SOT switch | Separate final GO after G5d.8 control phase |
| Auto-rollout | Forbidden by governance (`runMenuWeekRollout*` coupling) |
| Order write-path changes | Hard lock — `lp_order_set`, order guards |
| `lp_order_set` changes | Protected Golden Path |
| DB/RLS migration | Out of scope — G5d.3 draft table already exists; no new migration in G5d.8 plan |
| Sanity schema mutation | Out of scope |
| Employee commercial exposure | Hard stop |
| Employee metadata exposure | Hard stop |
| Re-cutover of `LP_MENU_PROFILE_RESOLVER` | Already ON — rollback path documented separately |

---

## Audit summary (repo, 2026-07-04)

### Existing G5d.8 references

| Location | Role |
|----------|------|
| `docs/engineering/G5d7-compatibility-cutover-design-plan.md` | Defines G5d.8 as **Production activation plan** (docs + ops, final GO only) |
| `docs/engineering/G5d6-compatibility-cutover-design-audit.md` | G5d.8 = NO parity cutover without final GO |
| `lib/menu-profile/weekRuntimeCompatibilityResolver.server.ts` | Pure adapter; `g5d8_production_requires_separate_final_go` reason code |
| `tests/governance/g5d7a-runtime-hook-governance-contracts.test.ts` | Locks G5d.7b/7c/8 explicit GO |
| `tests/governance/live-readiness-launch-audit-contracts.test.ts` | Evidence docs must not claim G5d.8 started |
| `docs/runbooks/supersmart-production-cutover-plan.md` | Lists G5d.8 as out of scope for resolver cutover |
| `docs/evidence/supersmart-phase4-production-monitor-evidence.md` | Production monitor PASS post Phase 4 |

**No dedicated G5d.8 implementation branch or runtime PR exists.** G5d.7c hook code is merged; Production hook flag remains OFF.

### Feature flags (`lib/menu-profile/featureFlag.ts`)

| Flag | Production (current) | G5d.8 relevance |
|------|----------------------|-----------------|
| `LP_MENU_PROFILE_RESOLVER` | **ON** | SUPERSMART live — **not** a G5d.8 activation target |
| `LP_MENU_PROFILE_FIXED_CATEGORIES` | OFF | Preview/staging sub-flag |
| `LP_MENU_PROFILE_WARM_DISH_PREVIEW` | OFF | Preview/staging sub-flag |
| `LP_MENU_PROFILE_RUNTIME_MAPPING_PROPOSAL` | OFF | Draft-chain — stay OFF in Production |
| `LP_MENU_PROFILE_MAPPING_DRAFT_API` | OFF | Draft-chain — stay OFF in Production |
| `LP_MENU_PROFILE_PUBLISH_SHADOW` | OFF | Evidence-only API |
| `LP_MENU_PROFILE_WEEK_SHADOW_READ` | OFF | Evidence-only API |
| `LP_MENU_PROFILE_COMPATIBILITY_CUTOVER` | OFF | Evidence-only API |
| `LP_MENU_PROFILE_RUNTIME_COMPATIBILITY_HOOK` | **OFF** | **Primary G5d.8 activation candidate** (G5d.7c) |
| `LP_MENU_PROFILE_EMPLOYEE_PROFILE_RUNTIME` | **Not implemented** | Do not implement without separate GO |

### Protected paths (must not change without Protected Golden Path audit)

| Area | Paths / contracts |
|------|-------------------|
| Order write | `lp_order_set`, order RPC wrappers, cutoff GUC |
| Employee week | `app/api/week/route.ts`, `app/(app)/week/**`, `lib/week/**` |
| Order window | `app/api/order/window/route.ts` |
| Provider production status | `lp_order_advance_status`, provider order enrichment |
| Publish → MSDI | Sanity publish, `menu_service_days`, `menuDayPayload` |
| Governance | `docs/PROTECTED_GOLDEN_PATH.md`, `npm run test:golden-path` |

### Read vs write (current production)

| Surface | Posture |
|---------|---------|
| Superadmin menu profiles | **Read-only** oversight |
| Provider menu profile health / generation banner | **Read + draft Sanity writes** (varmrett generate → staging Sanity dataset rules per env) |
| Employee `/api/order/window` | **Read-only** — profile label overlay when resolver ON |
| Employee `/api/week` | **Read-only** — authoritative Sanity + MSDI assembly |
| G5d shadow/draft APIs | **Not active** in Production (flags OFF) |
| G5d.7c hook | **Not wired active** in Production (flag OFF) |

### Implementation already in repo (inactive in Production)

- `weekRuntimeCompatibilityResolver.server.ts` (G5d.7b pure adapter)
- G5d.6 compatibility-cutover provider API (flag OFF)
- G5d.5 week-shadow read API (flag OFF)
- G5d.4 publish-shadow API (flag OFF)
- G5d.3 mapping draft persistence (flag OFF in Production)

**Audit conclusion:** G5d.8 planning **does not require** order write-path, `lp_order_set`, DB/RLS migration, or Sanity schema changes. Future G5d.8 **implementation** must preserve these invariants; any violation is a **hard stop**.

---

## Current production state

| Check | Result |
|-------|--------|
| Deploy | `616c54c2` on `app.lunchportalen.no` (verified 2026-07-04) |
| `/api/health` | **PASS** |
| `LP_MENU_PROFILE_RESOLVER` | **ON** |
| Other `LP_MENU_PROFILE_*` | **OFF** |
| Golden Path | **PASS** (101 tests @ monitor) |
| RLS drift | **PASS** |
| Phase 4 evidence | `docs/evidence/supersmart-phase4-production-monitor-evidence.md` |
| Order identity | **Stable** |
| Commercial / metadata exposure | **None** (monitor) |
| Catalog reset / orders rewritten | **NO** |

---

## Preconditions (before any G5d.8 implementation GO)

All must be green:

- [ ] Production `/api/health` PASS with expected commit
- [ ] `/api/order/window` PASS — 200, stable identity, no commercial/metadata leaks
- [ ] `/api/week` unchanged vs pre-G5d.8 baseline when hook flag OFF
- [ ] Profile runtime PASS (resolver ON path — labels, provider workspace)
- [ ] Catalog counts stable (orders, published `menu_service_days`)
- [ ] `npm run test:golden-path` PASS
- [ ] `npm run check:rls-drift` PASS
- [ ] `npm run ci:commercial-hardcodes-guard` PASS
- [ ] G5d.6e + G5d.7 Preview evidence reviewed (or re-run if stale)
- [ ] Rollback owner assigned (on-call roster)
- [ ] Explicit **GO implement G5d.8** from owner (not this document)

---

## G5d.8 readiness gates

Exact checks required **before** enabling `LP_MENU_PROFILE_RUNTIME_COMPATIBILITY_HOOK` in Production (or any G5d.8 runtime phase):

| # | Gate | Command / surface |
|---|------|-------------------|
| 1 | Governance contracts | `tests/governance/g5d7a-runtime-hook-governance-contracts.test.ts` |
| 2 | Adapter unit tests | `tests/lib/menu-profile/weekRuntimeCompatibilityResolver.test.ts` |
| 3 | Golden Path | `npm run test:golden-path` |
| 4 | Commercial guard | `npm run ci:commercial-hardcodes-guard` |
| 5 | RLS drift | `npm run check:rls-drift` |
| 6 | Preview hook smoke | Flag ON Preview only — parity vs flag OFF baseline |
| 7 | Employee exposure scan | `/api/order/window` + `/api/week` — no commercial/metadata |
| 8 | Provider isolation | Cross-tenant negative test pattern (P0-5) |
| 9 | Rollback drill | Unset hook flag → redeploy → parity proof |
| 10 | Protected path guard | `node scripts/ci/guard-protected-golden-path.test.mjs` |

**Production hook flag OFF** must remain identical to current employee behavior (parity gate).

---

## Stop conditions

**Hard stop — do not promote; rollback if already enabled:**

| Condition | Action |
|-----------|--------|
| Production health fails | Rollback hook flag; incident |
| `/api/order/window` fails or identity drifts | Rollback; incident |
| Employee sees commercial data | Rollback; incident |
| Employee sees forbidden metadata | Rollback; incident |
| Order identity changes unexpectedly | Rollback; Golden Path audit |
| Catalog reset detected | Rollback; incident |
| Orders rewritten | Rollback; incident |
| DB/RLS drift | Stop line — no deploy |
| Unexpected Sanity **production** mutation from hook path | Rollback; incident |
| `lp_order_set` / order write-path touched | Revert PR; incident |
| Golden Path fails | Stop merge / rollback |
| Source-of-truth switch without GO | Hard stop |
| Auto-rollout detected | Hard stop |
| Production flag set before explicit GO | Unset immediately; incident |

---

## Rollback

### Preferred: flag rollback

1. Unset `LP_MENU_PROFILE_RUNTIME_COMPATIBILITY_HOOK` in Production (if ever enabled).
2. Confirm `LP_MENU_PROFILE_RESOLVER` state per owner intent (Phase 4 cutover — separate rollback: `docs/runbooks/supersmart-production-cutover-plan.md`).
3. Redeploy Production.
4. Verify:
   - `/api/health` PASS
   - `/api/order/window` PASS — stable identity
   - `/api/week` parity with pre-activation baseline
   - Golden Path PASS
   - No commercial/metadata exposure

### Code rollback

| Problem | Action | Keep |
|---------|--------|------|
| Hook wiring regression | Revert G5d.7c+ PR | G5d.7b adapter if clean |
| Adapter regression | Revert adapter PR | Governance tests |
| SUPERSMART regression | Follow supersmart cutover rollback runbook | Phase 4 read-only UI if isolated |

**Do not drop** G5d.3 draft table/RLS. **Do not hard-delete** mapping draft rows.

---

## Owner GO gates

Separate required owner commands — **do not combine**:

| Gate | Owner command | Effect |
|------|---------------|--------|
| Planning | *(this document merged)* | Docs-only; **no runtime** |
| Implement | **GO implement G5d.8** | Authorize scoped runtime PR(s) — hook staging, tests, evidence |
| Stage | **GO stage G5d.8** | Preview/ staging flag ON + smoke + rollback drill |
| Verify | **GO verify G5d.8** | Production hook flag ON (if approved) + production monitor |
| SOT planning | **GO SOT cutover planning** | Separate docs phase — **not** G5d.8 implementation |
| SOT switch | **GO SOT cutover** | Future — explicit; not authorized here |
| Rollback | **GO rollback G5d.8** | Unset hook flag + redeploy + verify |

This runbook alone is **not** a GO to implement, stage, or activate Production flags.

---

## Before SOT cutover (future)

SOT switch requires **all** of:

- G5d.8 verify PASS (hook Production stable OR explicit decision to skip hook)
- Byte/schema parity evidence between current and candidate employee menu assembly
- `canProceedToRuntimeHook` governance green (when applicable)
- Order write-path untouched throughout
- No auto-rollout
- Archived production evidence
- Separate **GO SOT cutover** — not G5d.8 verify alone

---

## Evidence references

| Document | Purpose |
|----------|---------|
| `docs/evidence/supersmart-phase4-production-monitor-evidence.md` | Phase 4 production PASS |
| `docs/runbooks/supersmart-production-cutover-plan.md` | Resolver cutover (complete) |
| `docs/engineering/G5d7-compatibility-cutover-design-plan.md` | Hook architecture + invariants |
| `docs/engineering/G5d6-compatibility-cutover-design-audit.md` | Compatibility chain audit |
| `docs/PROTECTED_GOLDEN_PATH.md` | Order/menu pilot locks |
| `lib/menu-profile/featureFlag.ts` | Flag definitions |

---

## Recommendation

Merge this planning runbook as the **control baseline** before any G5d.8 implementation work. Next authorized step requires explicit owner **GO implement G5d.8** — not SOT, not auto-rollout, not additional Production flags beyond the scoped hook activation plan.

**Do not start G5d.8 implementation, SOT, or auto-rollout from this document.**
