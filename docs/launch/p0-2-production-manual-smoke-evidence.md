# P0-2 — Production manual smoke §9 archive

**Status:** Evidence run · docs-only · **P0-2 CLOSED**  
**Date:** 2026-07-01  
**Branch:** `audit/p0-2-production-manual-smoke`  
**Target:** `https://app.lunchportalen.no`  
**Operator:** Cursor agent (local Production smoke; no runtime changes)

---

## 1. Scope

| In scope | Out of scope |
|----------|--------------|
| Full §9 manual smoke on Production target | Runtime code changes |
| Provider + employee Golden Path tenant smoke | API / UI changes |
| Order create → provider visibility → status advance | DB / RLS changes |
| Forbidden-field / commercial leakage scan | Production env value changes |
| Production flag read-only check | Feature flag activation |
| Test order cleanup via employee cancel | G5d.8 · cutover · SoT switch · auto-rollout |
| Golden Path + governance gates post-smoke | P0-3..P0-5 closure |

**No secret values are recorded in this document.**

---

## 2. Production target

| Field | Value |
|-------|-------|
| URL | `https://app.lunchportalen.no` |
| Timestamp (start) | 2026-07-01T10:02:49Z |
| Timestamp (end) | 2026-07-01T10:04:48Z |
| Operator | Cursor agent (local Playwright smoke) |
| Browser / method | Playwright Chromium headless; `#login-email` / `#login-password` form login |
| Provider (masked) | `p***@melhuscatering.no` (hash `feecde3c43af`) |
| Employee (masked) | `t***@pettersenco.no` (hash `62f34cb467a4`) |
| Superadmin (masked) | `s***@lunchportalen.no` (hash `ad361c48f582`) — not valid on Production app |
| Provider tenant | Melhus Catering AS (Golden Path provider) |
| Company / location | Pettersen&Co · Hovedlokasjon |
| Data context | Real Production pilot data (owner-approved Golden Path reference) |

---

## 3. Pre-smoke checks

| Check | Result |
|-------|--------|
| Main merge SHA (P0-1) | `8e64448ccb66a0af9e55b81b8ead4fded5e18f2b` present on `main` |
| P0-1 status | **CLOSED** (`docs/launch/p0-1-employee-smoke-evidence.md`) |
| P0-2 before test | **OPEN** |
| Launch decision | **CONDITIONAL GO** (not full GO) |
| Local runtime changes | **NONE** |
| Production `LP_MENU_PROFILE_*` | **0** entries (`vercel env ls production`, names only) |
| Provider credentials | `MELHUS_PROVIDER_ADMIN_*` SET in operator `.env.local` |
| Employee credentials | `E2E_EMPLOYEE_*` SET in operator `.env.local` |
| Secret values in docs/logs | **no** |

---

## 4. Manual smoke checklist (§9 steps A–M)

| Step | Expected | Observed | Status | Evidence marker / RID | Notes |
|------|----------|----------|--------|----------------------|-------|
| **A** Provider login | Lands provider surface | `/leverandor` | **PASS** | provider hash `feecde3c43af` | 2026-07-01T10:04:19Z |
| **B** Provider menu | Published menu visible; no destructive publish | `/leverandor/meny`, Uke 27 | **PASS** | read-only confirm | No publish triggered |
| **C** Provider orders (initial) | Orders surface loads | `/leverandor/ordrer`, 0 cards (today view) | **PASS** | — | Today view empty before test order |
| **D** Employee login | Lands `/week` | `/week` | **PASS** | employee hash `62f34cb467a4` | 2026-07-01T10:04:26Z |
| **E** Employee `/week` | Days render; no leakage | 5 days; API 200 | **PASS** | `week_api_mr1wsafn_xiudy2` | Forbidden scan 0 hits |
| **F** Employee order | Test order via normal flow | `2026-07-02`, `paasmurt` / `laks-eggerore` | **PASS** | `rid_mr1wsdm7_4q855pene69rcjzw`, order `7ae0d1b8…` | weekOffset=0; note `P0-2-smoke` |
| **G** Provider receives order | Order visible scoped to Melhus | 1 card, Pettersen&Co | **PASS** | `/leverandor/ordrer?date=week` | No cross-provider data |
| **H** Cutoff | Past days locked; future orderable | Oslo 12:02; 2 past / 3 future menu days | **PASS** | policy Oslo 08:00 | Order on 2026-07-02 succeeded |
| **I** Allergens / special needs | Correct display if relevant | No allergen UI on sampled view | **NOT_APPLICABLE** | — | API includes `allergens` field on days |
| **J** Provider status flow | One safe advance | Mottatt → I produksjon | **PASS** | order `7ae0d1b8…` | Single step only |
| **K** Production / delivery list | Provider orders list in scope | `/leverandor/ordrer` | **PASS** | week view | Launch scope surface |
| **L** Billing / provision | Readonly; no employee commercial | `/leverandor/faktura` loads | **PASS** | manual first invoice QA | No Tripletex auto go-live |
| **M** Support / diagnose | Safe RID trace | order + week RID captured | **PASS** | see §8 | Superadmin login N/A on Production |

