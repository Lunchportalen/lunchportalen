# Readiness for Phase 8 freeze (gate only)

This document defines **readiness to begin Phase 8 freeze planning**. It **does not** execute freeze, implement guards, or schedule cutover.

## 1. What must be true from Phase 7

| Requirement | Evidence |
|-------------|----------|
| [`83-phase-7-exit-checklist.md`](./83-phase-7-exit-checklist.md) **all YES** | Signed checklist + bundle E1–E8 ([`76`](./76-editorial-acceptance-metrics-and-evidence.md)) |
| **No** chronic engineer shadowing | A1, A7 green |
| **Preview trust** | A4 green ([`77`](./77-workflow-preview-publish-validation.md)) |
| **Workflow governance** | A3 green |
| **Legacy register clean** | [`78`](./78-legacy-dependency-and-escape-hatch-register.md) |

## 2. What must still be true from Phase 4

| Requirement | Evidence |
|-------------|----------|
| Published **Delivery** contract operational on **staging minimum** | Phase 4 exit row 15 + smoke logs |
| **Preview** contract implemented **as validated** in pilot | S6 evidence |
| **Media Delivery** separate and working | Phase 4 / pilot S4 |
| **Cache / webhook** rules owned | [`45`](../phase-4/45-cache-invalidation-and-topology.md), [`46`](../phase-4/46-webhooks-and-revalidation-contract.md) |
| **PB1–PB6** closed or **accepted** with date | [`51`](../phase-4/51-open-blockers-phase-4.md) |

## 3. What must still be true from Phase 5

| Requirement | Evidence |
|-------------|----------|
| Migration **manifest** complete; **no** silent field loss | Phase 5 exit `58` |
| **Parity** rules and **staging** full-run or waiver | [`54`](../phase-5-6/54-content-parity-validation-and-diff-rules.md) |
| **Legacy write-freeze** design + **observation** plan | [`56`](../phase-5-6/56-legacy-write-freeze-and-readonly-enforcement.md) |
| **B1/B2/B3** per row 13 | [`72`](../phase-5-6/72-open-blockers-phase-5-6.md) clean or accepted |

## 4. What must still be true from Phase 6

| Requirement | Evidence |
|-------------|----------|
| **No silent publish** for AI/automation | Phase 6 exit rows 5–6 |
| **API User** scopes documented | [`63`](../phase-5-6/63-automation-api-user-and-scope-matrix.md) |
| **MCP** non-prod boundary acknowledged | [`66`](../phase-5-6/66-developer-mcp-boundary-and-nonprod-rules.md) |
| **Browser secret exposure** forbidden by review | Phase 6 exit row 10 |

## 5. What may remain deferred (explicit)

| Item | Condition |
|------|-----------|
| **Nice-to-have** editor AI capabilities (Phase 6 **Reject**) | Not required for freeze if not in scope |
| **Advanced redirect** edge cases | Documented backlog; **no** dual-write |
| **Cosmetic** Umbraco UX P3 | Backlog OK |

## 6. What absolutely may not remain ambiguous

| Item | Why |
|------|-----|
| **Sole authority** for migrated types | Dual write = program violation |
| **Workflow** as publish path | Governance |
| **Preview vs published** semantics | Trust + SEO |
| **Locale** rules for public URLs | Correctness |
| **Operational vs CMS** boundary | Scope law |

## 7. Go / no-go framework for starting Phase 8 freeze planning

**GO** when **all** hold:

1. Phase 7 exit ([`83`](./83-phase-7-exit-checklist.md)) = **all YES** with signatures.
2. Phase 4–6 exits satisfied **per program** (same as [`73`](../phase-5-6/73-phase-5-6-readiness-for-phase-7.md) **plus** Phase 7 evidence).
3. **No** open **P0** defects from pilot affecting migrated types.
4. **CTO** + **Product / editorial signoff owner** **written** GO.

**NO-GO** if **any**:

- Open **U-** blockers ([`82`](./82-open-blockers-phase-7.md)) without dated acceptance.
- **Legacy** editor dependency for migrated types.
- **Preview** or **Workflow** validation failed in pilot.
- **Evidence bundle** incomplete.

## 8. Explicit deferrals

Phase 8 **freeze planning** document set is **out of scope** here — once this gate is GO, a **separate** Phase 8 pack may define freeze mechanics (guards, runbooks, comms).
