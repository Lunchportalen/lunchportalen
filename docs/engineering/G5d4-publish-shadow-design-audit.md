# G5d.4 — Publish shadow design audit

**Status:** Design / audit only — no runtime changes, no API changes, no UI changes, no DB/RLS changes, no Production flags  
**Date:** 2026-06-27  
**Prerequisite:** G5d.3 chain complete (PR #359 merge `0cc6787a`); Production `LP_MENU_PROFILE_*` OFF  
**Related:** `G5d3f-smoke-rollback-evidence.md`, `G5d3-mapping-draft-persistence-audit.md`, `G5d-menu-profile-cutover-audit.md`, `PROTECTED_GOLDEN_PATH.md`, `tests/governance/g5d0-menu-profile-runtime-contracts.test.ts`

---

## 1. Scope

This document plans **publish shadow mode** for G5d.4. It is **not** implementation.

| In scope | Out of scope |
|----------|--------------|
| Architecture design | Runtime changes |
| Flag model proposal | API implementation |
| Shadow output contract | UI implementation |
| Protected paths | DB / RLS changes |
| Test / smoke / rollback plans | Production flags |
| Implementation phasing | Publish behavior changes |
| Go/no-go gates | Sanity writes |
| | `/week` changes |
| | Order changes |

**Hard rules:**

- G5d.4 **implementation** must not start until this audit is reviewed and merged.
- G5d.4b requires **explicit GO** before any code.
- G5d.5 must **not** start from this PR.

---

## 2. Current baseline

### 2.1 Today's publish flow (runtime truth)

```
ProviderMenuBuilder.save("published")
  → POST /api/provider/menu-days
  → parseMenuDayRequestBody + buildMenuDayPayload()
  → requireSanityWrite() → Sanity menuDay create/replace
  → syncMenuServiceDaysForPublishedMenuDay() (if published)
  → syncMenuServiceDayItemsAfterMenuDayPublish()
  → menu_service_days / menu_service_day_items (employee order surface)
```

**Key files (LOCKED — must not change in G5d.4 without separate GO):**

| Layer | Path |
|-------|------|
| Provider save API | `app/api/provider/menu-days/route.ts`, `…/varmrett/route.ts`, `…/varmrett/reset/route.ts` |
| Payload builder | `lib/provider-menu/menuDayPayload.ts` |
| Catalog write API | `app/api/provider/menu-catalog/route.ts` |
| Catalog Sanity write | `lib/provider-menu/menuCatalogWrite.ts` |
| Sanity write client | `lib/sanity/client.ts`, `lib/cms/sanityWriteClient.ts` |
| MSDI sync | `lib/menu-publish/syncMenuServiceDaysFromMenuDay.ts`, `syncMenuServiceDayItems.ts` |
| Auto-rollout | `lib/menu-publish/runMenuWeekRolloutCore.ts`, `runMenuWeekRollout.ts`, `generateWeekMenu.ts` |
| Provider UI save | `components/providers/ProviderMenuBuilder.tsx`, `ProviderMenuEditorPanel.tsx` |

**Runtime truth today:** Canonical `Category` keys from `menuDayContract.ts` → Sanity `menuDay` docs → Supabase `menu_service_days` / MSDI → employee `/week` and `lp_order_set`.

### 2.2 Sanity write / sync

| Path | Role |
|------|------|
| `lib/sanity/client.ts` | `requireSanityWrite()` — production Sanity mutations |
| `lib/cms/sanityWriteClient.ts` | Write client factory |
| `lib/cms/syncProviderToSanity.ts` | Provider → Sanity sync |
| `lib/provider-menu/menuCatalogWrite.ts` | Catalog `createOrReplace` |
| `app/api/provider/menu-days/route.ts` | menuDay publish write |

G5d.4 shadow must **never** import or call these.

### 2.3 menuDayPayload / week / order (must remain untouched)

| Surface | Key paths |
|---------|-------------|
| Payload | `lib/provider-menu/menuDayPayload.ts` |
| Week API | `app/api/week/route.ts` |
| Week UI | `app/(app)/week/**` |
| Order write | `app/api/orders/set/route.ts` → `lp_order_set` |
| Order status | `lp_order_advance_status` (provider production) |
| Golden Path | `docs/PROTECTED_GOLDEN_PATH.md`, `tests/governance/protected-golden-path.test.ts` |

### 2.4 Provider menu-days / menu-catalog behavior

- **menu-days:** Server-resolved `provider_id`; `buildMenuDayPayload` gates canonical categories; order locks via `providerMenuOrderLock`.
- **menu-catalog:** Provider-owned titles in Sanity; `varmrett` not catalog-editable; no MenuProfile keys in write chain today.

### 2.5 G5d.3 draft chain (current deliverable)

| Phase | Delivers |
|-------|----------|
| G5d.3b | Table `provider_menu_profile_runtime_mapping_drafts` + RLS |
| G5d.3c | `runtimeMappingDraftValidation.ts` — rejects runtime enablement, Sanity IDs, price mutation |
| G5d.3d | GET/POST/archive API behind `LP_MENU_PROFILE_MAPPING_DRAFT_API` |
| G5d.3e | Save-draft UI behind resolver + proposal + API flags |
| G5d.3f | Smoke / rollback evidence (`G5d3f-smoke-rollback-evidence.md`) |

Draft snapshots are **shadow metadata only** — not read by publish, order, week, or Sanity today.

---

## 3. Goal of G5d.4 (publish shadow mode)

**Publish shadow mode** evaluates what a saved mapping draft *would* imply for publish — without changing runtime.

| Must do | Must never do |
|---------|---------------|
| Read latest draft snapshot (via existing persistence read path) | Write runtime tables |
| Validate snapshot (G5d.3c) | Write to Sanity |
| Build shadow evaluation result | Mutate `menuDayPayload` |
| Compare hypothetically to current publish payload shape | Change `/week` output |
| Emit evidence / log / test-output DTO | Change orderability |
| Prove `runtimeWrites: 0`, etc. | Expose data to employees |
| Fail-closed on any mutation attempt | Activate existing publish flow |

Shadow output is **evidence only** — never source of truth.

---

## 4. Proposed flag model

**Proposed new flag (design only — not implemented in this PR):**

```
LP_MENU_PROFILE_PUBLISH_SHADOW
```

| Property | Value |
|----------|-------|
| Default | `false` / unset |
| Preview | May be ON for smoke only |
| Production | **OFF** (mandatory) |

**Gate requirements (proposed):**

```
isMenuProfilePublishShadowEnabled(env) =
  isMenuProfileMappingDraftSaveUiEnabled(env)   // resolver + proposal + draft API
  AND envFlagTruthy(LP_MENU_PROFILE_PUBLISH_SHADOW)
```

| Rule | Rationale |
|------|-----------|
| Requires G5d.3 flags | Shadow reads drafts saved via G5d.3e |
| Must not activate existing publish | Separate code path; no `buildMenuDayPayload` write |
| Shadow output ≠ source of truth | DTO marked `shadowOnly: true` |
| No employee UI impact | Provider-admin diagnostic only |

**Do not add this flag to Production** until explicit cutover GO (separate from G5d.4b).

---

## 5. Proposed architecture (future — not implemented here)

### 5.1 Server-only shadow evaluator

**Proposed path:** `lib/menu-profile/runtimeMappingPublishShadow.server.ts`

```
readLatestRuntimeMappingDraft(providerId, menuProfileId)   // existing persistence helper
  → validateRuntimeMappingDraft(input)                     // G5d.3c
  → buildShadowPublishEvaluation(proposal, currentPublishSnapshot?)
  → return PublishShadowEvaluationDto
```

**Hard constraints:**

- `server-only` module
- No `requireSanityWrite`, no Sanity client
- No `syncMenuServiceDay*`, no `runMenuWeekRollout*`
- No `lp_order_set`, no `/api/week` imports
- No Supabase writes (read-only SELECT via persistence helper)
- No calls to `buildMenuDayPayload` for mutation — comparison may use read-only inspection of current menu-day rows / payload *shape* only

### 5.2 Possible API (future G5d.4d)

**Proposed path:** `app/api/provider/menu-profile/publish-shadow/route.ts`

| Property | Value |
|----------|-------|
| Methods | GET (latest draft) or POST (explicit draft id) |
| Auth | `provider_admin` write; optional `provider_viewer` read-only if approved |
| Flag | `LP_MENU_PROFILE_PUBLISH_SHADOW` OFF → 404 `NOT_FOUND` |
| Response | `{ ok, rid, data: PublishShadowEvaluationDto }` |
| Side effects | **None** |

**This design PR does not create these files.**

### 5.3 Where shadow can live safely

Shadow evaluation belongs in a **new isolated module** under `lib/menu-profile/`, gated by a **new API route** under `app/api/provider/menu-profile/`. It must not be wired into:

- `ProviderMenuBuilder.save()`
- `POST /api/provider/menu-days`
- `runMenuWeekRolloutCore`
- `/api/week`

---

## 6. Shadow output contract (proposed DTO)

```typescript
type PublishShadowEvaluationDto = {
  shadowOnly: true;                    // always true — never source of truth
  providerId: string;                  // server-resolved only — never from client body
  menuProfileId: string;
  draftId: string;
  mappingVersion: string;
  evaluatedAt: string;                 // ISO timestamp

  wouldMapCategories: Array<{
    profileCategoryKey: string;
    runtimeCategoryKey?: string;
    runtimeLunchCategoryKey?: string;
    runtimeOrderChoiceKey?: string;
    status: string;
  }>;

  unmappedCategories: string[];

  warmDishPreviewSummary: {
    count: number;
    previewOnly: true;
  };

  blockedRuntimeActivationReasons: string[];

  publishImpact: {
    runtimeWrites: 0;
    sanityWrites: 0;
    orderChanges: 0;
    weekChanges: 0;
    employeeVisibleChanges: 0;
  };

  comparisonToCurrentPublish: {
    currentPublishUnchanged: true;     // must be true for PASS
    notes: string[];
  };
};
```

**Contract rules:**

- `publishImpact.*` must be literal zero — not omitted.
- `currentPublishUnchanged: true` is a hard smoke assertion.
- No price/currency fields in DTO.
- No Sanity document IDs.
- No employee-facing labels.

---

## 7. Hard guardrails

Shadow mode implementation (future) must **reject / forbid**:

| Forbidden | Detection |
|-----------|-----------|
| Any runtime DB write | No INSERT/UPDATE/DELETE outside read path |
| Any Sanity write | No `requireSanityWrite`, no `createOrReplace` |
| Publish table mutation | No `menu_service_days` / MSDI writes |
| `menuDayPayload` mutation | Read-only comparison only |
| `/week` output change | week-visual + smoke |
| Order choice change | Golden Path + G5d.0 contracts |
| Employee visibility | No `/week` / employee component imports |
| Price/currency change | G5d.3c validation + DTO shape |
| Provider-owned data mutation | No catalog/menuDay writes |
| Auto-rollout coupling | No `runMenuWeekRollout*` imports |
| Tripletex/billing coupling | Governance import guards |

**If any guardrail fails in implementation → hard stop, rollback Preview flag.**

---

## 8. Protected paths

G5d.4 implementation may **not** modify these without explicit separate GO and Protected Golden Path audit:

| Category | Paths |
|----------|-------|
| Order write | `app/api/orders/set/route.ts`, `lp_order_set`, order RPC wrappers |
| Order status | `lp_order_advance_status`, provider production status flow |
| Week runtime | `app/api/week/route.ts`, `app/(app)/week/**`, week loaders |
| Menu-days API | `app/api/provider/menu-days/**` |
| Menu-catalog API | `app/api/provider/menu-catalog/**` |
| Payload | `lib/provider-menu/menuDayPayload.ts` |
| Publish sync | `lib/menu-publish/**` |
| Auto-rollout | `runMenuWeekRolloutCore.ts`, `generateWeekMenu.ts` |
| Sanity write | `lib/sanity/client.ts`, `lib/cms/sanityWriteClient.ts`, `menuCatalogWrite.ts` |
| Billing | Tripletex runtime, billing APIs |
| Employee UI | `app/(app)/week/**`, employee order components |
| Golden Path | Files listed in `PROTECTED_GOLDEN_PATH.md` |
| G5d.3 API/UI | `mapping-draft/route.ts`, `ProviderMenuRuntimeMappingDraftSaveControls.tsx` |
| Production env | All `LP_MENU_PROFILE_*` flags |

**Allowed new paths (future, with GO):**

- `lib/menu-profile/runtimeMappingPublishShadow.server.ts`
- `app/api/provider/menu-profile/publish-shadow/route.ts`
- `tests/lib/menu-profile/runtimeMappingPublishShadow*.test.ts`
- `tests/governance/g5d4-*` contract tests
- Optional provider-only evidence UI (G5d.4e)

---

## 9. Tests required before implementation

Plan for G5d.4b+ (not in this PR):

| Test | Assert |
|------|--------|
| Flag default OFF | `isMenuProfilePublishShadowEnabled({}) === false` |
| Endpoint unavailable when OFF | 404 `NOT_FOUND`, no DB read side effects beyond auth |
| `provider_admin` only | Write/evaluate requires admin role |
| `provider_viewer` denied | 403 on evaluate if write-like |
| Validation before evaluation | G5d.3c must pass |
| Invalid draft rejected | 400 safe message, no stack/SQL |
| `publishImpact.runtimeWrites === 0` | DTO contract |
| `publishImpact.sanityWrites === 0` | DTO contract |
| `publishImpact.orderChanges === 0` | DTO contract |
| `publishImpact.weekChanges === 0` | DTO contract |
| `publishImpact.employeeVisibleChanges === 0` | DTO contract |
| `currentPublishUnchanged === true` | Comparison contract |
| Current publish output unchanged | Integration: menu-days POST before/after shadow call |
| `/week` unchanged | week-visual + smoke |
| Golden Path unchanged | `npm run test:golden-path` |
| Import guards | Shadow module must not import Sanity/order/publish/week/billing |
| No Sanity client | Grep governance |
| No employee UI import | Grep governance |

Extend `tests/governance/g5d0-menu-profile-runtime-contracts.test.ts` or add `g5d4-publish-shadow-contracts.test.ts` in G5d.4b.

---

## 10. Smoke plan (Preview-only, future G5d.4f)

1. Set Preview flags ON (Production **OFF**):
   - `LP_MENU_PROFILE_RESOLVER=true`
   - `LP_MENU_PROFILE_RUNTIME_MAPPING_PROPOSAL=true`
   - `LP_MENU_PROFILE_MAPPING_DRAFT_API=true`
   - `LP_MENU_PROFILE_PUBLISH_SHADOW=true`
2. Login Melhus `provider_admin` → `/leverandor/meny`
3. Save mapping draft via G5d.3e (existing smoke)
4. Call `GET /api/provider/menu-profile/publish-shadow?menuProfileId=…`
5. Assert DTO: `shadowOnly: true`, all `publishImpact` zeros, `currentPublishUnchanged: true`
6. Assert no Sanity network calls
7. Assert no `menu-days` POST triggered by shadow call
8. Open `/week` — no shadow data visible
9. Run Golden Path suite
10. Unset `LP_MENU_PROFILE_PUBLISH_SHADOW` → redeploy Preview
11. Assert endpoint 404; no shadow UI

---

## 11. Rollback plan

### 11.1 Without deploy

1. Unset `LP_MENU_PROFILE_PUBLISH_SHADOW` in Preview
2. Redeploy Preview
3. Verify endpoint 404 / hidden
4. Verify no shadow UI
5. Verify no writes occurred (draft table unchanged except prior G5d.3e saves)
6. **Do not** change Production flags

### 11.2 With deploy

| Problem | Action | Keep |
|---------|--------|------|
| Shadow API regression | Revert G5d.4d PR | G5d.3 chain, draft table |
| Shadow helper regression | Revert G5d.4c PR | G5d.3c validation |
| Shadow UI regression | Revert G5d.4e PR | API if OK |

**Never as routine rollback:**

- Drop `provider_menu_profile_runtime_mapping_drafts`
- Hard-delete drafts
- Enable Production flags

---

## 12. Failure modes

| Failure | Symptom | Safe behavior | Action |
|---------|---------|---------------|--------|
| Shadow flag missing | Endpoint 404 | Fail-closed | Set Preview flag for smoke only |
| Invalid draft | 400 validation error | G5d.3c message | Fix draft; no evaluation |
| Draft not found | 404 or null draft | Safe JSON | Save draft first (G5d.3e) |
| Shadow attempts runtime write | CI/governance fail | **Hard stop** | Revert implementation |
| Sanity client import | Governance fail | **Hard stop** | Remove import |
| `/week` output changes | week-visual fail | **Hard stop** | Rollback |
| Order path changes | Golden Path fail | **Hard stop** | Rollback |
| Employee UI shows shadow data | Smoke fail | **Hard stop** | Rollback |
| Production flag enabled | Exposure risk | **Hard stop** | Unset immediately + incident |
| Shadow treated as source of truth | Product/regression | **Hard stop** | DTO review + revert |

---

## 13. Implementation phasing recommendation

| Phase | Deliverable | Type |
|-------|-------------|------|
| **G5d.4a** | This design audit | Docs ✅ (this PR) |
| **G5d.4b** | Contract / governance tests only | Tests — requires **explicit GO** |
| **G5d.4c** | Pure shadow evaluation helper | `lib/menu-profile/` — read-only |
| **G5d.4d** | Shadow API behind flag | `app/api/provider/menu-profile/publish-shadow/` |
| **G5d.4e** | Provider shadow evidence UI (optional) | Provider workspace — read-only display |
| **G5d.4f** | Preview smoke / rollback evidence | Docs |
| **G5d.5** | `/week` shadow **read** design | Docs only — not implementation |

**Do not skip G5d.4b governance** before G5d.4c code.

---

## 14. Explicit non-goals

G5d.4 design and future implementation do **not**:

- Activate publish
- Change employee visibility
- Change orders or orderability
- Change `/week` read or write paths
- Write to Sanity
- Touch billing or Tripletex
- Change `pricePreview` or `provider_price_rules` runtime
- Change `menuDayPayload` runtime
- Start runtime cutover
- Enable Production `LP_MENU_PROFILE_*` flags

---

## 15. Go / no-go

**Recommendation:** G5d.4 **implementation must not start** until this design audit is reviewed and merged.

| Gate | Requirement |
|------|-------------|
| G5d.4a | This document merged |
| G5d.4b | Explicit GO + governance tests |
| G5d.4c–4f | Each phase requires GO + CI + Golden Path |
| G5d.5 | Separate design GO — not authorized here |
| Production | All `LP_MENU_PROFILE_*` remain OFF |

**Do not interpret this document as authorization to implement shadow API, helper, or UI.**

---

## 16. References

| Artifact | Path |
|----------|------|
| G5d.3f evidence | `docs/engineering/G5d3f-smoke-rollback-evidence.md` |
| G5d.3 persistence audit | `docs/engineering/G5d3-mapping-draft-persistence-audit.md` |
| G5d cutover audit | `docs/engineering/G5d-menu-profile-cutover-audit.md` |
| Draft validation | `lib/menu-profile/runtimeMappingDraftValidation.ts` |
| Draft persistence | `lib/menu-profile/runtimeMappingDraftPersistence.server.ts` |
| Draft API | `app/api/provider/menu-profile/mapping-draft/route.ts` |
| Feature flags | `lib/menu-profile/featureFlag.ts` |
| Publish payload | `lib/provider-menu/menuDayPayload.ts` |
| Publish sync | `lib/menu-publish/syncMenuServiceDaysFromMenuDay.ts` |
| Governance | `tests/governance/g5d0-menu-profile-runtime-contracts.test.ts` |
| Golden Path | `docs/PROTECTED_GOLDEN_PATH.md` |