---

## 5. Employee leakage scan

| Scan | Result |
|------|--------|
| `/api/week` forbidden keys | **PASS** — 0 hits |
| `/week` page forbidden visible | **PASS** — 0 hits |
| `/week` commercial visible | **PASS** — 0 hits |
| Order API forbidden keys | **PASS** — 0 hits |
| **Overall** | **PASS** |

Forbidden fields checked include: `providerId`, `providerInternal`, `compatibilityDecision`, `compatibilityCutover`, `weekRuntimeCompatibilityDecision`, `opsLog`, `pricePreview`, `provider_price_rules`, `commission`, `provisjon`, `vat`, `mva`, `commercialVisibleChanges`, `priceVisibleChanges`, `candidateOrderable`, `orderableCandidate`, `sourceOfTruthChanged`, `sourceOfTruthSwitch`, `autoRollout`, `runtimeHookActive`.

---

## 6. Test order / cleanup record

| Field | Value |
|-------|-------|
| Test order created? | **yes** |
| Safe order marker | `7ae0d1b8…` |
| Order RID | `rid_mr1wsdm7_4q855pene69rcjzw` |
| Date | `2026-07-02` |
| Meal (safe summary) | Påsmurt · Laks & Eggerøre |
| Note in order | `P0-2-smoke test order — safe to cancel` |
| Cleanup action | Employee `POST /api/orders` `action: cancel` |
| Cancel RID | `rid_mr1wstek_zlhtfh7goziv8h56` |
| Cancel result | **200 OK** |
| Billing exclusion | Cancelled before invoice QA; exclude from manual first invoice |
| Owner | Thomas (operator) |
| Final status | **cancelled / cleaned up** |

---

## 7. Production flag evidence

| Check | Result |
|-------|--------|
| Method | `vercel env ls production` (names only; values not printed) |
| `LP_MENU_PROFILE_*` count | **0** |
| `LP_MENU_PROFILE_RUNTIME_COMPATIBILITY_HOOK` | **absent** |
| `LP_MENU_PROFILE_EMPLOYEE_PROFILE_RUNTIME` | **absent / not implemented** |
| Timestamp | 2026-07-01T10:02Z |
| **Result** | **PASS** — no Production flag activation |

---

## 8. Golden Path and gates

| Command | Result | Timestamp |
|---------|--------|-----------|
| `npm run test:golden-path` | **91/91 PASS** | 2026-07-01 |
| `npm run typecheck` | **PASS** | 2026-07-01 |
| `npm run lint` | **PASS** | 2026-07-01 |
| `npm run ci:commercial-hardcodes-guard` | **PASS** | 2026-07-01 |
| `live-readiness-launch-audit-contracts.test.ts` | **18/18 PASS** (pre-PR); **24/24 PASS** (with P0-2 guards) | 2026-07-01 |

---

## 9. Conclusion

| Field | Value |
|-------|-------|
| **P0-2 status** | **CLOSED** |
| **Launch decision** | Remains **CONDITIONAL GO** (P0-3..P0-5 still open) |

### Closed because

1. Full Production manual smoke §9 executed on `https://app.lunchportalen.no`.  
2. Provider login, menu, orders, employee `/week`, order create, provider visibility, status advance — **PASS**.  
3. Forbidden-field / commercial leakage scan — **PASS**.  
4. Test order created, advanced once, **cancelled** via employee flow.  
5. Production `LP_MENU_PROFILE_*` absent in Vercel Production env.  
6. Golden Path **91/91 PASS**; local gates green.  
7. No runtime changes · no Production env values exposed · no flag activation.

### Remaining P0 (not in scope for P0-2)

| ID | Status |
|----|--------|
| P0-3 | OPEN — Production env owner sign-off |
| P0-4 | OPEN — on-call not named |
| P0-5 | OPEN — cross-tenant negative test |

### Next P0

**P0-3** — Production env owner sign-off (Vercel audit + system health NORMAL).
