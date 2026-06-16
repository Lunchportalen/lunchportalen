# Protected Golden Path

**Status:** LOCKED · Production pilot proven (Pettersen&Co / Melhus Catering AS)

This document defines the **Protected Golden Path** — the end-to-end order flow that must not regress. Future AI/Cursor changes and human PRs that touch sensitive files require explicit audit and regression coverage.

---

## 1. What is protected

The full chain from provider menu publish through employee order to provider order visibility:

1. Provider publishes menu
2. `menuDay` materializes to `menu_service_days`
3. `menu_service_day_items` exists
4. Employee sees `/week`
5. Employee selects category + variant
6. Employee submits order through the normal order path
7. Order is stored with correct `provider_id`, `company_id`, `location_id`, `user_id`, date, and choice/item identity
8. Duplicate active order is not created (idempotent / safe update per contract)
10. Provider sees order in `/leverandor/ordrer`
11. Provider card shows company, location, employee name/email, category, variant, quantity
12. Provider can advance order: **Mottatt → I produksjon → Klar for levering → Levert**
13. Employee cutoff after 08:00 Oslo does **not** block provider production status transitions
14. Employee cutoff **still** blocks employee order changes after 08:00
15. Wrong provider cannot see or update the order

**No runtime changes without explicit protected-path approval.**

---

## 2. Why it is protected

Lunchportalen has a **proven production pilot** for Pettersen&Co with Melhus Catering AS. This flow is live RC truth:

- Provider can publish menu
- Employee sees menu in `/week`
- Employee can place orders
- Order rows carry correct tenant scope
- Provider sees orders with employee + variant display
- Forgot-password / provider login works
- Pilot can start with manual control week 1

Breaking this path blocks commercial pilot execution. Governance, CI guards, and regression tests exist to prevent accidental AI or refactor damage.

---

## 3. Proven reference flow (fixtures/docs only)

| Field | Reference value |
|-------|-----------------|
| Company | Pettersen&Co |
| Provider | Melhus Catering AS |
| Location | Hovedlokasjon |
| Employee | Thomas Johansen · `thomas@pettersenco.no` |
| Order date | `2026-06-16` |
| Choice | `paasmurt` |
| Variant | `laks-eggerore` / `Laks & Eggerøre` |
| Display line | `Påsmurt · Laks & Eggerøre` |
| Status flow (UI → DB) | Mottatt (`ACTIVE`/`LOCKED`) → I produksjon (`PREPARED`) → Klar for levering (`DISPATCHED`) → Levert (`DELIVERED`) |

**Do not hardcode these IDs or emails in runtime (`app/`, `lib/` production paths).** Use only in tests, smoke scripts, and documentation.

---

## 3.1 Provider production status flow (LOCKED)

Proven in production (June 2026). This extends the golden path **after** order visibility.

### Protected behavior

1. **Provider sees only own orders** — `loadKitchenOrders` filters by `provider_id`; enrichment is scoped to those order IDs.
2. **Provider card shows** company, location, employee name/email, order line (`quantity · category · variant`), status pill, and primary action when `canAdvance`.
3. **Provider status progression** (Norwegian UI / `public.order_status`):

   | UI label | DB status | Action label |
   |----------|-----------|--------------|
   | Mottatt | `ACTIVE` / `LOCKED` | Start produksjon |
   | I produksjon | `PREPARED` | Klar for levering |
   | Klar for levering | `DISPATCHED` | Marker levert |
   | Levert | `DELIVERED` | (done) |

4. **Employee cutoff after 08:00 Oslo** must **not** block provider production advances — handled inside `lp_order_advance_status` via scoped `app.batch_derived_advance` GUC (not global trigger disable).
5. **Employee cutoff** must **still** block employee order mutations after 08:00 (`tg_orders_cutoff_0800` unchanged for normal paths).
6. **Provider scoping** — `lp_assert_provider_kitchen_access` + `hasProviderRole(..., provider_kitchen)` on server action; wrong provider cannot advance.
7. **Order write-path and `lp_order_set` are out of scope** for provider status work — status changes use `lp_order_advance_status` only.
8. **Status history** — `order_status_history` / `tg_order_status_history` must continue to record transitions (including batch-derived actor path).

