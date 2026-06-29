# G5d.6e — Compatibility cutover smoke and rollback evidence

**Status:** Evidence only — no runtime changes, no API changes, no UI changes, no DB/RLS changes, no Production flags  
**Date:** 2026-06-29  
**Prerequisite:** G5d.6a–G5d.6d merged on `main` (PR #374 merge `a58dc139`); Production `LP_MENU_PROFILE_*` OFF  
**Related:** `G5d6-compatibility-cutover-design-audit.md`, `G5d5e-week-shadow-smoke-evidence.md`, `tests/governance/g5d6-compatibility-cutover-contracts.test.ts`, `PROTECTED_GOLDEN_PATH.md`

---

## 1. Scope

This document locks **operational safety evidence** for the G5d.6 compatibility-cutover chain (G5d.6c–G5d.6d). It is **not** a feature delivery.

| In scope | Out of scope |
|----------|--------------|
| Preview smoke evidence | New functionality |
| Rollback plan | Runtime cutover |
| Flag matrix | `/week` runtime integration |
| Production OFF evidence | Employee visibility |
| Pre-G5d.7 checklist | Order integration |
| Failure modes | Publish activation |
| Go/no-go recommendation | Sanity write |
| | `menuDayPayload` mutation |
| | Source-of-truth switch |
| | Auto-rollout |
| | Production activation |
| | G5d.7 implementation |

**Hard rules:**

- G5d.7 requires explicit GO. This document does **not** authorize G5d.7 implementation.
- Runtime cutover has **not** started.
- Source-of-truth switch has **not** started.
- Auto-rollout has **not** started.
- Do **not** enable Production `LP_MENU_PROFILE_*` flags.
- G5d.6e is evidence only — no runtime source changes.

---

## 2. Delivered chain

| Phase | PR | Merge SHA | Delivers |
|-------|-----|-----------|----------|
| **G5d.6a** | [#371](https://github.com/Lunchportalen/lunchportalen/pull/371) | `f5521f42` | Compatibility cutover design audit |
| **G5d.6b** | [#372](https://github.com/Lunchportalen/lunchportalen/pull/372) | `e2fceca4` | Contract/governance tests + inert `isMenuProfileCompatibilityCutoverEnabled()` |
| **G5d.6c** | [#373](https://github.com/Lunchportalen/lunchportalen/pull/373) | `6aef18b3` | Pure `buildCompatibilityCutoverEvaluation` helper (server-only, no I/O writes) |
| **G5d.6d** | [#374](https://github.com/Lunchportalen/lunchportalen/pull/374) | `a58dc139` | Read-only GET `/api/provider/menu-profile/compatibility-cutover` behind `LP_MENU_PROFILE_COMPATIBILITY_CUTOVER` |
| **G5d.6e** | (this PR) | — | Preview smoke + rollback evidence (this document) |

**Not delivered (by design):**

- G5d.7 runtime hook / cutover implementation
- Employee `/week` integration
- Provider UI for compatibility cutover
- Publish / order / week / Sanity wiring
- Production flags
- Source-of-truth switch
- Auto-rollout

---

## 3. Flag matrix

`LP_MENU_PROFILE_COMPATIBILITY_CUTOVER` accepts exact `"true"` only (`"1"` = OFF; no `.trim()` — value must be exact). Other G5d draft-chain flags accept `"true"` or `"1"` via `.trim()`.

| Flag | Default | Preview smoke (2026-06-29) | Production | Purpose | Rollback action |
|------|---------|------------------------------|------------|---------|-----------------|
| `LP_MENU_PROFILE_COMPATIBILITY_CUTOVER` | OFF | ON **during smoke only** (then unset) | **OFF** | G5d.6d compatibility-cutover API gate | Unset in Preview; redeploy Preview |
| `LP_MENU_PROFILE_WEEK_SHADOW_READ` | OFF | OFF (not required — route composes G5d.5c helper inline) | **OFF** | G5d.5d week-shadow API (separate route) | N/A for G5d.6e smoke |
| `LP_MENU_PROFILE_PUBLISH_SHADOW` | OFF | OFF (not required — route composes G5d.4c helper inline) | **OFF** | G5d.4d publish-shadow API (separate route) | N/A for G5d.6e smoke |
| `LP_MENU_PROFILE_MAPPING_DRAFT_API` | OFF | ON (draft chain) | **OFF** | G5d.3d draft read | Unset in Preview (optional after smoke) |
| `LP_MENU_PROFILE_RUNTIME_MAPPING_PROPOSAL` | OFF | ON (draft chain) | **OFF** | G5d.2 mapping proposal panel | Unset in Preview (optional after smoke) |
| `LP_MENU_PROFILE_RESOLVER` | OFF | ON (draft chain) | **OFF** | G5a resolver — base gate | Unset in Preview (optional after smoke) |

**Draft prerequisite for compatibility-cutover smoke:** Latest non-archived draft must exist. G5d.3e save flow (or prior G5d.3f smoke) satisfies this in Preview.

**Publish-shadow / week-shadow flags:** Not technically required for G5d.6d smoke. The compatibility-cutover route builds publish-shadow and week-shadow evidence **inline** via `buildRuntimeMappingPublishShadowEvaluation` and `buildRuntimeMappingWeekShadowEvaluation` — no HTTP self-call, no separate shadow API flags, no `/week` import.

**Production:** Verified via `vercel env ls production` — **no `LP_MENU_PROFILE_*` variables** (2026-06-29).

**Preview smoke flag sequence:**

1. Set `LP_MENU_PROFILE_COMPATIBILITY_CUTOVER=true` in Preview only (exact `"true"` — draft-chain flags already ON from prior G5d.3 smoke).
2. Redeploy Preview.
3. Run smoke (Melhus `provider_admin`).
4. Unset `LP_MENU_PROFILE_COMPATIBILITY_CUTOVER` in Preview.
5. Redeploy Preview.
6. Verify endpoint fail-closed (404 `NOT_FOUND` before auth/DB — API unit test contract + authenticated Preview probe; see §4.3).

**Do not mutate Production flags** as part of G5d.6 rollback.

---

## 4. Preview smoke evidence

### 4.1 Context

| Item | Value |
|------|-------|
| Provider | Melhus Catering AS / NO |
| Role | `provider_admin` (`post@melhuscatering.no`) |
| Route | `GET /api/provider/menu-profile/compatibility-cutover?menuProfileId=norwegian_company_lunch` |
| Preview URL (smoke) | `https://lunchportalen-ide8j0lvb-lunchportalen.vercel.app` |
| Redeploy source | G5d.6d Preview deployment @ `a58dc139` with `LP_MENU_PROFILE_COMPATIBILITY_CUTOVER=true` |
| Flags ON (Preview only) | `LP_MENU_PROFILE_RESOLVER`, `LP_MENU_PROFILE_RUNTIME_MAPPING_PROPOSAL`, `LP_MENU_PROFILE_MAPPING_DRAFT_API`, `LP_MENU_PROFILE_COMPATIBILITY_CUTOVER` |
| Flags OFF (not required) | `LP_MENU_PROFILE_PUBLISH_SHADOW`, `LP_MENU_PROFILE_WEEK_SHADOW_READ` |
| Smoke script (local temp) | `scripts/temp-g5d6e-preview-smoke.mjs` — not committed; repeatable with `.env.local` credentials |

### 4.2 Smoke steps — result

| # | Step | Expected | Result |
|---|------|----------|--------|
| 1 | Production flags OFF | No `LP_MENU_PROFILE_*` in Production | **PASS** (`vercel env ls production` — no matches) |
| 2 | Preview has `LP_MENU_PROFILE_COMPATIBILITY_CUTOVER=true` | Exact `"true"` + redeploy before smoke | **PASS** (node stdin — no CRLF; see §9 note) |
| 3 | Draft-chain flags in Preview | Resolver + proposal + draft API ON | **PASS** (pre-existing from G5d.3 smoke) |
| 4 | Login `provider_admin` | Reach provider workspace | **PASS** |
| 5 | Ensure latest draft | G5d.3e save or existing draft | **PASS** |
| 6 | GET compatibility-cutover | HTTP 200 | **PASS** |
| 7 | Response contract | `{ ok, rid, data: { compatibilityCutover, source, meta } }` | **PASS** |
| 7 | `compatibilityCutover.compatibilityOnly=true` | Always true | **PASS** |
| 7 | `compatibilityCutover.providerOnly=true` | Always true | **PASS** |
| 7 | `compatibilityCutover.currentNoRuntimeUnchanged=true` | Documented boolean | **PASS** |
| 7 | All impact counters | `0` | **PASS** (`weekResponseChanges`, `employeeVisibleChanges`, `orderChanges`, `publishChanges`, `sanityWrites`, `menuDayPayloadMutations`, `priceVisibleChanges`, `commercialVisibleChanges`) |
| 7 | `canProceedToRuntimeHook=false` | Always false | **PASS** |
| 7 | `canProceedToProduction=false` | Always false | **PASS** |
| 7 | `meta.productionFlagEnabled=false` | Always false | **PASS** |
| 7 | `meta.compatibilityOnly=true` / `meta.providerOnly=true` | Always true | **PASS** |
| 7 | `source.draftId` | UUID present | **PASS** (`4dc13dd3-6d4d-4b2a-883b-9550aca308d5`) |
| 7 | `source.menuProfileId` | `norwegian_company_lunch` | **PASS** |
| 7 | `source.mappingVersion` | `g5d.1` | **PASS** |
| 8 | No forbidden fields | No `providerId`, payloads, activation words | **PASS** |
| 9 | Network during cutover GET only | No publish / Sanity / order / `/week` calls | **PASS** |
| 10 | `/week` unchanged | No cutover leakage to employee surfaces | **PASS** (employee UI text check; see note below) |
| 11 | Golden Path | 91/91 | **PASS** (local `npm run test:golden-path` on `main`) |
| 12 | Unset `LP_MENU_PROFILE_COMPATIBILITY_CUTOVER` | Removed from Preview env | **PASS** (2026-06-29) |
| 13 | Redeploy Preview | New deployment without flag | **PASS** (`lunchportalen-4mcmw1kfn-lunchportalen.vercel.app`) |
| 14 | Endpoint disabled | 404 `NOT_FOUND` before auth/DB | **PASS** (authenticated Preview probe + API unit test — §4.3) |
| 15 | No DB writes from cutover call | Read-only SELECT only | **PASS** (route + governance) |
| 16 | Production flags still OFF | No Production env change | **PASS** |

**Sample response RID (Preview smoke):** `prov_compat_cutover_mqz8wb2i_iz9id717z1zt87fo`

**Sample `blockedReasons` (base guardrails):**

- `compatibility_only_no_runtime_cutover`
- `compatibility_only_no_production_activation`
- `compatibility_only_no_source_of_truth_switch`
- `compatibility_only_no_auto_rollout`
- `compatibility_only_no_employee_visibility`
- `compatibility_only_no_order_changes`
- `compatibility_only_no_publish_mutation`
- `compatibility_only_no_sanity_writes`
- `compatibility_only_no_menu_day_payload_mutation`

**Note on sequential `/api/week` hash comparison:** Two explicit `/api/week` reads before/after compatibility-cutover may differ on time-bound fields (cutoff, timestamps). This is **not** evidence of compatibility-cutover mutation. The compatibility-cutover GET itself triggered **zero** forbidden network calls. Employee `/week` page text showed no cutover/shadow references.

### 4.3 CI evidence (G5d.6d merge)

Merge SHA `a58dc139` — all required checks **PASS** on `main`:

- CI, CI Enterprise, CI E2E, CI (AGENTS gate), suspend-rpc-authz
- provider-meny-visual, week-visual
- Golden Path **91/91**

**PR #374 automated smoke evidence (pre-merge):**

- Flag OFF → 404 before auth/DB/helper (no auth mock called)
- `provider_admin` auth matrix; `provider_viewer` → 403; `providerId` query → 400
- No draft → safe 200 with `compatibilityCutover: null`
- Success path → full DTO contract; forbidden output fields absent
- Route static scan — no `.insert`/`.update`/`.delete`/`.upsert`; no Sanity/order/publish/`/week` imports

**Rollback 404 probe (authenticated, flag OFF):** HTTP 404, `error: NOT_FOUND`, `rid: prov_compat_cutover_mqz947gx_2nly99mnxsx49j28` on `lunchportalen-4mcmw1kfn-lunchportalen.vercel.app`.

---

## 5. No-write evidence

| Check | Evidence |
|-------|----------|
| Route has no DB mutations | `compatibility-cutover/route.ts` — no `.insert`, `.update`, `.delete`, `.upsert` (governance scan) |
| No Sanity client import | Forbidden import scan PASS on route + helpers |
| No publish mutation import | No `menu-publish`, `syncMenuServiceDay*`, `runMenuWeekRollout*` imports |
| No order import | No `lp_order_set`, `/api/orders` imports |
| No `/week` / menuDayPayload mutation | No `buildMenuDayPayload` import; week surfaces have no compatibility-cutover refs |
| Only draft read | `readLatestRuntimeMappingDraft` (SELECT) |
| Governance tests | `tests/governance/g5d6-compatibility-cutover-contracts.test.ts` — PASS |
| API tests | `tests/api/provider/menu-profile-compatibility-cutover-api.test.ts` — PASS |
| Helper unit tests | `tests/lib/menu-profile/runtimeCompatibilityCutover.test.ts` — 36 tests PASS |
| Golden Path | `npm run test:golden-path` — **91/91** |

---

## 6. Runtime separation evidence

| Surface | Evidence |
|---------|----------|
| `app/api/week` | No `compatibility-cutover` / `runtimeCompatibilityCutover` refs (grep + governance) |
| `app/(app)/week` | No compatibility-cutover refs |
| `lib/week` | No compatibility-cutover refs |
| Employee UI | No compatibility-cutover refs on `/week` (Preview smoke) |
| Provider UI | No `runtimeCompatibilityCutover` imports (governance) |
| Order runtime | No compatibility-cutover refs |
| `menuDayPayload` | No compatibility-cutover refs |
| Public/customer pages | No compatibility-cutover refs |
| Helper import scope | `runtimeCompatibilityCutover` only in canonical route + tests/governance/fixtures |

Compatibility-cutover API is **provider_admin only** and **not callable from employee `/week` UI**.

---

## 7. Production OFF evidence

| Check | Evidence |
|-------|----------|
| No Production env flags | `vercel env ls production` → no `LP_MENU_PROFILE_*` (2026-06-29) |
| `LP_MENU_PROFILE_COMPATIBILITY_CUTOVER` not in Production | Confirmed absent from Production env list |
| API default OFF | `isMenuProfileCompatibilityCutoverEnabled({}) === false` |
| Endpoint unavailable when flag OFF | Unit test: GET returns 404 `NOT_FOUND`; auth/DB/helper **not called** when flag OFF |
| Production runtime unaffected | `/week`, order, publish, Sanity paths unchanged |
| No Production deploy of Preview flags | Smoke flags Preview-only; `LP_MENU_PROFILE_COMPATIBILITY_CUTOVER` removed after evidence capture |
| No committed config enables flag | Governance: no repo env/config sets `LP_MENU_PROFILE_COMPATIBILITY_CUTOVER=true` |

---

## 8. Rollback plan

### 8.1 Rollback without deploy (Preview flags)

1. Unset `LP_MENU_PROFILE_COMPATIBILITY_CUTOVER` in Preview (keep or unset G5d.3 draft-chain flags separately).
2. Redeploy Preview.
3. Verify:
   - GET `/api/provider/menu-profile/compatibility-cutover?menuProfileId=…` → 404 `NOT_FOUND` (unit test contract; flag check before auth/DB).
   - No compatibility-cutover UI (not implemented — none expected).
   - No new DB writes from compatibility-cutover API (endpoint inert when flag OFF).
   - `/week` and employee UI unchanged.
   - No source-of-truth switch.
   - No auto-rollout.
4. **Do not** change Production env vars.

**Executed 2026-06-29:** `LP_MENU_PROFILE_COMPATIBILITY_CUTOVER` removed from Preview; Preview redeployed to `lunchportalen-4mcmw1kfn-lunchportalen.vercel.app`; authenticated probe → 404 `NOT_FOUND`.

**Preview flag hygiene note:** On Windows, pipe/`echo` may inject `\r\n` or trailing space. `LP_MENU_PROFILE_COMPATIBILITY_CUTOVER` requires exact `"true"`. Use node stdin (`spawnSync('vercel', …, { input: 'true' })`) when setting Preview flags for smoke.

### 8.2 Rollback with deploy (code revert)

| Problem | Action | Keep |
|---------|--------|------|
| Compatibility-cutover API regression (G5d.6d) | Revert PR #374 (`a58dc139`) | G5d.6c helper if OK; G5d.3 chain; draft table |
| Compatibility helper regression (G5d.6c) | Revert PR #373 (`6aef18b3`) | G5d.3 chain; G5d.4/G5d.5 shadow routes/helpers if OK |
| Contract/governance regression (G5d.6b) | Revert PR #372 (`e2fceca4`) | Prior docs |

**DB / RLS:**

- **Do not drop** `provider_menu_profile_runtime_mapping_drafts` as routine rollback.
- **Do not hard-delete** draft rows — use archive API only.
- Table/RLS from G5d.3b remains regardless of G5d.6 rollback.

**Production flags:** Never enable as rollback step. Accidental Production enablement → **hard stop** → unset immediately → incident note.

---

## 9. Failure modes

| Failure | Symptom | Safe behavior | Action |
|---------|---------|---------------|--------|
| Compatibility flag missing | Endpoint 404 | Fail-closed before auth/DB | Set Preview flag for smoke only (exact `"true"`) |
| Flag value malformed (`true\r\n`, `true `) | Endpoint 404 | Fail-closed — strict `=== "true"` | Fix Preview env value; redeploy |
| No draft | `{ compatibilityCutover: null, source: null, meta }` 200 | Safe null response | Save draft via G5d.3e first |
| Invalid draft/evaluation | 400 `VALIDATION_FAILED` | G5d.3c / helper rejection | Fix draft; no evaluation write |
| `provider_viewer` calls endpoint | 403 `FORBIDDEN` | Admin-only | Expected — no action |
| `providerId` query supplied | 400 `BAD_REQUEST` | Server provider scope only | Expected — no action |
| `/api/week` call during cutover GET | Smoke fail | **Hard stop** | Roll back Preview flags; investigate coupling |
| `/week` response changes from cutover | Smoke / week-visual fail | **Hard stop** | Roll back; no Production deploy |
| Employee UI sees cutover data | Smoke / week-visual fail | **Hard stop** | Roll back |
| Order call during cutover GET | Smoke fail | **Hard stop** | Roll back |
| Publish/Sanity call detected | Smoke fail | **Hard stop** | Roll back |
| `menuDayPayload` mutation detected | Governance fail | **Hard stop** | Revert |
| Source-of-truth switch detected | Governance / smoke fail | **Hard stop** | Revert |
| Auto-rollout detected | Governance fail | **Hard stop** | Revert |
| Price/commercial data appears | Smoke / governance fail | **Hard stop** | DTO review + revert |
| Production flag enabled | Exposure risk | **Hard stop** | Unset Production flag immediately + incident |
| Candidate output treated as orderable/source of truth | Product/regression | **Hard stop** | DTO review + revert |

---

## 10. Pre-G5d.7 checklist

Before **G5d.7 design/planning** (not execution):

- [ ] G5d.6e evidence doc merged
- [ ] Preview smoke repeatable (Melhus / NO `provider_admin`)
- [ ] Endpoint disabled when flag OFF (404 before auth/DB — unit test + Preview env unset)
- [ ] Production flags **OFF** verified
- [ ] Golden Path PASS (91/91)
- [ ] provider-meny-visual PASS
- [ ] week-visual PASS
- [ ] `/week` unchanged
- [ ] Employee UI unchanged
- [ ] Order unchanged
- [ ] No publish / order / week / Sanity coupling in G5d.6 chain
- [ ] No runtime writes from compatibility-cutover path
- [ ] No Sanity writes
- [ ] No `menuDayPayload` mutation
- [ ] No employee visibility
- [ ] No source-of-truth switch
- [ ] No auto-rollout
- [ ] G5d.7 design requires **explicit GO** (separate decision)

---

## 11. Non-goals

G5d.6e and the G5d.6 chain do **not**:

- Start runtime cutover
- Change `/week` runtime response or UI
- Integrate orders
- Expose compatibility evidence to employees
- Write to Sanity
- Mutate `menuDayPayload`
- Touch billing or Tripletex
- Change `pricePreview` or `provider_price_rules` runtime
- Activate Production `LP_MENU_PROFILE_*` flags
- Start G5d.7 implementation
- Start source-of-truth switch
- Start auto-rollout

---

## 12. Go/no-go recommendation

**Recommendation:** The G5d.6 chain (G5d.6a–G5d.6d) is **operationally ready for G5d.7 design/planning only** after this evidence document is reviewed and merged.

**G5d.7 implementation** must not start from this PR. G5d.7 requires explicit GO.

**Runtime cutover**, **source-of-truth switch**, and **Production activation** require separate final GO decisions.

**Do not interpret this document as authorization to implement G5d.7 or enable Production flags.**

---

## 13. References

| Artifact | Path / link |
|----------|-------------|
| G5d.6 design audit | `docs/engineering/G5d6-compatibility-cutover-design-audit.md` |
| G5d.5e evidence | `docs/engineering/G5d5e-week-shadow-smoke-evidence.md` |
| G5d.4f evidence | `docs/engineering/G5d4f-publish-shadow-smoke-evidence.md` |
| Feature flags | `lib/menu-profile/featureFlag.ts` |
| Compatibility helper | `lib/menu-profile/runtimeCompatibilityCutover.server.ts` |
| Compatibility API | `app/api/provider/menu-profile/compatibility-cutover/route.ts` |
| Publish shadow helper | `lib/menu-profile/runtimeMappingPublishShadow.server.ts` |
| Week shadow helper | `lib/menu-profile/runtimeMappingWeekShadow.server.ts` |
| Draft API | `app/api/provider/menu-profile/mapping-draft/route.ts` |
| API tests | `tests/api/provider/menu-profile-compatibility-cutover-api.test.ts` |
| Helper tests | `tests/lib/menu-profile/runtimeCompatibilityCutover.test.ts` |
| Governance | `tests/governance/g5d6-compatibility-cutover-contracts.test.ts` |
| Golden Path | `npm run test:golden-path` |
