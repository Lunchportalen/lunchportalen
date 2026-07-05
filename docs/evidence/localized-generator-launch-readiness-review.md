# Localized fixed menu generator — Launch readiness review

**Status:** Evidence archived · docs-only · **review complete**  
**Date:** 2026-07-05  
**Main HEAD at review:** `246d1ae8bc727475c0c0ac833b113b97d24e4bd6` — 9-locale staging matrix evidence (#423)  
**Review type:** Read-only GO/NO-GO assessment · **no production apply · no SOT · no auto-rollout**

This document archives the **launch readiness review** performed after the localized generator evidence chain (#415–#423) was complete on main. It is planning and decision evidence only — not authorization to apply, cut over SOT, or enable auto-rollout.

**No secret values, tokens, passwords, connection strings, or private tenant PII are recorded.**

---

## 1. Current status

| Item | State |
|------|-------|
| Main HEAD | `246d1ae8` — `docs(menu): archive localized generator 9-locale staging matrix evidence (#423)` |
| Evidence chain | **Complete** (#415 → #423) |
| Production generator runtime | `325afbce` (PR #420 dryRun idempotency) |
| `LP_MENU_PROFILE_RESOLVER` | **ON** (production) |
| `LP_LOCALIZED_FIXED_MENU_GENERATOR` | **ON** (production) |
| Melhus canary apply | **PASS** (week `2031-03-31`, strict mode, drafts unpublished) |
| PR #420 production dryRun idempotency | **PASS** (`createdDraftDays=0`, vegetarian skipped) |
| 8/8 generator capability | **PASS** · `unsupportedCategories=[]` |
| Production apply beyond canary | **NOT RUN** |
| SOT | **NOT STARTED** |
| Auto-rollout | **NOT STARTED** |
| Order write-path · `lp_order_set` | **NOT TOUCHED** |
| DB / RLS | **UNCHANGED** |

---

## 2. Evidence completeness — **PASS**

| PR | Capability | Archive |
|----|------------|---------|
| [#415](https://github.com/Lunchportalen/lunchportalen/pull/415) | Localized fixed provider menu generator | Code |
| [#416](https://github.com/Lunchportalen/lunchportalen/pull/416) | Localized provider menu surface (labels + fixed choices) | Code |
| [#418](https://github.com/Lunchportalen/lunchportalen/pull/418) | Enterprise provider apply flow (full week menu) | Code |
| [#419](https://github.com/Lunchportalen/lunchportalen/pull/419) | Production apply safety (`create_missing_only_strict`) | Code |
| [#420](https://github.com/Lunchportalen/lunchportalen/pull/420) | Catalog dryRun idempotency (`sanityServer` + `isProviderScoped`) | Code |
| [#421](https://github.com/Lunchportalen/lunchportalen/pull/421) | Production evidence archive | [`localized-generator-production-evidence.md`](./localized-generator-production-evidence.md) |
| [#422](https://github.com/Lunchportalen/lunchportalen/pull/422) | SOT / rollout readiness runbook (plan only) | [`../runbooks/localized-generator-sot-rollout-readiness.md`](../runbooks/localized-generator-sot-rollout-readiness.md) |
| [#423](https://github.com/Lunchportalen/lunchportalen/pull/423) | 9-locale staging matrix evidence | [`localized-generator-9-locale-staging-matrix-evidence.md`](./localized-generator-9-locale-staging-matrix-evidence.md) |

**Gap (operational, not documentary):** No production session archive yet for a **second provider** or **non-nb market** read-only dryRun.

---

## 3. Readiness review result

### 3.1 Summary matrix

| Area | Verdict | Notes |
|------|---------|-------|
| Evidence completeness | **PASS** | Full PR + evidence chain on main |
| 9-locale readiness | **PASS (staging) · PARTIAL (production)** | All 9 locales PASS on staging (#423); production apply evidence only for nb-NO / Melhus |
| Provider rollout readiness | **GATED (Phase B)** | Runbook phase A complete; Phase B+ requires scoped GO per provider |
| Production canary state | **PASS** | Melhus far-future week; orders unchanged; catalog `_rev` protected |
| Strict apply safety | **PASS** | #419 + #420; idempotent dryRun proven prod + staging |
| Employee safety | **PASS / caveat** | `employeeSafe` mapper PASS; `/api/week` reflects published menu until publish |
| Rollback readiness | **Documented · partially proven** | Runbook §6; flag OFF documented; formal post-canary rollback drill not archived |

### 3.2 Runbook phase position

| Phase | Description | Status |
|-------|-------------|--------|
| **A** | Canary complete | **PASS** |
| **B** | Single provider apply (beyond canary) | **NOT AUTHORIZED** without scoped GO |
| **C** | Multi-provider rollout | **NOT STARTED** |
| **D** | SOT activation | **NOT STARTED** |
| **E** | Auto-rollout | **DEFERRED** |

### 3.3 9-locale staging matrix (reference)

All locales **PASS** on staging — see [`localized-generator-9-locale-staging-matrix-evidence.md`](./localized-generator-9-locale-staging-matrix-evidence.md).

| Locale | `menuProfileId` | Staging result |
|--------|-----------------|----------------|
| nb-NO | `norwegian_company_lunch` | PASS |
| sv-SE | `swedish_lunch` | PASS |
| da-DK | `danish_office_lunch` | PASS |
| fi-FI | `finnish_office_lunch` | PASS |
| de-DE | `german_business_lunch` | PASS |
| en-GB | `uk_office_lunch` | PASS |
| fr-FR | `french_dejeuner` | PASS |
| es-ES | `spanish_menu_del_dia` | PASS |
| it-IT | `italian_office_lunch` | PASS |

---

## 4. Known limitations (accepted · documented)

1. **15 tier-docs per 5-day week** — Apply creates 15 `menuDay` documents (5 weekdays × BASIS/LUXUS/ENTERPRISE), not 5 single docs.
2. **Week-aggregated catalog merge** — Fixed categories apply via provider-scoped `lunchCategory` docs at week level, not per-day catalog rows.
3. **Drafts are not employee-visible until publish** — Generator apply creates draft Sanity docs only; employee `/week` consumes materialized published menu.
4. **No SOT / auto-rollout** — No cutover flag or batch apply exists; separate design GO required for SOT.
5. **Generator ON but further applies require scoped GO** — Panel and apply route are live in production; each apply session needs operator GO.
6. **Non-nb markets need production dryRun spot-check** — Before first production apply in a non-nb locale, run read-only dryRun on a far-future week for that provider/profile.
7. **Strict-mode vegetarian catalog** — First locale apply may create provider-scoped vegetarian catalog; subsequent locales skip under strict mode (expected).

---

## 5. Remaining launch risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Only **one production provider** (Melhus) with apply evidence | Medium | Per-provider dryRun + scoped GO before any new apply |
| **Non-nb production dryRun** not yet executed | Medium | Read-only production dryRun per market before first apply in that locale |
| Employee **`/api/week`** reflects published menu until publish | Medium | Use `employeeSafe` week-preview for generator proof; post-publish employee spot-check when drafts are promoted |
| **SOT design doc** missing | High (for SOT) | Plan-only SOT design before any SOT GO |
| **Formal rollback drill archive** missing after final canary state | Low–Medium | Execute and archive draft-only rollback drill before near-term weeks or publish |
| Operator confusion on **15 docs/week** model | Low | Runbook + evidence; training |
| Deploy drift after generator-touching changes | Low | Re-run production dryRun after any deploy touching generator path |

---

## 6. Decision

| Question | Verdict |
|----------|---------|
| **Ready for next provider apply?** | **CONDITIONAL GO** — one provider at a time; dryRun-first; explicit operator GO; read-back + post-dryRun idempotency; far-future week default |
| **Ready for SOT?** | **NO-GO** — requires Phase C stability, publish workflow proof, rollback drill, SOT design GO |
| **Ready for auto-rollout?** | **NO-GO** — explicitly **DEFERRED** |

### 6.1 Phase B entry criteria (per provider)

Before any production apply beyond existing Melhus canary:

1. Pre-snapshot (orders, catalog `_rev`, target week menuDays)
2. dryRun PASS — `create_missing_only_strict` · `unsupportedCategories=[]` · no catalog `would_update`
3. Operator GO review
4. Single-session apply with idempotencyKey
5. Sanity read-back (15 tier-docs if full week; all draft flags)
6. Post-apply dryRun idempotent
7. Safety regression (order count, employee APIs, economy/metadata scan)

---

## 7. Authorized next actions (each requires separate scoped GO)

| Action | Scope |
|--------|-------|
| Production **dryRun-only** re-check | Melhus or target provider · far-future week · after any generator deploy |
| Optional **second nb-NO provider apply** | Runbook §3 sequence · far-future week · strict mode only |
| **Non-nb production dryRun spot-check** | Read-only · per market · before first non-nb production apply |

---

## 8. Not authorized (without separate GO)

- SOT activation or cutover
- Auto-rollout or batch/cron apply
- Multi-provider apply in one session
- Publish as part of apply
- Near-term weeks (live order risk)
- Additional production flags
- Sanity mutation outside controlled apply session
- Order write-path · `lp_order_set` · DB/RLS changes
- `replace_catalog_with_confirmation` without explicit phrase + token + GO

---

## 9. Protected Golden Path impact

| Area | Impact |
|------|--------|
| Order write-path · `lp_order_set` | **None** |
| Employee order flow | **None** from review/archive |
| Provider production status flow | **None** — canary used future-week drafts only |

---

## 10. Related documents

| Document | Role |
|----------|------|
| [`localized-generator-production-evidence.md`](./localized-generator-production-evidence.md) | Production canary + dryRun evidence |
| [`localized-generator-9-locale-staging-matrix-evidence.md`](./localized-generator-9-locale-staging-matrix-evidence.md) | 9-locale staging matrix |
| [`../runbooks/localized-generator-sot-rollout-readiness.md`](../runbooks/localized-generator-sot-rollout-readiness.md) | Rollout gates · rollback · observability |
| [`../PROTECTED_GOLDEN_PATH.md`](../PROTECTED_GOLDEN_PATH.md) | Order write-path lock |

---

## 11. Recommendation

The localized generator is **enterprise-ready at the platform layer** for **controlled Phase B rollout** (scoped, dryRun-first, one provider at a time). **Do not** start SOT, auto-rollout, or production apply without a separate, scoped operator **GO** per session.

**STOP.** This review does not authorize SOT, auto-rollout, production apply, Sanity mutation, flag activation, or order-path changes.
