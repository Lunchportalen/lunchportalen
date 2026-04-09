# Readiness for Phase 7 (pilot / editorial acceptance)

Phase 7 = pilot, training, rollout sequencing, **cutover execution** (outside this pack). This document is the **hard gate** before starting that work.

## 1. What must be true from Phase 5

| Requirement | Evidence |
|-------------|----------|
| Manifest + ETL design **signed** | `58` all YES |
| Parity rules agreed | `54` + sample full-run green on **staging** |
| Media + redirect **rules** complete | `55` |
| Freeze design **implemented** in **target** environment (or explicit waiver) | `56` + metrics plan |
| **No** silent transforms | Manifest audit |

## 2. What must be true from Phase 6

| Requirement | Evidence |
|-------------|----------|
| Three lanes + scopes **signed** | `68` all YES |
| Editor AI **no publish** verified in **staging** | Test script / signed QA note |
| Kill-switch **tested** | `64` verification |
| MCP boundary **acknowledged** by Engineering + Security | Runbook link |

## 3. What may still be deferred (with explicit acceptance)

| Item | Condition |
|------|-----------|
| **Nice-to-have** editor AI capabilities marked **Reject** in `62` | OK if not in pilot scope |
| **Advanced** redirect edge cases | Documented backlog |
| **Non-critical** locales | B2 must still be **signed** for **nb** minimum |

## 4. What absolutely may not remain ambiguous

| Item | Why |
|------|-----|
| **Sole authority** for migrated types | Dual write = program violation |
| **Published read path** | Phase 4 contract — must be operational on staging minimum |
| **Workflow** for publish | Governance parity |
| **Operational vs CMS** boundary | Legal/ops risk |

## 5. Go / no-go framework

**GO** when **all** hold:

1. Phase 4 exit satisfied **per program rules** (including PB handling).
2. Phase 5 exit (`58`) = YES.
3. Phase 6 exit (`68`) = YES.
4. Staging **end-to-end**: import → edit → Workflow publish → Next reads Delivery → **no** legacy write success for frozen routes.

**NO-GO** if **any**:

- Open **X1–X9** without dated risk acceptance.
- Parity full-run not green and not waived.
- AI publish path exists in tests.
- Secrets in browser bundles.

## 6. Roles

| Role | Decision |
|------|----------|
| CTO | Final GO for pilot start |
| Editorial lead | GO for content quality acceptance |
| Security | GO for identity + logging |
| Migration lead | GO for ETL readiness |