### Key files (read-only reference)

| Layer | Files |
|-------|-------|
| UI | `components/providers/KitchenOrderCard.tsx`, `app/leverandor/ordrer/actions.ts` |
| Labels / progression | `lib/providers/kitchenOrderStatus.ts` |
| Loader + enrichment | `lib/providers/loadKitchenOrders.ts`, `lib/providers/providerOrderEnrichment.ts` |
| RPC wrapper | `lib/admin/orderStatus.ts` → `lp_order_advance_status` |
| DB | `supabase/migrations/*lp_order_advance_status*`, `*batch_order_status_sync*` (`orders_cutoff_0800`, `batch_derived_advance`) |

### Regression tests

- `tests/providers/providerProductionStatusFlow.test.ts` — full status chain + line preservation
- `tests/providers/providerProductionCutoff.test.ts` — cutoff vs provider GUC
- `tests/app/leverandor/ordrer.test.tsx` — card + action labels
- `tests/governance/protected-golden-path.test.ts` — source locks

**Follow-up:** Full browser e2e replay of Pettersen pilot status clicks is optional; contract tests above are required on every protected-path touch.

---

## 4. Audit map (read-only baseline)

| Protected component | Current files | Current tests | Missing guard (before this doc) | Protection added |
|---------------------|---------------|---------------|--------------------------------|------------------|
| Order write API | `app/api/orders/**`, `app/api/order/**` | `tests/api/orders-idempotency.test.ts`, `tests/api/orders-set-menu-scope.test.ts` | CI PR audit gate | `scripts/ci/guard-protected-golden-path.mjs` |
| `lp_order_set` RPC path | `lib/orders/rpcWrite.ts`, `lib/supabase/ensureRpc.ts`, migrations | `tests/integration/lp-order-set-*.integration.test.ts` | Same | Guard + integration tests |
| Week read model | `app/api/week/route.ts`, `lib/week/*`, `lib/orders/readers/getEmployeeWeekMenu.ts` | `tests/api/week-profile-lookup.test.ts`, `tests/week/*` | Same | Guard + governance tests |
| Menu materialization | `lib/menu-publish/syncMenuServiceDaysFromMenuDay.ts`, `syncMenuServiceDayItems.ts`, `resolveMenuDayProvider.ts` | `tests/lib/menu-publish/syncMenuServiceDaysProviderScope.test.ts`, `resolveMenuDayProvider.test.ts` | Same | Guard |
| Provider menu scope | `lib/menu/providerMenuScope.ts`, `lib/cms/menuDay.ts` | `tests/api/orders-set-menu-scope.test.ts` | Same | Guard |
| Active agreement gate | `lib/agreement/**`, `lib/orders/companyOrderEligibility.ts`, `lib/orders/orderWriteGuard.ts` | `tests/rls/domainHardening.agreementOrders.test.ts` | Same | Guard + governance tests |
| Cutoff | `lib/cutoff.ts`, `lib/date/oslo.ts`, order routes | Order route tests (cutoff branches) | Same | Governance source-lock tests |
| Provider order loader | `lib/providers/loadKitchenOrders.ts` | `tests/providers/kitchenOrderDisplay.test.ts` (loader guard) | Same | Guard |
| Provider order enrichment | `lib/providers/providerOrderEnrichment.ts` | `tests/providers/providerProductionStatusFlow.test.ts` | Same | Guard |
| Provider status RPC wrapper | `lib/admin/orderStatus.ts` | `tests/providers/providerProductionCutoff.test.ts` | Same | Guard |
| Provider status labels | `lib/providers/kitchenOrderStatus.ts` | `tests/providers/providerProductionStatusFlow.test.ts` | Same | Guard |
| Provider production cutoff | `supabase/migrations/*lp_order_advance_status*` | `tests/providers/providerProductionCutoff.test.ts` | Same | Guard + migration gate |
| Provider order card | `components/providers/KitchenOrderCard.tsx`, `lib/providers/kitchenOrderDisplay.ts` | `tests/app/leverandor/ordrer.test.tsx`, `kitchenOrderDisplay.test.ts` | Same | Guard |
| Provider page | `app/leverandor/ordrer/**` | `tests/app/leverandor/ordrer.test.tsx` | Same | Guard |
| Auth/profile for week/order | `lib/auth/getAuthContext.ts`, `lib/http/routeGuard.ts` | `tests/api/week-profile-lookup.test.ts` | Same | Guard |
| RLS / schema | `supabase/migrations/*.sql` | `tests/db/provider-rls.test.ts`, `tests/rls/*` | Migration gate (existing) | Golden path guard |
| No Melhus fallback | `lib/menu-publish/resolveMenuDayProvider.ts` | `tests/lib/menu-publish/resolveMenuDayProvider.test.ts`, `tests/menu-week-rollout.test.ts` | Same | Governance tests |
| No hardcoded pilot tenant | `app/`, `lib/` | `tests/governance/protected-golden-path.test.ts` | Same | Governance scan |

