# G5d.7 — Compatibility cutover design plan

**Status:** Design / planning only — no runtime changes, no API changes, no UI changes, no DB/RLS changes, no `/week` changes, no Production flags, no implementation  
**Date:** 2026-06-29  
**Prerequisite:** G5d.6 chain complete (PR #375 merge `5d1c9a3b`); Production `LP_MENU_PROFILE_*` OFF  
**Related:** `G5d6-compatibility-cutover-design-audit.md`, `G5d6e-compatibility-cutover-smoke-evidence.md`, `G5d5-week-shadow-read-design-audit.md`, `tests/governance/g5d6-compatibility-cutover-contracts.test.ts`, `PROTECTED_GOLDEN_PATH.md`

---

## 1. Scope

This document defines **how a future, explicitly approved compatibility cutover could be implemented safely**. It is **not** implementation.

| In scope | Out of scope |
|----------|--------------|
| Current runtime source-of-truth analysis | Runtime implementation |
| Future hook placement (design only) | `/week` hook in this PR |
| Invariants and no-go conditions | Employee visibility changes |
| Staged rollout plan (future phases) | Order behavior changes |
| Rollback model | Publish behavior changes |
| Required tests for future work | Sanity writes |
| Observability / evidence requirements | `menuDayPayload` mutation |
| Future flag model (proposed, not implemented) | Source-of-truth switch |
| Open questions | Auto-rollout |
| Go/no-go recommendation | Production activation |
| | DB / RLS changes |
| | Provider UI |
| | G5d.8 implementation |

**Hard rules:**

- G5d.7 is **design/planning only**. This PR does **not** implement a runtime hook.
- Future implementation must be split into **separate explicit GO phases** (G5d.7a onward).
- **Production activation** requires a **separate final GO** after Preview evidence and rollback proof.
- **G5d.8** is not started from this PR.

---

## 2. Current state

### 2.1 Completed G5d chain (evidence-only today)

| Phase | Status | Delivers |
|-------|--------|----------|
| **G5d.3** | Merged + prod verified | Draft persistence (`provider_menu_profile_runtime_mapping_drafts`), mapping draft API + save UI behind flags |
| **G5d.4** | Merged | Publish-shadow helper + provider-only API (`LP_MENU_PROFILE_PUBLISH_SHADOW`) |
| **G5d.5** | Merged | Week-shadow helper + provider-only API (`LP_MENU_PROFILE_WEEK_SHADOW_READ`) |
| **G5d.6** | Merged | Compatibility comparison helper + provider-only evidence API (`LP_MENU_PROFILE_COMPATIBILITY_CUTOVER`) |
| **G5d.6e** | Merged (PR #375) | Preview smoke + rollback evidence, Production OFF proof, pre-G5d.7 checklist |

### 2.2 Employee `/week` runtime (unchanged — authoritative today)

```
GET /api/week?weekOffset=0|1
  → resolveEmployeeWeekScope (auth + profiles.company_id + location_id)
  → agreements ACTIVE row (plan tier, delivery_days)
  → resolveProviderMenuScopeForCompany (fail-closed)
  → for each Mon–Fri date:
       getMenuForDateAndPlan(date, tier, provider-scoped Sanity opts)
  → MSDI fallback: loadEmployeeWeekMenusFromMsdi when Sanity miss
  → buildEmployeeWeekDayRows → JSON { days[], agreement, locked, cutoff, … }
```

**Source of truth for employee-visible menu:**

| Source | Role |
|--------|------|
| `agreements` (ACTIVE) | Tier, delivery days, eligibility |
| Sanity `menuDay` docs | Published menu content (provider-scoped read) |
| `menu_service_days` / `menu_service_day_items` | MSDI materialization fallback |
| `menuDayContract` canonical keys | Order choice keys (`allowedChoices`, slugs) |

**Key paths (LOCKED):** `app/api/week/route.ts`, `app/(app)/week/**`, `lib/week/**`, `lib/cms/menuDay.ts`, `lib/menu/providerMenuScope.ts`.

### 2.3 Candidate profile output (not orderable today)

- G5d mapping drafts store **metadata snapshots** — not wired to publish or `/week`.
- G5d.6 compatibility evidence compares **safe provider-only snapshots** — not live `/week` response.
- `CompatibilityCutoverEvaluationDto.canProceedToRuntimeHook` is **`false`** by contract until a future implementation phase with explicit GO.
- Candidate profile runtime output must **not** become orderable without a **separate orderability phase** (G5d.8+ if ever approved).

### 2.4 Production flags

All `LP_MENU_PROFILE_*` flags remain **OFF** in Production. G5d.6e verified Preview-only smoke and rollback; no Production env changes.

---

## 3. Non-goals

G5d.7 and this PR do **not**:

- Implement runtime cutover or a `/week` hook
- Change employee-visible output or UI
- Make candidate output orderable
- Add or enable provider UI for cutover
- Write to Sanity or mutate publish flow
- Mutate `menuDayPayload`
- Change DB schema or RLS
- Activate Production `LP_MENU_PROFILE_*` flags
- Start auto-rollout or source-of-truth switch
- Start G5d.8 Production activation implementation
- Deploy or cut over any tenant

---

## 4. Proposed future architecture (design only)

### 4.1 Principle: default = current behavior

Any future runtime hook must:

1. **Preserve existing `/week` assembly as default** when hook flag is OFF.
2. Use **fail-closed** semantics: uncertainty → current behavior, never candidate behavior.
3. Require **green compatibility evidence** (G5d.6d API + governance) before hook code is even considered for Preview.
4. **Never** expose provider/internal evidence DTOs, price/commercial internals, or draft snapshots to employees.
5. **Never** mutate orders, publish, Sanity, or `menuDayPayload`.
6. **Never** make candidate output orderable until a separate explicit orderability phase.

### 4.2 Proposed hook placement (future — not implemented)

**Preferred insertion point:** a **read-only resolver wrapper** around existing week assembly — **not** a rewrite of `app/api/week/route.ts` logic.

| Layer | Current role | Future hook role (design only) |
|-------|--------------|--------------------------------|
| `app/api/week/route.ts` | HTTP entry, scope, agreement, cutoff | Unchanged surface; may call wrapper instead of direct assembly |
| `lib/week/resolveEmployeeWeekScope.ts` | Auth + tenant scope | **Do not hook here** — scope truth must stay canonical |
| `lib/week/loadEmployeeWeekMenusFromMsdi.ts` | MSDI fallback read | **Do not replace** — remains fallback |
| `lib/cms/menuDay.ts` / `getMenuForDateAndPlan` | Sanity read | **Do not replace** — remains primary read |
| `lib/week/employeeWeekMenuDays.ts` / `buildEmployeeWeekDayRows` | Row assembly | **Candidate wrapper boundary** — compare or select output here |
| **New (future) `lib/menu-profile/weekRuntimeCompatibilityResolver.server.ts`** | — | Pure read-only adapter: current rows vs candidate projection; fail-closed to current |

**Hook behavior (future, Preview-only, flag-gated):**

```
buildEmployeeWeekResponse(currentAssemblyFn, candidateProjectionFn, gate):
  if !LP_MENU_PROFILE_RUNTIME_COMPATIBILITY_HOOK → return currentAssemblyFn()
  if !compatibilityEvidenceGreen → return currentAssemblyFn()  // fail-closed
  if compareModeOnly → log/hash compare; return currentAssemblyFn()
  if explicitSelectCandidate GO not granted → return currentAssemblyFn()
  // Even with hook ON, default remains current until separate cutover GO
  return currentAssemblyFn()
```

**G5d.6d compatibility-cutover API role:** **Preflight only.** Provider_admin calls evidence endpoint; `/week` must **not** HTTP-call it at runtime unless a future phase explicitly designs an internal read (still not employee-facing). Evidence DTO is **never** the runtime source of truth.

### 4.3 Files that must not change in G5d.7 (this PR)

All paths in G5d.6 protected-path table plus:

- Order write-path: `lp_order_set`, `lp_order_advance_status`, `app/api/order/**`, `lib/orders/**`
- Publish: `app/api/provider/menu-days/**`, `lib/menu-publish/**`, `lib/provider-menu/menuDayPayload.ts`
- Sanity write: `lib/sanity/**`, `lib/cms/sanityWriteClient.ts`
- Billing / Tripletex: `lib/integrations/tripletex/**`
- Golden Path critical files per `docs/PROTECTED_GOLDEN_PATH.md`

---

## 5. Future flag model (proposed — not implemented)

**Do not add these flags in G5d.7.** Document for future phases only.

| Flag | Default | Purpose | Production |
|------|---------|---------|------------|
| `LP_MENU_PROFILE_COMPATIBILITY_CUTOVER` | OFF | G5d.6d provider evidence API (exists today) | **OFF** |
| `LP_MENU_PROFILE_RUNTIME_COMPATIBILITY_HOOK` | OFF (proposed) | Future Preview-only internal `/week` assembly wrapper | **OFF** until final GO |
| `LP_MENU_PROFILE_EMPLOYEE_PROFILE_RUNTIME` | OFF (proposed, **default forbidden**) | Future employee exposure of profile runtime — **discouraged**; separate ethics/product GO | **OFF** — likely never |

**Flag rules (proposed):**

- Hook flag OFF → **byte-level or schema-level parity** with current `/week` (TBD in G5d.7e).
- Hook flag accepts exact `"true"` only (match G5d.6 strict flag pattern) unless governance standardizes `.trim()` later.
- Employee exposure flag must remain OFF unless a **separate product GO** explicitly approves — default recommendation: **permanently forbidden**.
- **No Production flags** may be set in G5d.7 or any implementation subphase without **separate final GO**.

---

## 6. Preconditions before any implementation PR

Mandatory before **G5d.7a** (first implementation subphase):

- [ ] G5d.7 design plan merged (this document)
- [ ] G5d.6e evidence merged
- [ ] Preview smoke repeatable (Melhus / NO `provider_admin`)
- [ ] Compatibility-cutover endpoint disabled when flag OFF (404 before auth/DB)
- [ ] Production flags **OFF** verified
- [ ] Golden Path PASS (91/91)
- [ ] provider-meny-visual PASS
- [ ] week-visual PASS
- [ ] `/week` unchanged
- [ ] Employee UI unchanged
- [ ] Order flow unchanged
- [ ] No publish / order / week / Sanity coupling in evidence chain
- [ ] No runtime writes from G5d.3–G5d.6 paths
- [ ] No Sanity writes
- [ ] No `menuDayPayload` mutation
- [ ] No employee visibility
- [ ] No price/commercial exposure
- [ ] No source-of-truth switch
- [ ] No auto-rollout
- [ ] **Explicit GO** for the specific implementation subphase (G5d.7a, 7b, …)

---

## 7. Future implementation phases

Each phase requires **explicit GO**, **STOP before merge**, and **no Production flags** unless the phase explicitly states Production activation **and** the user grants **final GO**.

| Phase | Deliverable | Type | Notes |
|-------|-------------|------|-------|
| **G5d.7a** | Contract/governance tests for future runtime hook | Tests only | Locks hook boundaries before any lib code |
| **G5d.7b** | Pure resolver adapter (`weekRuntimeCompatibilityResolver.server.ts`) + unit tests (`tests/lib/menu-profile/weekRuntimeCompatibilityResolver.test.ts`) | `lib/menu-profile/` — no I/O, not wired | Compare/select logic only; not imported by `/week` |
| **G5d.7c** | Preview-only runtime hook behind `LP_MENU_PROFILE_RUNTIME_COMPATIBILITY_HOOK` | Minimal wiring at assembly boundary | Default OFF; fail-closed to current assembly |
| **G5d.7d** | Preview smoke / rollback evidence | Docs | Melhus probe; flag OFF → parity proof |
| **G5d.7e** | Byte/schema parity evidence | Docs + tests | Define parity standard (byte vs schema — open question) |
| **G5d.7f** | Limited internal canary (if ever approved) | Ops + Preview | Not employee-facing; separate GO |
| **G5d.8** | Production activation plan (if ever approved) | Docs + ops | **Final GO** only; not started from G5d.7 |

**G5d.7 (this PR) authorizes none of the above.** It only defines the plan.

---

## 8. Invariants (hard lock for all future phases)

| Invariant | Requirement |
|-----------|-------------|
| Employee DTO boundary | Employees never see provider/internal evidence DTOs, draft snapshots, or compatibility hashes |
| Commercial boundary | Employees never see `pricePreview`, `provider_price_rules`, commission/provisjon, vat/mva, billing/Tripletex |
| Order write-path | `lp_order_set`, `lp_order_advance_status`, order guards unchanged |
| Golden Path | 91/91 must pass before and after every phase |
| Publish flow | Provider publish → Sanity → MSDI unchanged |
| Sanity writes | No new Sanity write paths from menu-profile hook |
| `menuDayPayload` | Unchanged on publish write path |
| Source of truth | Sanity + MSDI + agreement remain authoritative unless **explicit future cutover GO** |
| Candidate orderability | Candidate output **not orderable** until separate phase |
| Flag OFF | Identical to current `/week` behavior (parity gate) |
| Errors | Fail-closed to **current** behavior, never candidate |
| Auto-rollout | Forbidden — no `runMenuWeekRollout*` coupling |

---

## 9. No-go conditions (hard stop)

| Condition | Action |
|-----------|--------|
| `/week` output changes while hook flag OFF | **Hard stop** — revert; no Production deploy |
| Employee UI changes unexpectedly | **Hard stop** — week-visual + smoke |
| Order flow changes | **Hard stop** — Golden Path |
| Publish / Sanity / `menuDayPayload` write detected | **Hard stop** — governance fail |
| Price/commercial field in employee payload | **Hard stop** |
| Provider/internal DTO in employee payload | **Hard stop** |
| Candidate output becomes orderable | **Hard stop** — product regression |
| Source-of-truth changes without explicit GO | **Hard stop** |
| Auto-rollout appears | **Hard stop** |
| Production flag set before final GO | **Hard stop** — unset immediately + incident |
| Golden Path fails | **Hard stop** |
| Compatibility evidence fails (hashes, counters) | **Hard stop** — no hook wiring |
| Rollback cannot restore current behavior | **Hard stop** — do not promote phase |

---

## 10. Rollback model

### 10.1 Flag rollback (preferred)

1. Unset `LP_MENU_PROFILE_RUNTIME_COMPATIBILITY_HOOK` in Preview (or Production only after final GO — reverse immediately if incident).
2. Redeploy.
3. Verify:
   - `/week` parity with pre-hook baseline
   - Employee UI unchanged
   - Order flow unchanged
   - Golden Path 91/91
   - No forbidden network calls during `/week` GET

### 10.2 Code rollback

| Problem | Action | Keep |
|---------|--------|------|
| Hook wiring regression (G5d.7c+) | Revert hook PR | G5d.7b pure adapter if OK |
| Adapter regression (G5d.7b) | Revert adapter PR | G5d.7a governance |
| Governance regression (G5d.7a) | Revert governance PR | G5d.6 + G5d.7 design docs |

**Always keep when rolling back hook work:**

- G5d.3 draft table/RLS — **do not drop**
- G5d.4/G5d.5/G5d.6 evidence routes/helpers — inert when flags OFF
- Mapping draft rows — **do not hard-delete** (archive API only)

**Production flags:** Never enable as rollback step. Accidental Production enablement → unset → incident note.

---

## 11. Required tests for future implementation

Before any G5d.7a+ merge:

| Category | Tests |
|----------|-------|
| Parity | Flag OFF byte/schema parity vs current `/week` baseline |
| Preview hook | Flag ON Preview-only — still fail-closed unless compare GO |
| Employee boundary | No provider/internal DTO keys in employee response |
| Commercial boundary | No price/commercial forbidden fields (G5d.0 + commercial-hardcodes guard) |
| Orderability | No new orderable candidate keys without explicit phase |
| Order path | No changes to `lp_order_set` / order write imports |
| Write isolation | No publish/Sanity/`menuDayPayload` writes from hook path |
| UI isolation | No provider UI imports of hook module |
| Rollout isolation | No auto-rollout / source-of-truth switch without flag |
| Fallback | Errors → current assembly, not candidate |
| Rollback | Flag OFF restores parity — automated + smoke |
| Golden Path | `npm run test:golden-path` — **91/91** |
| Governance | `g5d7-*` + extended `g5d6-*` runtime separation grep |
| Visual | provider-meny-visual, week-visual if paths triggered |
| E2E | CI E2E if triggered |

---

## 12. Observability / evidence requirements (future phases)

Every hook invocation (Preview canary) should log **safely** (no secrets, no commercial internals):

| Signal | Purpose |
|--------|---------|
| `rid` | Traceability |
| Hook flag state | OFF/ON proof |
| Source selected | `current` vs `candidate` (candidate should default never in early phases) |
| Fallback reason | fail-closed audit |
| Compatibility hash / evidence id | Link to G5d.6d preflight |
| Forbidden call detection | No order/publish/Sanity writes during `/week` GET |
| Write detection | No DB mutations from hook path |
| `/week` parity hash | Before/after hook enable (note time-bound fields) |
| Golden Path status | CI artifact |
| Production OFF status | Env audit |
| Rollback proof | Flag unset + redeploy + 404/parity |

---

## 13. Security / privacy / commercial guardrails

Future hook must **never** expose to employees:

- `providerId`
- Provider internal evidence DTOs (`compatibilityCutover`, `weekShadow`, `publishShadow`, draft payloads)
- `pricePreview`, `provider_price_rules`
- `commission`, `provisjon`, `vat`, `mva`
- Billing / Tripletex fields
- Mapping draft internals (`mappingJson`, `unmappedCategoriesJson`, etc.)

Employee-visible commercial surface remains **unchanged** — no new pricing, discounts, or provider cost signals.

---

## 14. Open questions

| Question | Options / notes |
|----------|-----------------|
| Should a runtime hook exist at all? | Default plan allows **compare-only** hook; full cutover may never be approved |
| Parity standard: byte-level vs schema-level? | Byte-level strict; schema-level ignores cutoff timestamps — decide in G5d.7e |
| How many Preview smoke cycles before canary? | Minimum: G5d.7d + G5d.7e + repeat after any hook change |
| Should employee exposure remain permanently forbidden? | **Recommended yes** — `LP_MENU_PROFILE_EMPLOYEE_PROFILE_RUNTIME` default forbidden |
| Orderability separate plan? | **Yes** — requires G5d.8+ / product GO; not part of hook compare phase |
| Internal HTTP call to G5d.6d API from hook? | **Discouraged** — prefer inline helper reuse; if HTTP, provider-only sidecar never on employee path |
| Wrapper location: `buildEmployeeWeekDayRows` vs new lib module? | Prefer new `lib/menu-profile/` adapter imported only when flag ON |

---

## 15. Go/no-go recommendation

**Recommendation:** G5d.7 may proceed **only as this design/planning PR**.

| Gate | Status |
|------|--------|
| G5d.6e evidence merged | ✅ PR #375 |
| G5d.7 design plan | ⏳ This PR |
| G5d.7a implementation GO | ❌ Not granted |
| G5d.8 Production activation | ❌ Not started |
| Production flags | ❌ OFF — must remain OFF |

**Future implementation** must be split into G5d.7a–G5d.7f with **explicit GO per phase**.

**Production activation** is **not allowed** from G5d.7. It requires **separate final GO** after Preview evidence, parity proof, and rollback proof.

**Do not interpret this document as authorization to implement a runtime hook, enable Production flags, or switch source of truth.**

---

## 16. References

| Artifact | Path |
|----------|------|
| G5d.6 design audit | `docs/engineering/G5d6-compatibility-cutover-design-audit.md` |
| G5d.6e smoke evidence | `docs/engineering/G5d6e-compatibility-cutover-smoke-evidence.md` |
| G5d.5 week shadow audit | `docs/engineering/G5d5-week-shadow-read-design-audit.md` |
| Week API | `app/api/week/route.ts` |
| Week assembly | `lib/week/employeeWeekMenuDays.ts` |
| Compatibility helper | `lib/menu-profile/runtimeCompatibilityCutover.server.ts` |
| Compatibility API | `app/api/provider/menu-profile/compatibility-cutover/route.ts` |
| Feature flags | `lib/menu-profile/featureFlag.ts` |
| Golden Path | `docs/PROTECTED_GOLDEN_PATH.md` |
| G5d.6 governance | `tests/governance/g5d6-compatibility-cutover-contracts.test.ts` |
| G5d.7 governance | `tests/governance/g5d7-compatibility-cutover-design-contracts.test.ts` |
