# G5d.6 — Compatibility cutover design audit

**Status:** Design / audit only — no runtime changes, no API changes, no UI changes, no DB/RLS changes, no `/week` changes, no Production flags, no runtime cutover  
**Date:** 2026-06-28  
**Prerequisite:** G5d.5 chain complete (PR #370 merge `134baba7`); Production `LP_MENU_PROFILE_*` OFF  
**Related:** `G5d5e-week-shadow-smoke-evidence.md`, `G5d5-week-shadow-read-design-audit.md`, `G5d4f-publish-shadow-smoke-evidence.md`, `G5d4-publish-shadow-design-audit.md`, `G5d3f-smoke-rollback-evidence.md`, `G5d-menu-profile-cutover-audit.md`, `tests/governance/g5d0-menu-profile-runtime-contracts.test.ts`, `PROTECTED_GOLDEN_PATH.md`

---

## 1. Scope

This document plans **compatibility cutover** for G5d.6. It is **not** implementation.

| In scope | Out of scope |
|----------|--------------|
| Compatibility cutover definition | Runtime cutover |
| Current NO baseline documentation | Production activation |
| G5d shadow chain summary | `/week` runtime change |
| Flag model proposal (not implemented) | Employee UI change |
| Future architecture sketch | Employee visibility |
| DTO contract proposal | Order change |
| Protected paths | Publish activation |
| Test / smoke / rollback plans | Sanity write |
| Implementation phasing | `menuDayPayload` mutation |
| Go/no-go gates | DB / RLS changes |
| | Billing / Tripletex |
| | Global rollout |
| | Auto-rollout |
| | Source-of-truth switch |

**Hard rules:**

- G5d.6 **implementation** must not start until this design audit is reviewed and merged.
- G5d.6b requires **explicit GO** before any code.
- G5d.7 must **not** start from this PR.
- Production activation requires a **separate final GO**.
- This PR does **not** authorize runtime cutover.

---

## 2. Current NO baseline

### 2.1 Norwegian Golden Path (production truth)

Reference pilot (fixtures/docs/tests only — never hardcode in runtime): Pettersen&Co · Melhus Catering AS · Hovedlokasjon · Thomas Johansen · `paasmurt` / `laks-eggerore` · `2026-06-16` · provider production status flow proven in production.

Protected path: `docs/PROTECTED_GOLDEN_PATH.md` · `npm run test:golden-path` (91/91).

### 2.2 Provider publish flow (runtime truth)

```
ProviderMenuBuilder.save("published")
  → POST /api/provider/menu-days
  → parseMenuDayRequestBody + buildMenuDayPayload()
  → requireSanityWrite() → Sanity menuDay create/replace
  → syncMenuServiceDaysForPublishedMenuDay()
  → syncMenuServiceDayItemsAfterMenuDayPublish()
  → menu_service_days / menu_service_day_items
```

**Key files (LOCKED):**

| Layer | Path |
|-------|------|
| Provider save API | `app/api/provider/menu-days/route.ts`, `…/varmrett/route.ts` |
| Payload builder | `lib/provider-menu/menuDayPayload.ts` |
| Catalog write | `app/api/provider/menu-catalog/route.ts`, `lib/provider-menu/menuCatalogWrite.ts` |
| Sanity write | `lib/sanity/client.ts`, `lib/cms/sanityWriteClient.ts` |
| MSDI sync | `lib/menu-publish/syncMenuServiceDaysFromMenuDay.ts`, `syncMenuServiceDayItems.ts` |
| Auto-rollout | `lib/menu-publish/runMenuWeekRolloutCore.ts`, `runMenuWeekRollout.ts` |

**Runtime truth:** Canonical `Category` keys from `menuDayContract.ts` → Sanity `menuDay` docs → Supabase MSDI → employee `/week` and `lp_order_set`.

### 2.3 Sanity / menuDay source of truth

| Source | Role |
|--------|------|
| Sanity `menuDay` docs | Published menu content (provider-scoped read/write on publish) |
| `menu_service_days` / `menu_service_day_items` | MSDI materialization — employee order surface fallback |
| `agreements` (ACTIVE) | Tier, delivery days, eligibility |

`/week` reads published menu via `getMenuForDateAndPlan` / MSDI — **never** mutates `menuDayPayload`.

### 2.4 menuDayPayload role

- Used only on **provider publish write path** (`app/api/provider/menu-days/**`, `lib/provider-menu/menuDayPayload.ts`)
- Builds Sanity `menuDay` documents on publish
- **Not** read by `/api/week`
- G5d mapping drafts are metadata snapshots — **not** wired to payload builder today

### 2.5 `/week` read behavior

```
GET /api/week?weekOffset=0|1
  → resolveEmployeeWeekScope (auth + company_id + location_id)
  → agreements ACTIVE row
  → resolveProviderMenuScopeForCompany (fail-closed)
  → for each Mon–Fri date: getMenuForDateAndPlan(date, tier, provider-scoped Sanity opts)
  → MSDI fallback: loadEmployeeWeekMenusFromMsdi when Sanity miss
  → buildEmployeeWeekDayRows → JSON { days[], agreement, locked, cutoff, … }
```

**Key paths:** `app/api/week/route.ts`, `app/(app)/week/**`, `lib/week/**`.

### 2.6 Employee UI behavior

- Server auth + active agreement gate on `app/(app)/week/page.tsx`
- Renders `EmployeeWeekClient` with CMS/MSDI menu data
- Order actions via `/api/order/set-day` — not menu-profile shadow
- **No** price, commission, provider cost, or internal pricing rules visible

### 2.7 Order choice keys and write-path

```
EmployeeWeekClient → POST /api/order/set-day
  → orderWriteGuard (no pricing overrides on employee body)
  → getPublishedMenuForDate (validates choice against published menu)
  → lp_order_set RPC (lib/orders/rpcWrite.ts)
  → order status / MSDI choice slug resolution
```

**Choice keys:** `PLAN_ORDER_CHOICE_KEYS`, `ORDER_CHOICE_KEY_BY_CATEGORY` from `menuDayContract.ts` — e.g. `paasmurt`, `varmmat` (varmrett alias). G5d.0: profile category keys must **not** become order choice keys without explicit cutover GO.

### 2.8 Provider order visibility and production flow

- Provider reads orders via `/leverandor/ordrer` with employee + variant display
- Production status: Mottatt → I produksjon → Klar for levering → Levert via `lp_order_advance_status`
- Cutoff: employee cutoff after 08:00 enforced; provider advances scoped to GUC only

### 2.9 Commercial / privacy guardrails

- `assertEmployeeOrderBodyHasNoPricingOverrides` — employee order body must not carry price/currency/commission
- G5d.0 governance: `/week` surfaces must not import `pricePreview`, `provider_price_rules`, menu-profile presentation modules
- Employees see menu titles, allergens, choice labels — **not** provider cost, commission, or internal pricing rules

---

## 3. G5d shadow chain delivered

| Phase | Delivers | Runtime impact |
|-------|----------|----------------|
| **G5d.3b–e** | Draft persistence table + RLS, validation, API, save UI | Metadata snapshots only — not read by `/week`, publish, or orders |
| **G5d.4c–f** | Publish shadow helper + provider-only API + smoke evidence | Evidence only — no Sanity write, no publish mutation |
| **G5d.5c–e** | Week shadow helper + provider-only API + smoke evidence | Evidence only — no `/week` import, no employee visibility |

**Provider-only APIs (all behind flags, default OFF, Production OFF):**

| Route | Flag | Purpose |
|-------|------|---------|
| `GET /api/provider/menu-profile/mapping-draft` | `LP_MENU_PROFILE_MAPPING_DRAFT_API` | Draft read/write/archive |
| `GET /api/provider/menu-profile/publish-shadow` | `LP_MENU_PROFILE_PUBLISH_SHADOW` | Publish shadow evaluation |
| `GET /api/provider/menu-profile/week-shadow` | `LP_MENU_PROFILE_WEEK_SHADOW_READ` | Week shadow evaluation |

**Guarantees proven in Preview smoke (G5d.3f, G5d.4f, G5d.5e):**

- No runtime writes from shadow APIs
- No `/week` response change
- No employee UI change
- No order write-path touch
- No publish mutation
- No Sanity write
- No `menuDayPayload` mutation
- All impact counters = 0 in DTOs
- Production `LP_MENU_PROFILE_*` OFF
- Golden Path 91/91 PASS

**What is still missing before safe compatibility cutover:**

- Unified compatibility comparison across NO runtime surfaces (week + publish + order eligibility)
- Explicit compatibility DTO with hash parity gates
- Contract/governance tests for compatibility flag and helper (G5d.6b)
- Pure comparison helper (G5d.6c)
- Provider-only compatibility API (G5d.6d)
- Preview smoke/rollback evidence (G5d.6e)
- Runtime hook design (G5d.7) — separate program
- NO parity cutover implementation (G5d.8) — separate final GO

---

## 4. Definition of compatibility cutover

**Compatibility cutover** means a later **controlled transition** where menu-profile runtime can be **evaluated against** existing NO runtime output **without breaking** today's output.

It is a **compare-and-evidence** program — not a switch.

### 4.1 What it means in Lunchportalen

| Means | Does not mean |
|-------|---------------|
| Hash/compare current NO runtime vs menu-profile candidate | Global rollout |
| Provider-scoped evidence for admins | Production activation |
| Preserve existing output by default | Employee-visible new menus |
| Gate future phases on parity proof | Orderable shadow output |
| Rollback by flag first | Source-of-truth switch |
| Require explicit GO per phase | Auto-rollout |
| | Publish mutation |
| | Sanity write |
| | `menuDayPayload` mutation |
| | Commercial exposure to employees |

### 4.2 Relationship to G5d.3 / G5d.4 / G5d.5

```
G5d.3 draft snapshot
  → G5d.4 publish shadow (hypothetical publish impact)
    → G5d.5 week shadow (hypothetical week impact)
      → G5d.6 compatibility cutover (unified NO parity gate)
        → G5d.7 runtime hook design (future, separate GO)
          → G5d.8 NO parity implementation (future, final GO)
```

G5d.6 **composes** G5d.4c and G5d.5c evidence — it does **not** replace them or wire them into `/week`.

---

## 5. Cutover principles

| Principle | Requirement |
|-----------|-------------|
| **Compatibility-first** | Existing NO output wins until explicit later GO |
| **Default OFF** | All flags OFF in Production; Preview ON only for smoke |
| **NO parity before expansion** | Norwegian Golden Path must pass before any wider scope |
| **Provider-scoped** | Server `provider.id` only; no client `providerId` |
| **Shadow/evidence before runtime** | G5d.3 → G5d.4 → G5d.5 → G5d.6 before any hook |
| **Employee output unchanged** | Until explicit cutover GO — not G5d.6 |
| **Order choice keys unchanged** | `PLAN_ORDER_CHOICE_KEYS` / MSDI slugs frozen |
| **Publish source of truth unchanged** | Sanity + MSDI remain authoritative |
| **No employee price/commercial exposure** | G5d.0 guardrails remain |
| **Rollback by flag first** | Unset flag → redeploy → endpoint unavailable |
| **Production activation requires separate GO** | G5d.6 never enables Production by itself |

---

## 6. Proposed flag model

**Proposed only — not implemented in G5d.6.**

### 6.1 `LP_MENU_PROFILE_COMPATIBILITY_CUTOVER`

| Property | Value |
|----------|-------|
| Env var | `LP_MENU_PROFILE_COMPATIBILITY_CUTOVER` |
| Default | OFF (unset) |
| Truthy | Exact `"true"` only (`"1"` = OFF — match G5d.4/G5d.5 shadow flags) |
| Preview | ON only after G5d.6b tests + G5d.6c/d implementation + smoke plan |
| Production | **OFF** until explicit final cutover GO |
| Resolver host | Not part of resolver host env unless explicitly approved later |
| Employee UI | Not visible |
| Orderable | No — evidence API only |
| Publish mutations | Cannot enable |
| Sanity writes | Cannot enable |
| `menuDayPayload` mutation | Cannot enable |
| Pricing visibility | Cannot enable |
| Golden Path | Must not bypass |

### 6.2 Prerequisite flags (Preview smoke chain)

For future G5d.6e smoke, these may need to be ON in Preview (not Production):

| Flag | Role |
|------|------|
| `LP_MENU_PROFILE_RESOLVER` | Base resolver gate |
| `LP_MENU_PROFILE_RUNTIME_MAPPING_PROPOSAL` | Mapping proposal panel |
| `LP_MENU_PROFILE_MAPPING_DRAFT_API` | Draft read for compatibility input |
| `LP_MENU_PROFILE_PUBLISH_SHADOW` | Optional direct publish-shadow call |
| `LP_MENU_PROFILE_WEEK_SHADOW_READ` | Optional direct week-shadow call |
| `LP_MENU_PROFILE_COMPATIBILITY_CUTOVER` | Compatibility API gate |

**Production:** All `LP_MENU_PROFILE_*` remain **OFF** (verified 2026-06-28 via `vercel env ls production`).

---

## 7. Proposed architecture for later phases

**G5d.6 design PR implements none of these files.**

### 7.1 Possible future helper

**Path:** `lib/menu-profile/runtimeCompatibilityCutover.server.ts`

**Responsibilities:**

- Compare existing NO runtime output against menu-profile runtime candidate
- Compose G5d.4c publish shadow + G5d.5c week shadow + additional order-eligibility checks
- Preserve existing output by default
- Produce compatibility decision/evidence DTO
- **Never write**
- **Never mutate** `/week` payload, order payload, or `menuDayPayload`
- **Never call** Sanity write or publish mutation

### 7.2 Possible future API

**Path:** `app/api/provider/menu-profile/compatibility-cutover/route.ts`

**Responsibilities:**

- `provider_admin` only
- Behind `LP_MENU_PROFILE_COMPATIBILITY_CUTOVER`
- Flag OFF → 404 before auth/DB/helper (match G5d.4d/G5d.5d pattern)
- `providerId` query → 400
- Evidence/decision only — never employee-facing
- **Never** called by `/week` employee route unless later explicitly approved in G5d.7+

### 7.3 Possible future runtime hook (G5d.7+ only)

Only after **separate GO**:

- Guarded internal read path
- Compare mode first — no output change
- No order change
- Hard-stop if hash diff without explicit override GO

**G5d.6 does not design or implement the hook.** G5d.7 is a separate design audit.

---

## 8. CompatibilityCutoverEvaluationDto

**Proposed contract — not implemented in G5d.6.**

```typescript
type CompatibilityCutoverEvaluationDto = {
  compatibilityOnly: true;
  providerOnly: true;
  evaluatedAt: string;
  providerMenuProfileId: string;
  sourceDraftId: string;
  sourceMappingVersion: string;
  currentNoRuntimeUnchanged: true;
  weekResponseChanges: 0;
  employeeVisibleChanges: 0;
  orderChanges: 0;
  publishChanges: 0;
  sanityWrites: 0;
  menuDayPayloadMutations: 0;
  priceVisibleChanges: 0;
  commercialVisibleChanges: 0;
  canProceedToPreviewCompare: boolean; // true only when all hashes equal + evidence complete
  canProceedToRuntimeHook: false;     // always false until G5d.7 explicit GO
  canProceedToProduction: false;        // always false until final cutover GO
  blockedReasons: string[];
  requiredEvidence: string[];
  comparison: {
    currentNoRuntimeHash: string;
    candidateProfileRuntimeHash: string;
    hashesEqual: boolean;
    diffSummary: string[];
    manualReviewRequired: boolean;
  };
};
```

### 8.1 Forbidden fields (must never appear in response)

`providerId`, `employeePayload`, `orderPayload`, `publishPayload`, `sanityWritePayload`, `menuDayPayloadMutation`, `pricePreview`, `provider_price_rules`, `commission`, `provisjon`, `vat`, `mva`, `activate`, `publish`, `enable`, `apply`, `commit`, `productionEnable`.

### 8.2 Base blocked reasons (proposed)

- `compatibility_only_provider_evidence`
- `no_week_runtime_change`
- `no_employee_visibility`
- `no_order_changes`
- `no_publish_changes`
- `no_sanity_writes`
- `no_menu_day_payload_mutation`
- `no_price_commercial_exposure`
- `runtime_hook_not_authorized`
- `production_not_authorized`

---

## 9. Hard guardrails

Compatibility cutover must **never**:

| Guardrail | Enforcement |
|-----------|-------------|
| Alter `/week` output without explicit later cutover GO | Hash gate + governance |
| Alter employee UI | week-visual + smoke |
| Alter order choice keys | G5d.0 + Golden Path |
| Alter order write-path | Protected path import guards |
| Touch `lp_order_set` / `lp_order_advance_status` | Golden Path + governance |
| Expose price/commercial internals to employees | G5d.0 commercial guard |
| Write Sanity | Forbidden import scan |
| Write / mutate `menuDayPayload` | Forbidden import scan |
| Mutate publish flow | Forbidden import scan |
| Alter `provider_price_rules` / `pricePreview` | G5d.0 governance |
| Alter billing / Tripletex | Out of scope — hard stop |
| Become source of truth automatically | DTO `canProceedToProduction: false` default |
| Auto-rollout to providers | Explicit non-goal |
| Enable Production by default | Flag default OFF |

---

## 10. Protected paths

These paths must remain **unchanged** through G5d.6 design and any future G5d.6b–e implementation unless a **separate explicit GO** authorizes a targeted change:

| Category | Paths |
|----------|-------|
| Week API | `app/api/week/route.ts` |
| Week UI | `app/(app)/week/**` |
| Week lib | `lib/week/**` |
| Employee UI | `app/(app)/week/**`, `components/employee/**`, `components/week/**` |
| Order write | `app/api/orders/**`, `app/api/order/**`, `lib/orders/**` |
| Order RPC | `lp_order_set`, `lp_order_advance_status` |
| menuDayPayload | `lib/provider-menu/menuDayPayload.ts` |
| Provider menu-days | `app/api/provider/menu-days/**` |
| Provider menu-catalog | `app/api/provider/menu-catalog/**` |
| Publish flow | `lib/menu-publish/**`, `app/api/provider/menu-days/**` |
| Auto-rollout | `lib/menu-publish/runMenuWeekRolloutCore.ts`, `runMenuWeekRollout.ts` |
| Sanity sync/write | `lib/sanity/client.ts`, `lib/cms/sanityWriteClient.ts`, `lib/cms/syncProviderToSanity.ts` |
| Billing | billing runtime paths |
| Tripletex | Tripletex runtime paths |
| Pricing | `provider_price_rules`, `pricePreview` runtime |
| Customer/agreement lifecycle | `app/superadmin/companies/**`, agreement lifecycle APIs |
| Golden Path | `docs/PROTECTED_GOLDEN_PATH.md`, protected governance tests |

---

## 11. Tests required before implementation (G5d.6b plan)

G5d.6b delivers **contract/governance tests only** — requires explicit GO.

| Test area | Requirement |
|-----------|-------------|
| Flag default OFF | `isMenuProfileCompatibilityCutoverEnabled({}) === false` |
| Exact `"true"` only | `"1"` / `"yes"` / empty = OFF |
| No Production activation | Governance doc + env guard |
| `/week` unchanged flag OFF | No import of compatibility helper in week route |
| `/week` unchanged flag ON compare mode | Hash gate — no response mutation |
| Employee UI unchanged | week-visual + import guards |
| Order choice keys unchanged | G5d.0 contract reuse |
| Order write-path unchanged | Protected path scan |
| `lp_order_set` not touched | Import guard |
| No Sanity write import | Forbidden import scan |
| No publish mutation import | Forbidden import scan |
| No `menuDayPayload` mutation | Forbidden import scan |
| No price/commercial in employee output | G5d.0 commercial guard |
| No `providerId` in response | API contract test |
| Compatibility DTO counters = 0 | Unit test on helper output |
| `canProceedToProduction: false` | Always false in G5d.6c–e |
| `canProceedToRuntimeHook: false` | Always false in G5d.6c–e |
| Protected path import guards | Governance scan |
| Golden Path unchanged | 91/91 |
| Rollback by flag | Flag OFF → 404 before auth/DB |
| Hard stop on hash diff | Helper returns `hashesEqual: false` + blocked |

---

## 12. Smoke plan for later Preview (G5d.6e)

Preview-only — not executed in G5d.6.

| Step | Action |
|------|--------|
| 1 | Confirm Production `LP_MENU_PROFILE_*` OFF |
| 2 | Set `LP_MENU_PROFILE_COMPATIBILITY_CUTOVER=true` in Preview only |
| 3 | Ensure draft chain flags ON if needed (resolver, proposal, draft API) |
| 4 | Login Melhus `provider_admin` |
| 5 | Ensure latest active draft exists (G5d.3e save) |
| 6 | Call `GET /api/provider/menu-profile/publish-shadow?menuProfileId=norwegian_company_lunch` |
| 7 | Call `GET /api/provider/menu-profile/week-shadow?menuProfileId=norwegian_company_lunch` |
| 8 | Call future `GET /api/provider/menu-profile/compatibility-cutover?menuProfileId=norwegian_company_lunch` |
| 9 | Verify HTTP 200, `compatibilityOnly: true`, all counters = 0 |
| 10 | Verify no forbidden fields in response |
| 11 | Capture `/api/week` hash before/after — must match (time-bound fields documented separately) |
| 12 | Verify employee `/week` UI unchanged |
| 13 | Verify order flow unchanged (Golden Path) |
| 14 | Verify no price/commercial data visible to employee |
| 15 | Verify no Sanity / menuDayPayload writes in network log |
| 16 | Unset `LP_MENU_PROFILE_COMPATIBILITY_CUTOVER` → redeploy Preview |
| 17 | Verify endpoint 404 (unit test contract; deployment protection may block anon fetch) |
| 18 | Verify Golden Path unchanged |

---

## 13. Rollback plan

### 13.1 Rollback without deploy (Preview flags)

1. Unset `LP_MENU_PROFILE_COMPATIBILITY_CUTOVER` in Preview.
2. Redeploy Preview.
3. Verify:
   - Compatibility endpoint → 404 `NOT_FOUND` before auth/DB
   - `/week` unchanged (hash / week-visual)
   - Employee UI unchanged
   - Order flow unchanged
   - Golden Path 91/91
4. **Do not** change Production env vars.

### 13.2 Rollback with deploy (code revert)

| Problem | Action | Keep |
|---------|--------|------|
| Compatibility API regression (G5d.6d) | Revert G5d.6d PR | G5d.6c helper if OK; G5d.4/G5d.5 shadow chain |
| Compatibility helper regression (G5d.6c) | Revert G5d.6c PR | G5d.4/G5d.5 if OK; draft table |
| Contract/governance regression (G5d.6b) | Revert G5d.6b PR | Prior docs |

**DB / RLS:**

- **Do not drop** `provider_menu_profile_runtime_mapping_drafts`
- **Do not hard-delete** draft rows
- Table/RLS from G5d.3b remains regardless of G5d.6 rollback

**Production flags:** Never enable as rollback step. Accidental Production enablement → **hard stop** → unset immediately → incident note.

---

## 14. Failure modes

| Failure | Symptom | Safe behavior | Action |
|---------|---------|---------------|--------|
| Compatibility flag missing | Endpoint unavailable | Fail-closed before auth/DB | Set Preview flag for smoke only |
| Production flag enabled | Exposure risk | **Hard stop** | Unset immediately + incident |
| `/week` response hash changes | Smoke / week-visual fail | **Hard stop** | Rollback Preview flags |
| Employee UI changes | week-visual fail | **Hard stop** | Rollback |
| Order choice key changes | Golden Path fail | **Hard stop** | Rollback |
| Order write-path touched | Governance / Golden Path fail | **Hard stop** | Rollback |
| `lp_order_set` touched | Golden Path fail | **Hard stop** | Rollback |
| Publish mutation detected | Governance fail | **Hard stop** | Remove import |
| Sanity write detected | Governance fail | **Hard stop** | Remove import |
| `menuDayPayload` mutation detected | Governance fail | **Hard stop** | Revert |
| Price/commercial in employee output | G5d.0 fail | **Hard stop** | Rollback |
| `providerId` in response | API contract fail | **Hard stop** | Fix DTO |
| Candidate runtime treated as source of truth | Product/regression | **Hard stop** | DTO review + revert |
| Auto-rollout detected | Governance fail | **Hard stop** | Revert |
| Billing/Tripletex touched | Out of scope | **Hard stop** | Revert |
| Hash diff without manual review | Compatibility blocked | Expected — `canProceedToPreviewCompare: false` | Fix mapping or accept blocked state |

---

## 15. Implementation phasing recommendation

| Phase | Deliverable | Type | GO required |
|-------|-------------|------|-------------|
| **G5d.6a** | This design audit | Docs ✅ (this PR) | — |
| **G5d.6b** | Contract / governance tests only | Tests | **Explicit GO** |
| **G5d.6c** | Pure compatibility comparison helper | `lib/menu-profile/` — read-only | After G5d.6b |
| **G5d.6d** | Provider-only compatibility API behind flag | `app/api/provider/menu-profile/compatibility-cutover/` | After G5d.6c |
| **G5d.6e** | Preview smoke / rollback evidence | Docs | After G5d.6d |
| **G5d.7** | Runtime hook design only | Docs | **Separate GO** — not from G5d.6 |
| **G5d.8** | NO parity cutover implementation | Runtime | **Final GO** — not from G5d.6 |
| **Production activation** | Enable flags in Production | Env | **Separate final GO** |

**Do not skip G5d.6b governance** before G5d.6c code.

**G5d.6 is not runtime cutover.** Even G5d.6d keeps employee `/week`, orders, publish, and Sanity unchanged.

---

## 16. Explicit non-goals

G5d.6 design and this PR do **not**:

- Start runtime cutover
- Enable Production flags
- Change `/week` runtime response or UI
- Expose compatibility evidence to employees
- Change orders or orderability
- Activate publish flow
- Write to Sanity
- Mutate `menuDayPayload`
- Touch billing or Tripletex
- Global rollout to all providers
- Auto-rollout
- Switch source of truth
- Start G5d.6b implementation
- Start G5d.7 design or implementation

---

## 17. Go/no-go recommendation

**Recommendation:** G5d.6 **implementation** (G5d.6b onward) must not start until this design audit is reviewed and merged.

| Gate | Status |
|------|--------|
| G5d.5 chain complete | ✅ PR #370 merged |
| G5d.6 design audit | ⏳ This PR |
| G5d.6b explicit GO | ❌ Not granted |
| G5d.7 start | ❌ Not authorized from this PR |
| Production activation | ❌ Requires separate final GO |

**Do not interpret this document as authorization to implement G5d.6b, enable Production flags, or start runtime cutover.**

---

## 18. References

| Artifact | Path / link |
|----------|-------------|
| G5d.5e evidence | `docs/engineering/G5d5e-week-shadow-smoke-evidence.md` |
| G5d.5 design audit | `docs/engineering/G5d5-week-shadow-read-design-audit.md` |
| G5d.4f evidence | `docs/engineering/G5d4f-publish-shadow-smoke-evidence.md` |
| G5d.4 design audit | `docs/engineering/G5d4-publish-shadow-design-audit.md` |
| G5d.3f evidence | `docs/engineering/G5d3f-smoke-rollback-evidence.md` |
| Cutover audit (prior) | `docs/engineering/G5d-menu-profile-cutover-audit.md` |
| Feature flags | `lib/menu-profile/featureFlag.ts` |
| Week shadow helper | `lib/menu-profile/runtimeMappingWeekShadow.server.ts` |
| Publish shadow helper | `lib/menu-profile/runtimeMappingPublishShadow.server.ts` |
| Draft validation | `lib/menu-profile/runtimeMappingDraftValidation.ts` |
| Golden Path | `docs/PROTECTED_GOLDEN_PATH.md` |
| G5d.0 contracts | `tests/governance/g5d0-menu-profile-runtime-contracts.test.ts` |
| G5d.5 governance | `tests/governance/g5d5-week-shadow-contracts.test.ts` |
| G5d.4 governance | `tests/governance/g5d4-publish-shadow-contracts.test.ts` |
