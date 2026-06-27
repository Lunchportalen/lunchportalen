# G5d.4f — Publish shadow smoke and rollback evidence

**Status:** Evidence only — no runtime changes, no API changes, no UI changes, no DB/RLS changes, no Production flags  
**Date:** 2026-06-27  
**Prerequisite:** G5d.4a–G5d.4d merged on `main` (PR #363 merge `b30548c7`); Production `LP_MENU_PROFILE_*` OFF  
**Related:** `G5d4-publish-shadow-design-audit.md`, `G5d3f-smoke-rollback-evidence.md`, `tests/governance/g5d4-publish-shadow-contracts.test.ts`, `PROTECTED_GOLDEN_PATH.md`

---

## 1. Scope

This document locks **operational safety evidence** for the G5d.4 publish-shadow chain (G5d.4c–G5d.4d). It is **not** a feature delivery.

| In scope | Out of scope |
|----------|--------------|
| Smoke evidence (Preview) | New functionality |
| Rollback plan | Runtime cutover |
| Flag matrix | Publish activation |
| Production OFF evidence | `/week` shadow read |
| Pre-G5d.5 checklist | Order integration |
| Failure modes | Sanity write |
| Go/no-go recommendation | Production activation |
| G5d.4e UI | G5d.5 implementation |

**Hard rules:**

- G5d.5 requires explicit GO. This document does **not** authorize G5d.5 implementation.
- G5d.4e (provider shadow evidence UI) was **skipped** — not required for this evidence PR.
- Do **not** enable Production `LP_MENU_PROFILE_*` flags.

---

## 2. Delivered chain

| Phase | PR | Merge SHA | Delivers |
|-------|-----|-----------|----------|
| **G5d.4a** | [#360](https://github.com/Lunchportalen/lunchportalen/pull/360) | `1cad708d` | Publish shadow design audit (`G5d4-publish-shadow-design-audit.md`) |
| **G5d.4b** | [#361](https://github.com/Lunchportalen/lunchportalen/pull/361) | `365a0435` | Contract/governance tests + inert `isMenuProfilePublishShadowEnabled()` |
| **G5d.4c** | [#362](https://github.com/Lunchportalen/lunchportalen/pull/362) | `0d3aac17` | Pure `buildRuntimeMappingPublishShadowEvaluation` helper (server-only, no I/O writes) |
| **G5d.4d** | [#363](https://github.com/Lunchportalen/lunchportalen/pull/363) | `b30548c7` | Read-only GET `/api/provider/menu-profile/publish-shadow` behind `LP_MENU_PROFILE_PUBLISH_SHADOW` |

**Not delivered (by design):**

- G5d.4e provider-only shadow evidence UI (skipped / not started)
- G5d.5 `/week` shadow read design or implementation
- Runtime cutover
- Publish / order / week / Sanity wiring
- Employee visibility
- Production flags

---

## 3. Flag matrix

`LP_MENU_PROFILE_PUBLISH_SHADOW` accepts exact `"true"` only (`"1"` = OFF). Other G5d flags accept `"true"` or `"1"`.

| Flag | Default | Preview smoke (2026-06-27) | Production | Purpose | Rollback action |
|------|---------|----------------------------|------------|---------|-----------------|
| `LP_MENU_PROFILE_PUBLISH_SHADOW` | OFF | ON **during smoke only** (then unset) | **OFF** | G5d.4d publish-shadow API gate | Unset in Preview; redeploy Preview |
| `LP_MENU_PROFILE_RESOLVER` | OFF | ON (draft chain) | **OFF** | G5a resolver — base gate | Unset in Preview (optional after smoke) |
| `LP_MENU_PROFILE_RUNTIME_MAPPING_PROPOSAL` | OFF | ON (draft chain) | **OFF** | G5d.2 mapping proposal panel | Unset in Preview (optional after smoke) |
| `LP_MENU_PROFILE_MAPPING_DRAFT_API` | OFF | ON (draft chain) | **OFF** | G5d.3d draft API + G5d.3e save UI | Unset in Preview (optional after smoke) |

**Draft prerequisite for shadow smoke:** Latest non-archived draft must exist. G5d.3e save flow (or prior G5d.3f smoke) satisfies this in Preview.

**Production:** Verified via `vercel env ls production` — **no `LP_MENU_PROFILE_*` variables** (2026-06-27).

**Preview smoke flag sequence:**

1. Set `LP_MENU_PROFILE_PUBLISH_SHADOW=true` in Preview only (plus existing G5d.3 draft-chain flags).
2. Redeploy Preview.
3. Run smoke (Melhus `provider_admin`).
4. Unset `LP_MENU_PROFILE_PUBLISH_SHADOW` in Preview.
5. Redeploy Preview.
6. Verify endpoint fail-closed (404 `NOT_FOUND` — see §5.3 and API unit tests).

**Do not mutate Production flags** as part of G5d.4 rollback.

---

## 4. Preview smoke evidence

### 4.1 Context

| Item | Value |
|------|-------|
| Provider | Melhus Catering AS / NO |
| Role | `provider_admin` (`post@melhuscatering.no`) |
| Route | `GET /api/provider/menu-profile/publish-shadow?menuProfileId=norwegian_company_lunch` |
| Preview URL (smoke) | `https://lunchportalen-k3p6j0fn1-lunchportalen.vercel.app` |
| Branch alias | `lunchportalen-git-feat-g5d4d-publish-shadow-api-lunchportalen.vercel.app` (same code as `main` @ `b30548c7`) |
| Flags ON (Preview only) | `LP_MENU_PROFILE_RESOLVER`, `LP_MENU_PROFILE_RUNTIME_MAPPING_PROPOSAL`, `LP_MENU_PROFILE_MAPPING_DRAFT_API`, `LP_MENU_PROFILE_PUBLISH_SHADOW` |
| Smoke script (local temp) | `scripts/temp-g5d4f-preview-smoke.mjs` — not committed; repeatable with `.env.local` credentials |

### 4.2 Smoke steps — result

| # | Step | Expected | Result |
|---|------|----------|--------|
| 1 | Production flags OFF | No `LP_MENU_PROFILE_*` in Production | **PASS** (`vercel env ls production` empty) |
| 2 | Preview has `LP_MENU_PROFILE_PUBLISH_SHADOW=true` | Set + redeploy before smoke | **PASS** |
| 3 | Login `provider_admin` | Reach provider workspace | **PASS** |
| 4 | Ensure latest draft | G5d.3e save or existing draft | **PASS** (`draftId` present) |
| 5 | GET publish-shadow | HTTP 200 | **PASS** |
| 6 | Response contract | `{ ok, rid, data: { shadow, source, meta } }` | **PASS** |
| 7 | `shadow.shadowOnly=true` | Always true | **PASS** |
| 7 | `meta.shadowOnly=true` | Always true | **PASS** |
| 7 | All `meta.*` impact counters | `0` | **PASS** (`runtimeWrites`, `sanityWrites`, `orderChanges`, `weekChanges`, `employeeVisibleChanges`) |
| 7 | `shadow.publishImpact.*` | All `0` | **PASS** |
| 7 | `source.draftId` | UUID present | **PASS** (`c3f85199-b86b-4e09-9627-c6e261fd7c78`) |
| 7 | `source.menuProfileId` | `norwegian_company_lunch` | **PASS** |
| 7 | `source.mappingVersion` | `g5d.1` | **PASS** |
| 8 | No forbidden fields | No `providerId`, payloads, activation words | **PASS** |
| 9 | Network during shadow GET only | No publish / Sanity / order / `/week` calls | **PASS** |
| 10 | `/week` unchanged | No shadow text or draft UI | **PASS** |
| 11 | Employee UI unchanged | No shadow leakage | **PASS** |
| 12 | Golden Path | 91/91 | **PASS** (local `npm run test:golden-path` on `main`) |
| 13 | Unset `LP_MENU_PROFILE_PUBLISH_SHADOW` | Removed from Preview env | **PASS** (2026-06-27) |
| 14 | Redeploy Preview | New deployment without flag | **PASS** (`lunchportalen-7deliibwo-lunchportalen.vercel.app`) |
| 15 | Endpoint disabled | 404 `NOT_FOUND` before auth/DB | **PASS** (API unit test — §5.3) |
| 16 | No DB writes from shadow call | Read-only SELECT only | **PASS** (route + governance) |
| 17 | Production flags still OFF | No Production env change | **PASS** |

**Sample response RID (Preview smoke):** `prov_pub_shadow_mqwwkzkj_5gp36h6o00th5jk9`

**Sample `blockedRuntimeActivationReasons` (all five shadow-only reasons):**

- `shadow_only_no_runtime_writes`
- `shadow_only_no_sanity_writes`
- `shadow_only_no_order_changes`
- `shadow_only_no_week_changes`
- `shadow_only_no_employee_visibility`

### 4.3 CI evidence (G5d.4d merge)

Merge SHA `b30548c7` — all required checks **PASS** on `main`:

- CI, CI Enterprise, CI E2E, CI (AGENTS gate), suspend-rpc-authz
- provider-meny-visual, week-visual
- Golden Path **91/91**

---

## 5. No-write evidence

| Check | Evidence |
|-------|----------|
| Route has no DB mutations | `publish-shadow/route.ts` — no `.insert`, `.update`, `.delete` (governance scan) |
| No Sanity client import | Forbidden import scan PASS on route + helper |
| No publish import | No `menu-publish`, `syncMenuServiceDay*`, `runMenuWeekRollout*` imports |
| No order import | No `lp_order_set`, `/api/orders` imports |
| No `/week` / menuDayPayload mutation | No `buildMenuDayPayload` import; week surfaces have no shadow refs |
| Governance tests | `tests/governance/g5d4-publish-shadow-contracts.test.ts` — PASS |
| API tests | `tests/api/provider/menu-profile-publish-shadow-api.test.ts` — 20 tests PASS |
| Helper unit tests | `tests/lib/menu-profile/runtimeMappingPublishShadow.test.ts` — 23 tests PASS |
| Golden Path | `npm run test:golden-path` — **91/91** |

---

## 6. Production OFF evidence

| Check | Evidence |
|-------|----------|
| No Production env flags | `vercel env ls production` → empty for `LP_MENU_PROFILE_*` (2026-06-27) |
| `LP_MENU_PROFILE_PUBLISH_SHADOW` not in Production | Confirmed absent from Production env list |
| API default OFF | `isMenuProfilePublishShadowEnabled({}) === false` |
| Endpoint unavailable when flag OFF | Unit test: GET returns 404 `NOT_FOUND`; `readLatestRuntimeMappingDraft` **not called** |
| Production runtime unaffected | Publish / order / week / Sanity paths unchanged; protected paths do not import shadow module |
| No Production deploy of Preview flags | Smoke flags Preview-only; removed after evidence capture |

---

## 7. Rollback plan

### 7.1 Rollback without deploy (Preview flags)

1. Unset `LP_MENU_PROFILE_PUBLISH_SHADOW` in Preview (keep or unset G5d.3 draft-chain flags separately).
2. Redeploy Preview (or wait for next Preview build from git).
3. Verify:
   - GET `/api/provider/menu-profile/publish-shadow?menuProfileId=…` → 404 `NOT_FOUND` (unit test contract; flag check before auth/DB).
   - No shadow UI (G5d.4e not implemented — none expected).
   - No new DB writes from shadow API (endpoint inert when flag OFF).
   - `/week` and employee UI unchanged.
4. **Do not** change Production env vars.

**Executed 2026-06-27:** `LP_MENU_PROFILE_PUBLISH_SHADOW` removed from Preview; Preview redeployed to `lunchportalen-7deliibwo-lunchportalen.vercel.app`.

### 7.2 Rollback with deploy (code revert)

| Problem | Action | Keep |
|---------|--------|------|
| Shadow API regression (G5d.4d) | Revert PR #363 (`b30548c7`) | G5d.4c helper if OK; G5d.3 chain; draft table |
| Shadow helper regression (G5d.4c) | Revert PR #362 (`0d3aac17`) | G5d.3 chain; draft table |
| Contract/governance regression (G5d.4b) | Revert PR #361 (`365a0435`) | Prior docs |

**DB / RLS:**

- **Do not drop** `provider_menu_profile_runtime_mapping_drafts` as routine rollback.
- **Do not hard-delete** draft rows — use archive API only.
- Table/RLS from G5d.3b remains regardless of G5d.4 rollback.

**Production flags:** Never enable as rollback step. Accidental Production enablement → **hard stop** → unset immediately → incident note.

---

## 8. Failure modes

| Failure | Symptom | Safe behavior | Action |
|---------|---------|---------------|--------|
| Publish shadow flag missing | Endpoint 404 | Fail-closed before auth/DB | Set Preview flag for smoke only |
| No draft | `{ shadow: null, source: null, meta }` 200 | Safe null response | Save draft via G5d.3e first |
| Invalid draft | 400 `VALIDATION_FAILED` | G5d.3c / helper rejection | Fix draft; no evaluation write |
| `provider_viewer` calls endpoint | 403 `FORBIDDEN` | Admin-only | Expected — no action |
| `providerId` query supplied | 400 `BAD_REQUEST` | Server provider scope only | Expected — no action |
| Helper attempts write | CI/governance fail | **Hard stop** | Revert implementation |
| Sanity import appears | Governance fail | **Hard stop** | Remove import |
| Publish/order/week call during shadow GET | Smoke fail | **Hard stop** | Roll back Preview flags; investigate coupling |
| Employee UI sees shadow data | Smoke / week-visual fail | **Hard stop** | Roll back; no Production deploy |
| Production flag enabled | Exposure risk | **Hard stop** | Unset Production flag immediately + incident |
| Shadow treated as source of truth | Product/regression | **Hard stop** | DTO review + revert |

---

## 9. Pre-G5d.5 checklist

Before **G5d.5 design/planning** (not execution):

- [ ] G5d.4f evidence doc merged
- [ ] Preview smoke repeatable (Melhus / NO `provider_admin`)
- [ ] Endpoint disabled when flag OFF (404 before auth/DB — unit test + Preview env unset)
- [ ] Production flags **OFF** verified
- [ ] Golden Path PASS (91/91)
- [ ] provider-meny-visual PASS
- [ ] week-visual PASS
- [ ] `/week` unchanged
- [ ] Employee UI unchanged
- [ ] No publish / order / week / Sanity coupling in G5d.4 chain
- [ ] No runtime writes from shadow path
- [ ] No Sanity writes
- [ ] No order changes
- [ ] No employee visibility
- [ ] G5d.5 design requires **explicit GO** (separate decision)

---

## 10. Explicit non-goals

G5d.4f and the G5d.4 chain do **not**:

- Start runtime cutover
- Activate publish
- Change `/week` read path
- Integrate orders
- Expose shadow data to employees
- Write to Sanity
- Touch billing or Tripletex
- Change `pricePreview` or `provider_price_rules` runtime
- Change `menuDayPayload` runtime
- Implement G5d.4e provider UI (skipped)
- Activate Production `LP_MENU_PROFILE_*` flags
- Start G5d.5 implementation

---

## 11. Go/no-go recommendation

**Recommendation:** The G5d.4 chain (G5d.4a–G5d.4d) is **operationally ready for G5d.5 design/planning only** after this evidence document is reviewed and merged.

**G5d.5 implementation** must not start from this PR. G5d.5 requires explicit GO.

**G5d.4e** (optional provider-only shadow evidence UI) remains **not started** — requires separate explicit GO if desired.

**Do not interpret this document as authorization to implement G5d.5 or enable Production flags.**

---

## 12. References

| Artifact | Path / link |
|----------|-------------|
| G5d.4 design audit | `docs/engineering/G5d4-publish-shadow-design-audit.md` |
| G5d.3f evidence | `docs/engineering/G5d3f-smoke-rollback-evidence.md` |
| Feature flags | `lib/menu-profile/featureFlag.ts` |
| Shadow helper | `lib/menu-profile/runtimeMappingPublishShadow.server.ts` |
| Shadow API | `app/api/provider/menu-profile/publish-shadow/route.ts` |
| Draft API | `app/api/provider/menu-profile/mapping-draft/route.ts` |
| API tests | `tests/api/provider/menu-profile-publish-shadow-api.test.ts` |
| Helper tests | `tests/lib/menu-profile/runtimeMappingPublishShadow.test.ts` |
| Governance | `tests/governance/g5d4-publish-shadow-contracts.test.ts` |
| Golden Path | `npm run test:golden-path` |
