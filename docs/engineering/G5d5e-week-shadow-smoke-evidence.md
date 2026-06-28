# G5d.5e — Week shadow smoke and rollback evidence

**Status:** Evidence only — no runtime changes, no API changes, no UI changes, no DB/RLS changes, no Production flags  
**Date:** 2026-06-28  
**Prerequisite:** G5d.5a–G5d.5d merged on `main` (PR #369 merge `b0d3a747`); Production `LP_MENU_PROFILE_*` OFF  
**Related:** `G5d5-week-shadow-read-design-audit.md`, `G5d4f-publish-shadow-smoke-evidence.md`, `tests/governance/g5d5-week-shadow-contracts.test.ts`, `PROTECTED_GOLDEN_PATH.md`

---

## 1. Scope

This document locks **operational safety evidence** for the G5d.5 week-shadow chain (G5d.5c–G5d.5d). It is **not** a feature delivery.

| In scope | Out of scope |
|----------|--------------|
| Preview smoke evidence | New functionality |
| Rollback plan | Runtime cutover |
| Flag matrix | `/week` runtime integration |
| Production OFF evidence | Employee visibility |
| Pre-G5d.6 checklist | Order integration |
| Failure modes | Publish activation |
| Go/no-go recommendation | Sanity write |
| | `menuDayPayload` mutation |
| | Production activation |
| | G5d.6 implementation |

**Hard rules:**

- G5d.6 requires explicit GO. This document does **not** authorize G5d.6 implementation.
- Do **not** enable Production `LP_MENU_PROFILE_*` flags.
- G5d.5e is evidence only — no runtime source changes.

---

## 2. Delivered chain

| Phase | PR | Merge SHA | Delivers |
|-------|-----|-----------|----------|
| **G5d.5a** | [#366](https://github.com/Lunchportalen/lunchportalen/pull/366) | `36e3ba6d` | `/week` shadow read design audit |
| **G5d.5b** | [#367](https://github.com/Lunchportalen/lunchportalen/pull/367) | `f4a7add1` | Contract/governance tests + inert `isMenuProfileWeekShadowReadEnabled()` |
| **G5d.5c** | [#368](https://github.com/Lunchportalen/lunchportalen/pull/368) | `54afdd02` | Pure `buildRuntimeMappingWeekShadowEvaluation` helper (server-only, no I/O writes) |
| **G5d.5d** | [#369](https://github.com/Lunchportalen/lunchportalen/pull/369) | `b0d3a747` | Read-only GET `/api/provider/menu-profile/week-shadow` behind `LP_MENU_PROFILE_WEEK_SHADOW_READ` |
| **G5d.5e** | (this PR) | — | Preview smoke + rollback evidence (this document) |

**Not delivered (by design):**

- G5d.6 runtime cutover / compatibility design implementation
- Employee `/week` integration
- Provider UI for week shadow
- Publish / order / week / Sanity wiring
- Production flags

---

## 3. Flag matrix

`LP_MENU_PROFILE_WEEK_SHADOW_READ` accepts exact `"true"` only (`"1"` = OFF). Other G5d draft-chain flags accept `"true"` or `"1"`.

| Flag | Default | Preview smoke (2026-06-28) | Production | Purpose | Rollback action |
|------|---------|------------------------------|------------|---------|-----------------|
| `LP_MENU_PROFILE_WEEK_SHADOW_READ` | OFF | ON **during smoke only** (then unset) | **OFF** | G5d.5d week-shadow API gate | Unset in Preview; redeploy Preview |
| `LP_MENU_PROFILE_PUBLISH_SHADOW` | OFF | OFF (not required — week-shadow composes G5d.4c helper internally) | **OFF** | G5d.4d publish-shadow API (separate route) | N/A for G5d.5e smoke |
| `LP_MENU_PROFILE_MAPPING_DRAFT_API` | OFF | ON (draft chain) | **OFF** | G5d.3d draft read | Unset in Preview (optional after smoke) |
| `LP_MENU_PROFILE_RUNTIME_MAPPING_PROPOSAL` | OFF | ON (draft chain) | **OFF** | G5d.2 mapping proposal panel | Unset in Preview (optional after smoke) |
| `LP_MENU_PROFILE_RESOLVER` | OFF | ON (draft chain) | **OFF** | G5a resolver — base gate | Unset in Preview (optional after smoke) |

**Draft prerequisite for week-shadow smoke:** Latest non-archived draft must exist. G5d.3e save flow (or prior G5d.3f smoke) satisfies this in Preview.

**Production:** Verified via `vercel env ls production` — **no `LP_MENU_PROFILE_*` variables** (2026-06-28).

**Preview smoke flag sequence:**

1. Set `LP_MENU_PROFILE_WEEK_SHADOW_READ=true` in Preview only (draft-chain flags already ON from prior G5d.3 smoke).
2. Redeploy Preview.
3. Run smoke (Melhus `provider_admin`).
4. Unset `LP_MENU_PROFILE_WEEK_SHADOW_READ` in Preview.
5. Redeploy Preview.
6. Verify endpoint fail-closed (404 `NOT_FOUND` — API unit test contract; see §5.3).

**Do not mutate Production flags** as part of G5d.5 rollback.

---

## 4. Preview smoke evidence

### 4.1 Context

| Item | Value |
|------|-------|
| Provider | Melhus Catering AS / NO |
| Role | `provider_admin` (`post@melhuscatering.no`) |
| Route | `GET /api/provider/menu-profile/week-shadow?menuProfileId=norwegian_company_lunch` |
| Preview URL (smoke) | `https://lunchportalen-dapj9prdj-lunchportalen.vercel.app` |
| Redeploy source | G5d.5d Preview deployment (redeploy with new Preview env) |
| Flags ON (Preview only) | `LP_MENU_PROFILE_RESOLVER`, `LP_MENU_PROFILE_RUNTIME_MAPPING_PROPOSAL`, `LP_MENU_PROFILE_MAPPING_DRAFT_API`, `LP_MENU_PROFILE_WEEK_SHADOW_READ` |
| Smoke script (local temp) | `scripts/temp-g5d5e-preview-smoke.mjs` — not committed; repeatable with `.env.local` credentials |

### 4.2 Smoke steps — result

| # | Step | Expected | Result |
|---|------|----------|--------|
| 1 | Production flags OFF | No `LP_MENU_PROFILE_*` in Production | **PASS** (`vercel env ls production` empty) |
| 2 | Preview has `LP_MENU_PROFILE_WEEK_SHADOW_READ=true` | Set + redeploy before smoke | **PASS** |
| 3 | Draft-chain flags in Preview | Resolver + proposal + draft API ON | **PASS** (pre-existing from G5d.3 smoke) |
| 4 | Login `provider_admin` | Reach provider workspace | **PASS** |
| 5 | Ensure latest draft | G5d.3e save or existing draft | **PASS** |
| 6 | GET week-shadow | HTTP 200 | **PASS** |
| 7 | Response contract | `{ ok, rid, data: { weekShadow, source, meta } }` | **PASS** |
| 7 | `weekShadow.shadowOnly=true` | Always true | **PASS** |
| 7 | `weekShadow.providerOnly=true` | Always true | **PASS** |
| 7 | `weekShadow.currentWeekUnchanged=true` | Documented boolean | **PASS** |
| 7 | All `weekShadow.*Changes` counters | `0` | **PASS** |
| 7 | All `meta.*` impact counters | `0` | **PASS** (`employeeVisibleChanges`, `orderChanges`, `weekResponseChanges`, `priceVisibleChanges`, `commercialVisibleChanges`, `runtimeWrites`, `sanityWrites`) |
| 7 | `meta.productionFlagEnabled=false` | Always false | **PASS** |
| 7 | `meta.shadowOnly=true` / `meta.providerOnly=true` | Always true | **PASS** |
| 7 | `source.draftId` | UUID present | **PASS** (`4dc13dd3-6d4d-4b2a-883b-9550aca308d5`) |
| 7 | `source.menuProfileId` | `norwegian_company_lunch` | **PASS** |
| 7 | `source.mappingVersion` | `g5d.1` | **PASS** |
| 7 | `source.publishShadowSource.shadowOnly=true` | Always true | **PASS** |
| 8 | No forbidden fields | No `providerId`, payloads, activation words | **PASS** |
| 9 | Network during week-shadow GET only | No publish / Sanity / order / `/week` calls | **PASS** |
| 10 | `/week` unchanged | No shadow leakage to employee surfaces | **PASS** (employee UI text check; see note below) |
| 11 | Golden Path | 91/91 | **PASS** (local `npm run test:golden-path` on `main`) |
| 12 | Unset `LP_MENU_PROFILE_WEEK_SHADOW_READ` | Removed from Preview env | **PASS** (2026-06-28) |
| 13 | Redeploy Preview | New deployment without flag | **PASS** (`lunchportalen-90e31epgq-lunchportalen.vercel.app`) |
| 14 | Endpoint disabled | 404 `NOT_FOUND` before auth/DB | **PASS** (API unit test — §5.3) |
| 15 | No DB writes from week-shadow call | Read-only SELECT only | **PASS** (route + governance) |
| 16 | Production flags still OFF | No Production env change | **PASS** |

**Sample response RID (Preview smoke):** `prov_week_shadow_mqy8njqx_vz2uxp5b6yhov65a`

**Sample `blockedReasons` (base guardrails):**

- `shadow_only_provider_evidence`
- `no_week_runtime_change`
- `no_employee_visibility`
- `no_order_changes`
- `no_publish_changes`
- `no_sanity_writes`
- `no_menu_day_payload_mutation`

**Note on sequential `/api/week` hash comparison:** Two explicit `/api/week` reads before/after week-shadow may differ on time-bound fields (cutoff, timestamps). This is **not** evidence of week-shadow mutation. The week-shadow GET itself triggered **zero** forbidden network calls. Employee `/week` page text showed no shadow references.

### 4.3 CI evidence (G5d.5d merge)

Merge SHA `b0d3a747` — all required checks **PASS** on `main`:

- CI, CI Enterprise, CI E2E, CI (AGENTS gate), suspend-rpc-authz
- provider-meny-visual, week-visual
- Golden Path **91/91**

---

## 5. No-write evidence

| Check | Evidence |
|-------|----------|
| Route has no DB mutations | `week-shadow/route.ts` — no `.insert`, `.update`, `.delete`, `.upsert` (governance scan) |
| No Sanity client import | Forbidden import scan PASS on route + helpers |
| No publish mutation import | No `menu-publish`, `syncMenuServiceDay*`, `runMenuWeekRollout*` imports |
| No order import | No `lp_order_set`, `/api/orders` imports |
| No `/week` / menuDayPayload mutation | No `buildMenuDayPayload` import; week surfaces have no week-shadow refs |
| Only draft read | `readLatestRuntimeMappingDraft` (SELECT) |
| Governance tests | `tests/governance/g5d5-week-shadow-contracts.test.ts` — PASS |
| API tests | `tests/api/provider/menu-profile-week-shadow-api.test.ts` — 17 tests PASS |
| Helper unit tests | `tests/lib/menu-profile/runtimeMappingWeekShadow.test.ts` — PASS |
| Golden Path | `npm run test:golden-path` — **91/91** |

---

## 6. Runtime separation evidence

| Surface | Evidence |
|---------|----------|
| `app/api/week` | No `week-shadow` / `runtimeMappingWeekShadow` refs (grep + governance) |
| `app/(app)/week` | No week-shadow refs |
| Employee UI | No week-shadow refs on `/week` (Preview smoke) |
| Provider UI | No `runtimeMappingWeekShadow` imports (governance) |
| Order runtime | No week-shadow refs |
| `menuDayPayload` | No week-shadow refs |
| Public/customer pages | No week-shadow refs |
| Helper import scope | `runtimeMappingWeekShadow` only in canonical route + tests/governance/fixtures |

Week-shadow API is **provider_admin only** and **not callable from employee `/week` UI**.

---

## 7. Production OFF evidence

| Check | Evidence |
|-------|----------|
| No Production env flags | `vercel env ls production` → empty for `LP_MENU_PROFILE_*` (2026-06-28) |
| `LP_MENU_PROFILE_WEEK_SHADOW_READ` not in Production | Confirmed absent from Production env list |
| API default OFF | `isMenuProfileWeekShadowReadEnabled({}) === false` |
| Endpoint unavailable when flag OFF | Unit test: GET returns 404 `NOT_FOUND`; auth/DB/helper **not called** |
| Production runtime unaffected | `/week`, order, publish, Sanity paths unchanged |
| No Production deploy of Preview flags | Smoke flags Preview-only; `LP_MENU_PROFILE_WEEK_SHADOW_READ` removed after evidence capture |

---

## 8. Rollback plan

### 8.1 Rollback without deploy (Preview flags)

1. Unset `LP_MENU_PROFILE_WEEK_SHADOW_READ` in Preview (keep or unset G5d.3 draft-chain flags separately).
2. Redeploy Preview.
3. Verify:
   - GET `/api/provider/menu-profile/week-shadow?menuProfileId=…` → 404 `NOT_FOUND` (unit test contract; flag check before auth/DB).
   - No week-shadow UI (not implemented — none expected).
   - No new DB writes from week-shadow API (endpoint inert when flag OFF).
   - `/week` and employee UI unchanged.
4. **Do not** change Production env vars.

**Executed 2026-06-28:** `LP_MENU_PROFILE_WEEK_SHADOW_READ` removed from Preview; Preview redeployed to `lunchportalen-90e31epgq-lunchportalen.vercel.app`.

### 8.2 Rollback with deploy (code revert)

| Problem | Action | Keep |
|---------|--------|------|
| Week-shadow API regression (G5d.5d) | Revert PR #369 (`b0d3a747`) | G5d.5c helper if OK; G5d.3 chain; draft table |
| Week-shadow helper regression (G5d.5c) | Revert PR #368 (`54afdd02`) | G5d.3 chain; G5d.4 publish-shadow if OK |
| Contract/governance regression (G5d.5b) | Revert PR #367 (`f4a7add1`) | Prior docs |

**DB / RLS:**

- **Do not drop** `provider_menu_profile_runtime_mapping_drafts` as routine rollback.
- **Do not hard-delete** draft rows — use archive API only.
- Table/RLS from G5d.3b remains regardless of G5d.5 rollback.

**Production flags:** Never enable as rollback step. Accidental Production enablement → **hard stop** → unset immediately → incident note.

---

## 9. Failure modes

| Failure | Symptom | Safe behavior | Action |
|---------|---------|---------------|--------|
| Week shadow flag missing | Endpoint 404 | Fail-closed before auth/DB | Set Preview flag for smoke only |
| No draft | `{ weekShadow: null, source: null, meta }` 200 | Safe null response | Save draft via G5d.3e first |
| Invalid draft | 400 `VALIDATION_FAILED` | G5d.3c / helper rejection | Fix draft; no evaluation write |
| `provider_viewer` calls endpoint | 403 `FORBIDDEN` | Admin-only | Expected — no action |
| `providerId` query supplied | 400 `BAD_REQUEST` | Server provider scope only | Expected — no action |
| Helper attempts write | CI/governance fail | **Hard stop** | Revert implementation |
| Sanity import appears | Governance fail | **Hard stop** | Remove import |
| Publish/order/week call during week-shadow GET | Smoke fail | **Hard stop** | Roll back Preview flags; investigate coupling |
| `/week` response changes from week-shadow | Smoke / week-visual fail | **Hard stop** | Roll back; no Production deploy |
| Employee UI sees shadow data | Smoke / week-visual fail | **Hard stop** | Roll back |
| Order call during week-shadow GET | Smoke fail | **Hard stop** | Roll back |
| `menuDayPayload` mutation detected | Governance fail | **Hard stop** | Revert |
| Production flag enabled | Exposure risk | **Hard stop** | Unset Production flag immediately + incident |
| Shadow treated as source of truth | Product/regression | **Hard stop** | DTO review + revert |

---

## 10. Pre-G5d.6 checklist

Before **G5d.6 design/planning** (not execution):

- [ ] G5d.5e evidence doc merged
- [ ] Preview smoke repeatable (Melhus / NO `provider_admin`)
- [ ] Endpoint disabled when flag OFF (404 before auth/DB — unit test + Preview env unset)
- [ ] Production flags **OFF** verified
- [ ] Golden Path PASS (91/91)
- [ ] provider-meny-visual PASS
- [ ] week-visual PASS
- [ ] `/week` unchanged
- [ ] Employee UI unchanged
- [ ] No publish / order / week / Sanity coupling in G5d.5 chain
- [ ] No runtime writes from week-shadow path
- [ ] No Sanity writes
- [ ] No `menuDayPayload` mutation
- [ ] No employee visibility
- [ ] G5d.6 design requires **explicit GO** (separate decision)

---

## 11. Explicit non-goals

G5d.5e and the G5d.5 chain do **not**:

- Start runtime cutover
- Change `/week` runtime response or UI
- Integrate orders
- Expose shadow data to employees
- Write to Sanity
- Mutate `menuDayPayload`
- Touch billing or Tripletex
- Change `pricePreview` or `provider_price_rules` runtime
- Activate Production `LP_MENU_PROFILE_*` flags
- Start G5d.6 implementation

---

## 12. Go/no-go recommendation

**Recommendation:** The G5d.5 chain (G5d.5a–G5d.5d) is **operationally ready for G5d.6 design/planning only** after this evidence document is reviewed and merged.

**G5d.6 implementation** must not start from this PR. G5d.6 requires explicit GO.

**Do not interpret this document as authorization to implement G5d.6 or enable Production flags.**

---

## 13. References

| Artifact | Path / link |
|----------|-------------|
| G5d.5 design audit | `docs/engineering/G5d5-week-shadow-read-design-audit.md` |
| G5d.4f evidence | `docs/engineering/G5d4f-publish-shadow-smoke-evidence.md` |
| Feature flags | `lib/menu-profile/featureFlag.ts` |
| Week shadow helper | `lib/menu-profile/runtimeMappingWeekShadow.server.ts` |
| Week shadow API | `app/api/provider/menu-profile/week-shadow/route.ts` |
| Publish shadow helper | `lib/menu-profile/runtimeMappingPublishShadow.server.ts` |
| Draft API | `app/api/provider/menu-profile/mapping-draft/route.ts` |
| API tests | `tests/api/provider/menu-profile-week-shadow-api.test.ts` |
| Helper tests | `tests/lib/menu-profile/runtimeMappingWeekShadow.test.ts` |
| Governance | `tests/governance/g5d5-week-shadow-contracts.test.ts` |
| Golden Path | `npm run test:golden-path` |
