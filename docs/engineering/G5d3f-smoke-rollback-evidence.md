# G5d.3f — Smoke and rollback evidence

**Status:** Evidence only — no runtime changes, no API changes, no UI changes, no DB/RLS changes, no Production flags  
**Date:** 2026-06-27  
**Prerequisite:** G5d.3b–G5d.3e merged on `main`; Production `LP_MENU_PROFILE_*` OFF  
**Related:** `G5d3-mapping-draft-persistence-audit.md`, `G5d-menu-profile-cutover-audit.md`, `tests/governance/g5d0-menu-profile-runtime-contracts.test.ts`, `PROTECTED_GOLDEN_PATH.md`

---

## 1. Scope

This document locks **operational safety evidence** for the G5d.3 mapping-draft chain (G5d.3b–G5d.3e). It is **not** a feature delivery.

| In scope | Out of scope |
|----------|--------------|
| Smoke evidence (Preview) | New functionality |
| Rollback plan | Runtime cutover |
| Flag matrix | Publish shadow mode |
| Production OFF evidence | `/week` shadow read |
| Pre-G5d.4 checklist | Order integration |
| Failure modes | Sanity write |
| Go/no-go recommendation | Production activation |

**Hard rule:** G5d.4 requires explicit GO. This document does **not** authorize G5d.4.

---

## 2. Delivered chain