---

## 5. Sensitive files (PR must declare impact)

Prefix / path patterns enforced by CI:

- `app/api/orders/**`, `app/api/order/**`, `app/api/week/**`
- `lib/orders/**`, `lib/orderBackup/**`
- `lib/menu/providerMenuScope.ts`
- `lib/menu-publish/syncMenuServiceDaysFromMenuDay.ts`, `syncMenuServiceDayItems.ts`, `resolveMenuDayProvider.ts`, `menuDaySyncShared.ts`
- `lib/cms/menuDay.ts`, `lib/cms/menuDayProviderFilter.ts`
- `lib/providers/loadKitchenOrders.ts`, `providerOrderEnrichment.ts`, `kitchenOrderDisplay.ts`, `kitchenOrderStatus.ts`
- `lib/admin/orderStatus.ts`
- `components/providers/KitchenOrderCard.tsx`
- `app/leverandor/ordrer/**`
- `lib/agreement/**`, `lib/cutoff.ts`, `lib/date/oslo.ts`
- `lib/auth/getAuthContext.ts`, `lib/http/routeGuard.ts`, `lib/supabase/ensureRpc.ts`
- Active files: `supabase/migrations/<timestamp>_*.sql` (especially names containing `lp_order_advance_status`, `orders_cutoff`, `batch_derived_advance`, `order_status_history`)

Full list: `scripts/ci/guard-protected-golden-path.mjs` → `PROTECTED_GOLDEN_PATH_PREFIXES`.

---

## 6. What future PRs must not change without explicit approval

- Order write path semantics
- `lp_order_set` RPC contract or wrappers
- Schema / RLS / migrations affecting orders, agreements, menu_service_days
- Auth / profile lookup used by `/week` and order APIs
- Provider/company/location scoping rules
- Menu materialization provider binding
- Provider order read model tenant filter
- Provider production status flow (`lp_order_advance_status`, kitchen card, cutoff GUC path)
- Cutoff behavior
- Silent fallback to wrong provider (especially Melhus default for other providers)
- Hardcoded Pettersen/Melhus logic in runtime

---

## 7. Required tests before touching protected files

Run locally:

```bash
npm run typecheck
npm run lint
npm run build:enterprise
npm run test:golden-path
node scripts/ci/guard-protected-golden-path.test.mjs
```

Minimum regression coverage:

