# G5d.5 — /week shadow read design audit

**Status:** Design / audit only — no runtime changes, no API changes, no UI changes, no DB/RLS changes, no `/week` changes, no Production flags  
**Date:** 2026-06-28  
**Prerequisite:** G5d.4 chain complete (PR #364 merge `bd4ea38f`); Production `LP_MENU_PROFILE_*` OFF  
**Related:** `G5d4f-publish-shadow-smoke-evidence.md`, `G5d4-publish-shadow-design-audit.md`, `G5d3f-smoke-rollback-evidence.md`, `tests/governance/g5d0-menu-profile-runtime-contracts.test.ts`, `tests/governance/g5d4-publish-shadow-contracts.test.ts`, `PROTECTED_GOLDEN_PATH.md`

---

## 1. Scope

This document plans **/week shadow read** for G5d.5. It is **not** implementation.

| In scope | Out of scope |
|----------|--------------|
| Architecture design | Runtime changes |
| Flag model proposal | `/week` response changes |
| Week shadow DTO contract | Employee UI changes |
| Protected paths | Employee visibility |
| Test / smoke / rollback plans | Order write-path changes |
| Implementation phasing | Publish activation |
| Go/no-go gates | Sanity writes |
| | `menuDayPayload` mutation |
| | Production flags |
| | Runtime cutover (G5d.6+) |

**Hard rules:**

- G5d.5 **implementation** must not start until this audit is reviewed and merged.
- G5d.5b requires **explicit GO** before any code.
- G5d.6 must **not** start from this PR.

---

## 2. Current /week baseline

### 2.1 `/week` files in repository

| Layer | Path |
|-------|------|
| Week API | `app/api/week/route.ts` |
| Employee week pages | `app/(app)/week/page.tsx`, `EmployeeWeekClient.tsx`, `min-dag/page.tsx`, `ordre/[date]/page.tsx`, `tidligere-lunsjdager/page.tsx`, `mine-registrerte-dager/page.tsx`, `allergenprofil/page.tsx`, `bestillingsprofil/page.tsx`, `mine-lunsjendringer/page.tsx` |
| Order window API | `app/api/order/window/route.ts` |
| Orders week API | `app/api/orders/week/route.ts` |
| Week lib | `lib/week/employeeWeekMenuDays.ts`, `loadEmployeeWeekMenusFromMsdi.ts`, `resolveEmployeeWeekScope.ts`, `availability.ts`, `weekMenuReadiness.ts`, `orderPatternsClient.ts` |
| Employee components | `components/employee/WeekAllergenProfileCard.tsx`, `components/week/WeekMenuNotificationToggle.tsx` |
| Menu scope | `lib/menu/providerMenuScope.ts` |
| CMS read | `lib/cms/menuDay.ts`, `lib/cms/menuDayContract.ts` |

### 2.2 How `/week` data is built today

```
GET /api/week?weekOffset=0|1
  → resolveEmployeeWeekScope (auth + company_id + location_id)
  → agreements ACTIVE row (plan tier, delivery_days)
  → resolveProviderMenuScopeForCompany (fail-closed if scope unsafe)
  → for each Mon–Fri date:
       getMenuForDateAndPlan(date, tier, provider-scoped Sanity opts)
  → MSDI fallback: loadEmployeeWeekMenusFromMsdi when Sanity miss
  → buildEmployeeWeekDayRows → JSON { days[], agreement, locked, cutoff, … }
```

**Employee page (`app/(app)/week/page.tsx`):**

- Server auth + active agreement gate
- Loads menu via CMS helpers and renders `EmployeeWeekClient`
- Order actions via `/api/order/set-day` (client) — not menu-profile shadow

**Source of truth for employee-visible menu:**

| Source | Role |
|--------|------|
| `agreements` (ACTIVE) | Tier, delivery days, eligibility |
| Sanity `menuDay` docs | Published menu content (provider-scoped read) |
| `menu_service_days` / `menu_service_day_items` | MSDI materialization fallback when Sanity read misses |
| Employee orders | `lp_order_set` / order rows — choice keys, not draft snapshots |

**`menuDayPayload` role today:**

- Used only on **provider publish write path** (`app/api/provider/menu-days/**`, `lib/provider-menu/menuDayPayload.ts`)
- Builds Sanity `menuDay` documents on publish — **not** read by `/api/week`
- `/week` reads **published** menu via `getMenuForDateAndPlan` / MSDI — never mutates payload builder

### 2.3 Order write-path from employee choice

```
EmployeeWeekClient → POST /api/order/set-day (or orders/set)
  → orderWriteGuard (no pricing overrides on employee body)
  → getPublishedMenuForDate (validates choice against published menu)
  → lp_order_set RPC (lib/orders/rpcWrite.ts)
  → order status / MSDI choice slug resolution (msdiChoiceSlug.ts)
```

**Orderability coupling:**

- `days[].allowedChoices` and `choice_key` values come from `menuDayContract` canonical keys (`PLAN_ORDER_CHOICE_KEYS`, category → order choice mapping)
- Golden Path proven: `paasmurt`, `varmmat` (varmrett alias), etc.
- G5d.0 contracts: profile category keys must **not** become order choice keys without explicit cutover GO

### 2.4 Employee commercial visibility (must remain unchanged)

- `assertEmployeeOrderBodyHasNoPricingOverrides` — employee order body must not carry price/currency/commission fields
- G5d.0 governance: `/week` surfaces must not import `pricePreview`, `provider_price_rules`, menu-profile presentation modules
- Week API response exposes menu titles, allergens, choice labels — **not** provider cost, commission, or internal pricing rules

---

## 3. What G5d.4 provides

| Phase | Delivers |
|-------|----------|
| G5d.3b–G5d.3e | Saved mapping draft snapshots (metadata only, not read by `/week` today) |
| G5d.4c | `buildRuntimeMappingPublishShadowEvaluation` — pure server-only evaluator |
| G5d.4d | `GET /api/provider/menu-profile/publish-shadow?menuProfileId=…` behind `LP_MENU_PROFILE_PUBLISH_SHADOW` |

**Shadow DTO invariants (G5d.4c/d):**

```typescript
// PublishShadowEvaluationDto (evidence only — never source of truth)
{
  shadowOnly: true;
  menuProfileId: string;
  draftId: string;
  mappingVersion: string;
  evaluatedAt: string;
  wouldMapCategories: [...];
  unmappedCategories: string[];
  warmDishPreviewSummary: { count: number; previewOnly: true };
  blockedRuntimeActivationReasons: string[]; // shadow_only_no_* reasons
  publishImpact: {
    runtimeWrites: 0;
    sanityWrites: 0;
    orderChanges: 0;
    weekChanges: 0;
    employeeVisibleChanges: 0;
  };
  comparisonToCurrentPublish: { currentPublishUnchanged: true; notes: string[] };
}
```

**API response meta (G5d.4d):** `{ shadowOnly: true, runtimeWrites: 0, … employeeVisibleChanges: 0 }`

**Not source of truth:** Shadow output must never replace Sanity menuDay, MSDI, or `/api/week` response.

---

## 4. Goal of G5d.5 (/week shadow read)

**/week shadow read** evaluates how a saved mapping draft *would hypothetically relate* to current employee `/week` output — **without changing** employee-visible data or orderability.

| Must do | Must never do |
|---------|---------------|
| Compare publish-shadow evidence to current `/week` payload shape (read-only) | Alter `GET /api/week` response |
| Produce provider/internal comparison evidence | Render shadow data in employee UI |
| Prove `currentWeekUnchanged: true` when flag ON | Change order choice keys |
| Prove `employeeVisibleChanges: 0` | Touch `lp_order_set` / order write-path |
| Prove `weekResponseChanges: 0` | Expose price/commercial internals to employees |
| Hash or structural diff current week vs hypothetical shadow | Write runtime tables |
| Fail-closed on any employee/week mutation attempt | Call Sanity write or publish mutation |
| Reuse G5d.4 publish-shadow DTO as input | Become source of truth |

**Critical separation:** Week shadow is **provider-admin diagnostic only** — a separate code path from `app/api/week/route.ts` and `app/(app)/week/**`.

---

## 5. Proposed flag model (design only — not implemented)

```
LP_MENU_PROFILE_WEEK_SHADOW_READ
```

| Property | Value |
|----------|-------|
| Default | `false` / unset |
| Preview | May be ON for smoke only |
| Production | **OFF** (mandatory) |

**Proposed gate (future):**

```
isMenuProfileWeekShadowReadEnabled(env) =
  isMenuProfilePublishShadowEnabled(env)   // requires G5d.4d read path
  AND envFlagTruthy(LP_MENU_PROFILE_WEEK_SHADOW_READ)
```

| Rule | Rationale |
|------|-----------|
| Requires G5d.4 publish-shadow | Week shadow consumes publish-shadow DTO, not raw draft alone |
| Must not alter existing `/week` | Separate module + separate API route only |
| Must not make shadow orderable | No new choice keys in employee surfaces |
| Must not require Production flags | Default OFF everywhere until explicit cutover GO (G5d.6+) |
| Shadow output ≠ source of truth | DTO marked `shadowOnly: true`, `providerOnly: true` |

**Do not add this flag to Production** until a separate cutover GO (G5d.6 design — not authorized here).

---

## 6. Proposed architecture (future — not implemented here)

### 6.1 Server-only week shadow comparator

**Proposed path:** `lib/menu-profile/runtimeMappingWeekShadow.server.ts`

```
buildRuntimeMappingPublishShadowEvaluation(draft)     // G5d.4c (or via G5d.4d API internally)
  + read-only snapshot of current /week payload shape   // fixture or scoped provider read — NO employee route import
  → buildWeekShadowEvaluation(shadowDto, weekSnapshot)
  → return WeekShadowEvaluationDto
```

**Hard constraints:**

- `server-only` module
- No import of `app/api/week/route.ts` handler for mutation
- No import of `EmployeeWeekClient` or employee components
- No `requireSanityWrite`, no Sanity write client
- No `lp_order_set`, no `/api/orders/set` imports
- No `buildMenuDayPayload` for mutation — read-only comparison of **shape/hash** only
- No Supabase writes
- No calls that change `menuDayPayload` runtime

### 6.2 Possible API (future G5d.5d)

**Proposed path:** `app/api/provider/menu-profile/week-shadow/route.ts`

| Property | Value |
|----------|-------|
| Methods | GET (compare latest draft shadow vs current week snapshot for date range) |
| Auth | `provider_admin` only |
| Flag | `LP_MENU_PROFILE_WEEK_SHADOW_READ` OFF → 404 `NOT_FOUND` |
| Query | `menuProfileId`, optional `weekOffset` — **no** `providerId` from client |
| Response | `{ ok, rid, data: WeekShadowEvaluationDto }` |
| Side effects | **None** |
| Employee access | **Forbidden** — never called from `/week` UI or `/api/week` |

**This design PR does not create these files.**

### 6.3 Safe placement

Week shadow belongs in **new isolated modules** under `lib/menu-profile/` and **new provider API route** under `app/api/provider/menu-profile/`. It must not be wired into:

- `app/api/week/route.ts`
- `app/(app)/week/**`
- `EmployeeWeekClient.tsx`
- `app/api/orders/set/route.ts`
- `POST /api/provider/menu-days`

---

## 7. Proposed WeekShadowEvaluationDto

```typescript
type WeekShadowWouldAffectDay = {
  dateISO: string;
  weekdayKey: "mon" | "tue" | "wed" | "thu" | "fri";
  status: "unchanged" | "hypothetical_diff_only" | "blocked";
  notes: string[];
};

type WeekShadowEvaluationDto = {
  shadowOnly: true;                    // always true
  providerOnly: true;                  // always true — never employee-facing
  evaluatedAt: string;                 // ISO timestamp
  menuProfileId: string;
  sourceDraftId: string;
  sourceMappingVersion: string;

  currentWeekUnchanged: true;            // hard smoke assertion when PASS
  employeeVisibleChanges: 0;
  orderChanges: 0;
  weekResponseChanges: 0;
  priceVisibleChanges: 0;
  commercialVisibleChanges: 0;

  wouldAffectDays: WeekShadowWouldAffectDay[];

  blockedReasons: string[];            // e.g. week_shadow_no_employee_visibility

  comparison: {
    currentWeekPayloadHash: string;    // stable hash of canonical /week subset
    shadowWeekPayloadHash: string;     // hash of hypothetical shadow projection
    hashesEqual: true;                 // must be true for PASS in shadow-only mode
    notes: string[];
  };
};
```

**Forbidden DTO / request fields:**

- `employeePayload`, `orderPayload`, `menuDayPayloadMutation`
- `pricePreview`, `provider_price_rules`, `commission`, `provisjon`, `vat`, `mva`
- `apply`, `commit`, `publish`, `activate`, `enable`
- `providerId` in client-supplied body (server-resolved only if ever needed internally — not in response)

**Contract rules:**

- All `*Changes` counters must be literal `0` — not omitted.
- `currentWeekUnchanged: true` and `hashesEqual: true` are hard smoke assertions for G5d.5 shadow-only mode.
- No price/currency fields in DTO exposed to employees (DTO is provider-only).

---

## 8. Hard guardrails

Week shadow implementation (future) must **reject / forbid**:

| Forbidden | Detection |
|-----------|-----------|
| Alter `GET /api/week` response | Byte/hash diff test before/after shadow call |
| Alter `app/(app)/week` UI | week-visual + smoke |
| Alter employee-visible data | G5d.0 + week shadow DTO counters |
| Alter order choice keys | Golden Path + G5d.0 choice key contracts |
| Touch order write-path | No `lp_order_set` import; Golden Path |
| Touch `lp_order_advance_status` | Governance import guards |
| Expose price/commercial to employees | `assertEmployeeOrderBodyHasNoPricingOverrides` + grep |
| Import publish mutation helpers | Forbidden import scan |
| Import Sanity write clients | Forbidden import scan |
| Call menu-days write endpoints | Network smoke + governance |
| Write `menuDayPayload` | No `buildMenuDayPayload` mutation path |
| Write runtime tables | No INSERT/UPDATE/DELETE |
| Change auto-rollout | No `runMenuWeekRollout*` imports |
| Become source of truth | DTO review + `shadowOnly`/`providerOnly` locks |

**If any guardrail fails in implementation → hard stop, rollback Preview flag.**

---

## 9. Protected paths

G5d.5 implementation may **not** modify these without explicit separate GO and Protected Golden Path audit:

| Category | Paths |
|----------|-------|
| Week API | `app/api/week/route.ts` |
| Week UI | `app/(app)/week/**`, `EmployeeWeekClient.tsx` |
| Order window | `app/api/order/window/route.ts` |
| Order write | `app/api/orders/set/route.ts`, `lib/orders/rpcWrite.ts`, `lp_order_set` |
| Order status | `lp_order_advance_status`, provider production status flow |
| Payload | `lib/provider-menu/menuDayPayload.ts` |
| Menu-days API | `app/api/provider/menu-days/**` |
| Menu-catalog API | `app/api/provider/menu-catalog/**` |
| Publish sync | `lib/menu-publish/**` |
| Auto-rollout | `runMenuWeekRolloutCore.ts`, `generateWeekMenu.ts` |
| Sanity write | `lib/sanity/client.ts`, `lib/cms/sanityWriteClient.ts`, `menuCatalogWrite.ts` |
| Pricing runtime | `provider_price_rules`, `pricePreview` paths |
| Billing / Tripletex | billing APIs, `tripletexEngine.ts` |
| Employee commercial guards | `lib/orders/orderWriteGuard.ts` pricing assertions |
| G5d.4 API (behavior) | `app/api/provider/menu-profile/publish-shadow/route.ts` |
| Golden Path | `docs/PROTECTED_GOLDEN_PATH.md`, `tests/governance/protected-golden-path.test.ts` |
| Production env | All `LP_MENU_PROFILE_*` flags |

**Allowed new paths (future, with G5d.5b GO):**

- `lib/menu-profile/runtimeMappingWeekShadow.server.ts`
- `app/api/provider/menu-profile/week-shadow/route.ts`
- `tests/lib/menu-profile/runtimeMappingWeekShadow*.test.ts`
- `tests/governance/g5d5-*` contract tests
- `docs/engineering/G5d5*-smoke-evidence.md` (G5d.5e)

---

## 10. Tests required before implementation (G5d.5b plan)

| Test | Assert |
|------|--------|
| Flag default OFF | `isMenuProfileWeekShadowReadEnabled({}) === false` |
| No `/week` response change when flag OFF | Hash/structure of `GET /api/week` unchanged |
| No `/week` response change when flag ON | Same — shadow path must not hook week route |
| Employee UI unchanged | week-visual + smoke; no shadow strings in `/week` HTML |
| Order choice keys unchanged | Golden Path + G5d.0 `PLAN_ORDER_CHOICE_KEYS` |
| Order write-path unchanged | `lp_order_set` not called from week-shadow module |
| No Sanity write import | Governance scan |
| No publish mutation import | Governance scan |
| No `menuDayPayload` mutation | No `buildMenuDayPayload` in week-shadow files |
| No price/commercial in employee output | G5d.0 fixtures still green |
| DTO: `employeeVisibleChanges === 0` | Contract test |
| DTO: `orderChanges === 0` | Contract test |
| DTO: `weekResponseChanges === 0` | Contract test |
| DTO: `currentWeekUnchanged === true` | Contract test |
| Provider-only evidence | No employee route imports week-shadow helper |
| Protected path import guards | Week/order/week surfaces must not import week-shadow |
| Golden Path unchanged | `npm run test:golden-path` (91/91) |

Extend `tests/governance/g5d5-week-shadow-read-design-contracts.test.ts` in G5d.5b (or add runtime guards to `g5d0` when implementation lands).

---

## 11. Smoke plan (Preview-only, future G5d.5e)

1. Set Preview flags ON (Production **OFF**):
   - G5d.3 draft chain flags (if draft needed)
   - `LP_MENU_PROFILE_PUBLISH_SHADOW=true`
   - `LP_MENU_PROFILE_WEEK_SHADOW_READ=true`
2. Login Melhus `provider_admin`
3. Ensure mapping draft exists (G5d.3e)
4. Call `GET /api/provider/menu-profile/publish-shadow?menuProfileId=…` — verify G5d.4 invariants
5. Capture `GET /api/week?weekOffset=0` response hash **before** week-shadow call
6. Call future `GET /api/provider/menu-profile/week-shadow?menuProfileId=…&weekOffset=0`
7. Assert DTO: `shadowOnly: true`, `providerOnly: true`, all `*Changes` zeros, `currentWeekUnchanged: true`, `hashesEqual: true`
8. Capture `GET /api/week` hash **after** — must match before
9. Open `/week` as employee — no shadow data, no new choice keys, no pricing fields
10. Attempt order flow (Golden Path fixture date) — unchanged
11. Network: no Sanity writes, no menu-days POST, no `lp_order_set` from week-shadow call
12. Run Golden Path suite
13. Unset `LP_MENU_PROFILE_WEEK_SHADOW_READ` → redeploy Preview
14. Assert week-shadow endpoint 404; `/week` still unchanged

---

## 12. Rollback plan

### 12.1 Without deploy

1. Unset `LP_MENU_PROFILE_WEEK_SHADOW_READ` in Preview (and optionally `LP_MENU_PROFILE_PUBLISH_SHADOW`)
2. Redeploy Preview
3. Verify week-shadow endpoint 404 / hidden
4. Verify `GET /api/week` unchanged (hash match baseline)
5. Verify employee UI unchanged (week-visual)
6. **Do not** change Production flags

### 12.2 With deploy

| Problem | Action | Keep |
|---------|--------|------|
| Week-shadow API regression | Revert G5d.5d PR | G5d.4 publish-shadow if OK |
| Week-shadow helper regression | Revert G5d.5c PR | G5d.4c/d if OK |
| Governance regression | Revert G5d.5b PR | Prior docs |

**Never as routine rollback:**

- Drop `provider_menu_profile_runtime_mapping_drafts`
- Hard-delete drafts
- Modify `app/api/week/route.ts` as “fix”
- Enable Production flags

---

## 13. Failure modes

| Failure | Symptom | Safe behavior | Action |
|---------|---------|---------------|--------|
| Week shadow flag missing | Endpoint 404 | Fail-closed | Set Preview flag for smoke only |
| Shadow read imported by `/week` route | Governance fail / hash drift | **Hard stop** | Remove import; revert |
| `/week` response hash changes | Smoke fail | **Hard stop** | Rollback Preview flags |
| Employee UI changes | week-visual fail | **Hard stop** | Rollback |
| Order choice key changes | Golden Path fail | **Hard stop** | Rollback |
| Order write-path touched | Golden Path / governance fail | **Hard stop** | Rollback |
| Price/commercial in employee output | G5d.0 fail | **Hard stop** | Rollback |
| Sanity/publish import in week-shadow | Governance fail | **Hard stop** | Remove import |
| `menuDayPayload` mutation | Governance fail | **Hard stop** | Revert |
| Production flag enabled | Exposure risk | **Hard stop** | Unset immediately + incident |
| Shadow treated as source of truth | Product/regression | **Hard stop** | DTO review + revert |

---

## 14. Implementation phasing recommendation

| Phase | Deliverable | Type |
|-------|-------------|------|
| **G5d.5a** | This design audit | Docs ✅ (this PR) |
| **G5d.5b** | Contract / governance tests only | Tests — requires **explicit GO** |
| **G5d.5c** | Pure week shadow comparison helper | `lib/menu-profile/` — read-only |
| **G5d.5d** | Provider-only week-shadow API behind flag | `app/api/provider/menu-profile/week-shadow/` |
| **G5d.5e** | Preview smoke / rollback evidence | Docs |
| **G5d.6** | NO compatibility / runtime cutover design | Docs only — **not implementation** |

**Do not skip G5d.5b governance** before G5d.5c code.

**G5d.5 is not runtime cutover.** Even G5d.5d keeps employee `/week` and orders unchanged. Cutover (if ever approved) is a separate G5d.6+ program with its own audit and GO.

---

## 15. Explicit non-goals

G5d.5 design and future implementation do **not**:

- Serve shadow output to employees
- Change `/week` runtime response or UI
- Change orders or orderability
- Activate publish
- Write to Sanity
- Mutate `menuDayPayload`
- Touch billing or Tripletex
- Change `pricePreview` or `provider_price_rules` runtime
- Start runtime cutover
- Enable Production `LP_MENU_PROFILE_*` flags
- Start G5d.6 from this PR

---

## 16. Go / no-go

**Recommendation:** G5d.5 **implementation must not start** until this design audit is reviewed and merged.

| Gate | Requirement |
|------|-------------|
| G5d.5a | This document merged |
| G5d.5b | Explicit GO + governance tests |
| G5d.5c–5e | Each phase requires GO + CI + Golden Path |
| G5d.6 | Separate design GO — not authorized here |
| Production | All `LP_MENU_PROFILE_*` remain OFF |

**Do not interpret this document as authorization to implement week-shadow helper, API, or any `/week` change.**

---

## 17. Highest risks (planning notes)

| Risk | Mitigation |
|------|------------|
| Accidental import of week-shadow into `/api/week` | Separate module path; G5d.5b import guards on protected prefixes |
| Hash drift on `/week` from shared helper refactor | Shadow module must not export functions imported by week route |
| Order choice key leakage from profile mapping | Week shadow DTO has `orderChanges: 0`; compare uses hypothetical projection only |
| Employee pricing visibility regression | G5d.0 contracts + week-visual CI on every PR |
| Shadow confused with published menu | `shadowOnly` + `providerOnly` + separate API route only |
| Production flag accident | Default OFF; governance doc guards; fail-closed 404 |

---

## 18. References

| Artifact | Path |
|----------|------|
| G5d.4f evidence | `docs/engineering/G5d4f-publish-shadow-smoke-evidence.md` |
| G5d.4 design audit | `docs/engineering/G5d4-publish-shadow-design-audit.md` |
| Publish shadow helper | `lib/menu-profile/runtimeMappingPublishShadow.server.ts` |
| Publish shadow API | `app/api/provider/menu-profile/publish-shadow/route.ts` |
| Week API | `app/api/week/route.ts` |
| Week UI | `app/(app)/week/page.tsx`, `EmployeeWeekClient.tsx` |
| Order write | `app/api/orders/set/route.ts`, `lib/orders/rpcWrite.ts` |
| menuDayPayload | `lib/provider-menu/menuDayPayload.ts` |
| G5d.0 governance | `tests/governance/g5d0-menu-profile-runtime-contracts.test.ts` |
| G5d.4 governance | `tests/governance/g5d4-publish-shadow-contracts.test.ts` |
| Golden Path | `docs/PROTECTED_GOLDEN_PATH.md` |