| Phase | PR | Merge SHA | Delivers |
|-------|-----|-----------|----------|
| **G5d.3b** | [#355](https://github.com/Lunchportalen/lunchportalen/pull/355) | `89594b75` | DB table `provider_menu_profile_runtime_mapping_drafts` + RLS (metadata/snapshot only) |
| **G5d.3c** | [#356](https://github.com/Lunchportalen/lunchportalen/pull/356) | `3643ec11` | Pure validation helpers (`runtimeMappingDraftValidation.ts`) — reject runtime enablement |
| **G5d.3d** | [#357](https://github.com/Lunchportalen/lunchportalen/pull/357) | `375c90f5` | GET/POST/archive API behind `LP_MENU_PROFILE_MAPPING_DRAFT_API` (default OFF) |
| **G5d.3e** | [#358](https://github.com/Lunchportalen/lunchportalen/pull/358) | `55ab24a3` | Provider save-draft UI behind resolver + proposal + API flags; uses G5d.3d API only |

**G5d.3e host-env fix (included in squash merge):** `menuProfileResolverHostEnv()` must pass `LP_MENU_PROFILE_MAPPING_DRAFT_API` to UI gating. Without it, API can work while save UI stays hidden (see failure modes).

**Not delivered (by design):**

- Runtime cutover
- Publish / order / week / Sanity wiring
- Employee visibility
- Production flags
- Billing / Tripletex integration

---

## 3. Flag matrix

All flags accept `"true"` or `"1"` only. Anything else = OFF.

| Flag | Default | Preview (2026-06-27) | Production | Purpose | Rollback action |
|------|---------|------------------------|------------|---------|-----------------|
| `LP_MENU_PROFILE_RESOLVER` | OFF | ON | **OFF** | G5a resolver — base gate for menu profile panels | Unset in Preview; redeploy Preview |
| `LP_MENU_PROFILE_FIXED_CATEGORIES` | OFF | ON | **OFF** | G5b fixed category presentation panel | Unset in Preview (optional; independent of draft save) |
| `LP_MENU_PROFILE_WARM_DISH_PREVIEW` | OFF | ON | **OFF** | G5c warm dish preview panel | Unset in Preview (optional; independent of draft save) |
| `LP_MENU_PROFILE_RUNTIME_MAPPING_PROPOSAL` | OFF | ON | **OFF** | G5d.2 shadow mapping proposal panel | Unset in Preview; redeploy Preview |
| `LP_MENU_PROFILE_MAPPING_DRAFT_API` | OFF | ON | **OFF** | G5d.3d API + required for G5d.3e save UI | Unset in Preview; redeploy Preview |

**G5d.3e save UI requires all three:**

1. `LP_MENU_PROFILE_RESOLVER=true`
2. `LP_MENU_PROFILE_RUNTIME_MAPPING_PROPOSAL=true`
3. `LP_MENU_PROFILE_MAPPING_DRAFT_API=true`

**Production:** Verified via `vercel env ls production` — **no `LP_MENU_PROFILE_*` variables** (2026-06-27).

**Rollback without deploy:** Unset Preview flags above → redeploy Preview → verify save UI hidden and API returns disabled response.

**Do not mutate Production flags** as part of G5d.3 rollback.

---

## 4. Preview smoke evidence

### 4.1 Context

| Item | Value |
|------|-------|
| Provider | Melhus Catering AS / NO |
| Role | `provider_admin` (`post@melhuscatering.no`) |
| Route | `/leverandor/meny` |
| Preview URL | `https://lunchportalen-git-feat-g5d3e-mapping-draft-22c12a-lunchportalen.vercel.app` (PR #358); post-merge Preview uses same flag set |
| Flags ON (Preview only) | `LP_MENU_PROFILE_RESOLVER`, `LP_MENU_PROFILE_RUNTIME_MAPPING_PROPOSAL`, `LP_MENU_PROFILE_MAPPING_DRAFT_API` |
| Smoke script (local temp) | `scripts/temp-g5d3e-preview-smoke.mjs` — not committed; repeatable with `.env.local` credentials |

### 4.2 Smoke steps — result

| # | Step | Expected | Result |
|---|------|----------|--------|
| 1 | Login `provider_admin` | Reach provider workspace | **PASS** |
| 2 | Open `/leverandor/meny` | Menu workspace loads | **PASS** |
| 3 | Mapping proposal panel | `data-testid="provider-menu-runtime-mapping-proposal-panel"` visible | **PASS** |
| 4 | Draft-save section | `data-testid="provider-menu-runtime-mapping-draft-save"` visible | **PASS** (after host-env fix + `LP_MENU_PROFILE_MAPPING_DRAFT_API` in Preview) |
| 5 | Initial status | «Ikke lagret» or «Utkast lagret» if draft exists | **PASS** |
| 6 | Button copy | «Lagre vurdering som utkast» | **PASS** |
| 7 | Click save | POST fires | **PASS** |
| 8 | POST endpoint | `/api/provider/menu-profile/mapping-draft` | **PASS** |
| 9 | Payload | No `providerId` in body | **PASS** |
| 10 | `draftStatus` | `"draft"` | **PASS** |
| 11 | Success feedback | «Utkast lagret» | **PASS** |
| 12 | Success help text | Not published; not visible to employees | **PASS** |
| 13 | Refresh page | GET latest draft | **PASS** |
| 14 | Status after refresh | «Utkast lagret» + GET mapping-draft | **PASS** |
| 15 | Network isolation | No publish / order / week / Sanity calls during save flow | **PASS** |
| 16 | `/week` unchanged | No draft UI on employee week surface | **PASS** |
| 17 | Employee UI unchanged | No draft/status leakage | **PASS** |
| 18 | Forbidden words | No Aktiver / Publiser / Send til ansatte / Gjør live / Bruk i meny / Apply / Enable in save section | **PASS** |
| 19 | Production flags | All `LP_MENU_PROFILE_*` OFF in Production | **PASS** |

### 4.3 CI evidence (G5d.3e merge)

Merge SHA `55ab24a3` — all required checks **PASS**:

- build, enterprise, e2e, agents_gate, suspend-rpc-authz
- provider-meny-visual, week-visual
- Golden Path **91/91**

---

## 5. Production OFF evidence

| Check | Evidence |
|-------|----------|
| No Production env flags | `vercel env ls production` → empty for `LP_MENU_PROFILE_*` |
| G5d.3e save UI inactive in Production | UI gated by flags; Production has none → section not rendered |
| API default OFF | `isMenuProfileMappingDraftApiEnabled()` false when env unset |
| API unavailable when flag OFF | GET/POST return `{ ok: false, …, status: 404, error: "NOT_FOUND" }` — no DB read/write |
| No runtime cutover in Production | publish / order / week / Sanity paths unchanged; governance tests enforce separation |

---

## 6. Runtime separation evidence

Governance: `tests/governance/g5d0-menu-profile-runtime-contracts.test.ts`

| Surface | Protected by |
|---------|--------------|
| Draft API routes | No imports of publish / order / week / Sanity / billing / Tripletex |
| Draft persistence server helper | Not imported by client UI |
| Draft save UI | No `runtimeMappingDraftPersistence.server`, `menu-publish`, `lp_order_set`, `syncMenuServiceDay`, `requireSanityWrite`, Tripletex |
| `ProviderMenuBuilder.save()` | G5d.0 — no `runtimeMappingProposal` in save block |
| `/week` output | Unchanged — smoke + week-visual CI |
| `menu-days` / `menu-catalog` API | Unchanged — provider-meny-visual CI |
| Employee UI | No draft controls; forbidden CTA words guarded in nb `draftSave` copy |
| `provider_price_rules` / `pricePreview` | Not in G5d.3 chain; unchanged |
| `menuDayPayload` | G5d.0 contract tests — profile keys must not leak |

**Employee commercial visibility:** unchanged — `assertEmployeeOrderBodyHasNoPricingOverrides` and related G5d.0 fixtures still green.

---

## 7. Rollback plan

### 7.1 Rollback without deploy (Preview flags)

1. Unset or remove Preview env vars (in order of dependency):
   - `LP_MENU_PROFILE_MAPPING_DRAFT_API`
   - `LP_MENU_PROFILE_RUNTIME_MAPPING_PROPOSAL`
   - `LP_MENU_PROFILE_RESOLVER`
   - (Optional) `LP_MENU_PROFILE_FIXED_CATEGORIES`, `LP_MENU_PROFILE_WARM_DISH_PREVIEW`
2. Redeploy Preview (or wait for next Preview build).
3. Verify:
   - Draft-save section not rendered on `/leverandor/meny`
   - GET `/api/provider/menu-profile/mapping-draft?menuProfileId=…` → 404 `NOT_FOUND`
   - No new DB writes from UI (save button absent)
4. **Do not** change Production env vars.

### 7.2 Rollback with deploy (code revert)

| Problem | Action | Keep |
|---------|--------|------|
| UI regression (G5d.3e) | Revert PR #358 (`55ab24a3`) | G5d.3b table/RLS, G5d.3c validation, G5d.3d API if API OK |
| API regression (G5d.3d) | Revert PR #357 (`375c90f5`) | G5d.3b table/RLS; G5d.3c helpers inert without API |
| Validation issue (G5d.3c) | Revert PR #356 only if explicit GO | Table remains |

**DB / RLS:**

- **Do not drop** `provider_menu_profile_runtime_mapping_drafts` as routine rollback.
- **Do not hard-delete** draft rows — use archive API (`POST …/mapping-draft/archive`) only.
- Table/RLS rollback requires **explicit DB rollback decision** (separate from G5d.3f).

**Production flags:** Never enable as rollback step. Accidental Production enablement → **hard stop** → unset immediately → incident note.

---

## 8. Failure modes

| Failure | Symptom | Safe behavior | Action |
|---------|---------|---------------|--------|
| Preview flag missing | Save UI hidden | Fail-closed — no save button | Set missing Preview flag; redeploy |
| API flag missing from host env bag | API 200 but UI hidden | Fail-closed UI | Ensure `menuProfileResolverHostEnv()` includes `LP_MENU_PROFILE_MAPPING_DRAFT_API` (fixed in #358) |
| Validation fails | 400 response | Message: «Utkastet kunne ikke lagres fordi valideringen stoppet en usikker endring.» | Fix proposal payload; no partial runtime write |
| `provider_viewer` attempts save | No button; API 403 if called | «Lagring krever leverandør-admin.» | Expected — no action |
| API flag OFF | 404 `NOT_FOUND` | No DB read/write | Expected when flag unset |
| DB/RLS rejects write | 4xx/5xx safe JSON | No stack trace / SQL in UI | Investigate RLS membership; fail-closed |
| Forbidden copy regression | Governance test fail | CI blocks merge | Fix nb `draftSave` strings |
| Publish/order/week/Sanity network call during save | Smoke / governance fail | **Hard stop** | Roll back Preview flags; investigate coupling |
| Employee UI shows draft | Smoke step 16/17 fail | **Hard stop** | Roll back; no Production deploy |
| Production flag enabled accidentally | Runtime exposure risk | **Hard stop** | Unset Production flag immediately; rollback deploy if needed |

---

## 9. Pre-G5d.4 checklist

Before **G5d.4 design/planning** (not execution):

- [ ] G5d.3f evidence doc merged
- [ ] Preview smoke repeatable (Melhus / NO provider_admin)
- [ ] Rollback plan reviewed (flags + revert paths)
- [ ] Production flags **OFF** verified
- [ ] Golden Path PASS (91/91)
- [ ] provider-meny-visual PASS
- [ ] week-visual PASS
- [ ] No employee visibility of drafts
- [ ] No publish / order / week / Sanity coupling in G5d.3 chain
- [ ] Draft table RLS scoped to provider admin write
- [ ] Validation helpers reject runtime enablement fields
- [ ] API behind `LP_MENU_PROFILE_MAPPING_DRAFT_API` only
- [ ] UI behind triple-flag gate only
- [ ] Explicit GO recorded for G5d.4 (separate decision)

---

## 10. Explicit non-goals

G5d.3f and the G5d.3 chain do **not**:

- Start runtime cutover
- Enable publish shadow mode
- Change `/week` read path
- Integrate orders
- Expose drafts to employees
- Write to Sanity
- Touch billing or Tripletex
- Change `pricePreview` or `provider_price_rules` runtime
- Change `menuDayPayload` runtime
- Activate Production `LP_MENU_PROFILE_*` flags

---

## 11. Go/no-go recommendation

**Recommendation:** The G5d.3 chain (G5d.3b–G5d.3e) is **operationally ready for G5d.4 design and planning only** after this evidence document is reviewed and merged.

**G5d.4 execution** still requires:

- Explicit GO (separate approval)
- New flags (if any) default OFF in Production
- Protected Golden Path regression
- Contract tests for any new runtime touchpoint

**Do not interpret this document as authorization to start G5d.4 implementation.**

---

## 12. References

| Artifact | Path / link |
|----------|-------------|
| G5d cutover audit | `docs/engineering/G5d-menu-profile-cutover-audit.md` |
| G5d.3 persistence audit | `docs/engineering/G5d3-mapping-draft-persistence-audit.md` |
| Migration | `supabase/migrations/20260727120000_provider_menu_profile_runtime_mapping_drafts.sql` |
| Validation | `lib/menu-profile/runtimeMappingDraftValidation.ts` |
| Persistence | `lib/menu-profile/runtimeMappingDraftPersistence.server.ts` |
| API | `app/api/provider/menu-profile/mapping-draft/route.ts`, `…/archive/route.ts` |
| UI | `components/providers/ProviderMenuRuntimeMappingDraftSaveControls.tsx` |
| Governance | `tests/governance/g5d0-menu-profile-runtime-contracts.test.ts` |
| Golden Path | `npm run test:golden-path` |