| # | Behavior | Primary test file |
|---|----------|-------------------|
| 1 | `/week` uses employee company/location/provider scope | `tests/api/week-profile-lookup.test.ts` |
| 2 | Published menu + variants visible to employee | `tests/week/*`, `tests/components/EmployeeWeekClient.test.tsx` |
| 3 | Order requires active agreement | `tests/rls/domainHardening.agreementOrders.test.ts` |
| 4 | Order stores provider/company/location scope | `tests/api/orders-set-menu-scope.test.ts` |
| 5 | Duplicate active order idempotent | `tests/api/orders-idempotency.test.ts` |
| 6 | Wrong provider cannot see order | `tests/db/provider-rls.test.ts`, loader guard |
| 7 | Provider card: employee name/email | `tests/app/leverandor/ordrer.test.tsx` |
| 8 | Provider card: variant title | `tests/providers/kitchenOrderDisplay.test.ts` |
| 9 | Category + variant: `Påsmurt · Laks & Eggerøre` | `tests/providers/kitchenOrderDisplay.test.ts` |
| 10 | Cutoff preserved | `tests/governance/protected-golden-path.test.ts` |
| 11 | No Melhus fallback for other providers | `tests/lib/menu-publish/resolveMenuDayProvider.test.ts` |
| 12 | No hardcoded Pettersen/Melhus in runtime | `tests/governance/protected-golden-path.test.ts` |
| 13 | Provider production GUC inside `lp_order_advance_status` | `tests/providers/providerProductionCutoff.test.ts` |
| 14 | Mottatt → I produksjon → Klar for levering → Levert | `tests/providers/providerProductionStatusFlow.test.ts` |
| 15 | Order line preserved across status transitions | `tests/providers/providerProductionStatusFlow.test.ts` |
| 16 | Provider scoping + employee cutoff preserved | `tests/providers/providerProductionCutoff.test.ts`, `providerProductionStatusFlow.test.ts` |

**Follow-up:** Full staging e2e for Pettersen pilot replay is documented in smoke scripts (`scripts/smoke/_prove-first-order.mjs`) — not required on every PR unless write-path changes.

---

## 8. Rollback expectation

If a protected-path change reaches production and breaks the pilot:

1. Revert the PR immediately (no forward-fix without audit)
2. Confirm `/week` → order → `/leverandor/ordrer` with Pettersen employee smoke
3. File incident with RID and affected commit SHA
4. Re-run `npm run ci:enterprise` on revert branch before redeploy

---

## 9. AI / Cursor instruction

**Protected Golden Path must not be changed without explicit protected-path audit.**

Before editing any sensitive file:

1. Read this document and `AGENTS.md` section **T) PROTECTED GOLDEN PATH**
2. Perform read-only audit: list files, tests, and blast radius
3. If task is UI polish elsewhere — **protected files are out of scope**
4. No broad refactors or “cleanup” across the protected path
5. No schema/RLS/order/auth changes without read-only audit
6. No fallback to wrong provider; no hardcoded customer/provider logic in runtime
7. If uncertain → **STOP** (fail-closed)

AI-generated patches touching protected files must include in PR description:

- Read-only audit summary
- Reason for change
- Exact files changed
- Regression tests updated/added
- Rollback plan

PR body must contain: **`Protected Golden Path Impact`** when sensitive files change.

Alternative approvals: update a listed regression test in the same PR, or apply label `protected-path-approved`.

---

## 10. Manual control rule (pilot week 1)

Pettersen pilot may run **manual control week 1**: operations may verify orders in provider UI before scaling automation. This does not relax:

- Tenant isolation
- Order write contract
- Cutoff rules
- Provider scope on menu publish

Manual control is an **operational** mode, not a code bypass.

---

## CI guard

Script: `scripts/ci/guard-protected-golden-path.mjs`

Runs on pull requests. If sensitive files change without audit signal → **fail**:

> Protected Golden Path touched without required audit/tests.

Harmless docs-only PRs and governance meta-files are exempt. Normal UI work outside sensitive paths is not blocked.
