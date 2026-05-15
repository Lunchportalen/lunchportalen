# Order Price Read Audit — 2026-05-16

Audit performed after FASE 13-IMPL-3F (employee price hiding) and FASE 13-IMPL-3I (kitchen/driver/cron consolidation).

## Scope

All TypeScript files under `app/`, `lib/`, `scripts/` that:

1. Read from the `orders` table via `.from("orders")`
2. Reference any of these price tokens in the same module:

   - subtotal_cents_ex_vat
   - vat_cents
   - gross_cents_inc_vat
   - unit_price_cents_ex_vat
   - line_subtotal_cents_ex_vat
   - line_vat_cents
   - line_total_cents_inc_vat
   - vat_rate_snapshot
   - offered_price_cents_ex_vat
   - unit_price_nok
   - line_total

## Method

Per-file review of every `.select()` call against `orders`, `order_items`, and `menu_service_day_items`. Classified each module as:

- **A** — Legitimate price use (invoicing, metrics, attribution, admin reports)
- **F** — False positive (price token in file but not in orders-select)
- **B** — Dead code (price in select, not used downstream)

No `order_items` or `menu_service_day_items` reads appeared in this cohort under the same heuristic.

## Results

| Classification   | Count | Outcome           |
| ---------------- | ----- | ----------------- |
| A — legitimate   | 23    | No change needed  |
| F — false positive | 2     | No change needed  |
| B — dead code      | 0     | None found        |

## A — Legitimate price use (23 files)

| File | Role |
| ---- | ---- |
| `app/api/admin/orders/route.ts` | Company/superadmin admin orders list; selects roll-up price fields via `ORDER_PRICE_FIELDS_ONLY`. |
| `app/api/orders/route.ts` | Post-order hooks: `line_total` for experiment revenue insert and AI conversion tracking. |
| `app/api/superadmin/companies/[companyId]/archive/orders/route.ts` | Archived company order export; `line_total`, `unit_price`, `tier`, `currency` for audit/CSV. |
| `app/api/superadmin/companies/[companyId]/archive/summary/route.ts` | Archive economic summary; `line_total` + `currency` aggregation. |
| `lib/api/publicOrders.ts` | Tenant-scoped public order projection; `line_total` explicitly in `PublicOrderRow` (service-role, bounded). |
| `lib/autopilot/metrics.ts` | Unified autopilot metrics; sums `line_total` / `total_amount` over window. |
| `lib/autopilot/runner.ts` | Experiment evaluation; `line_total` + `attribution` per variant revenue. |
| `lib/controlTower/aggregator.ts` | Control Tower; day/week order slices with `line_total` + attribution for revenue rollups. |
| `lib/cto/data.ts` | CTO collection; `line_total` + `total_amount` for downstream KPI reduce (see `lib/cto/model.ts`). |
| `lib/finance/runInvestorValuation.ts` | Indicative valuation; `line_total` + `created_at` for KPI/ARR/growth. |
| `lib/growth/aggregateGrowth.ts` | Growth scoring; `line_total` for SoMe post revenue; separate count-only select without price. |
| `lib/growth/channelPerformance.ts` | Channel map; `line_total` attributed via `social_post_id` / `attribution`. |
| `lib/metrics/live.ts` | Live order metrics pitch path; sums `line_total`. |
| `lib/mvo/runMvoEvaluation.ts` | MVO combo evaluation; `line_total` + `total_amount` + variant dims. |
| `lib/observability/graphMetrics.ts` | Observability graph; sampled orders with `line_total` for revenue breakdown. |
| `lib/orders/readers/getOrderForScopedUser.ts` | Single-order read; `pickOrderColumns(showPrices)` — prices only when `showOrderPricesForApiRole` allows (company admin). |
| `lib/platform/engine.ts` | Platform pulse; sample of `line_total` for network/value heuristics. |
| `lib/predictive/data.ts` | Predictive series; `line_total` + `attribution` + `date`/`status` for daily points. |
| `lib/revenue/applyLeadPipelineOrderAttribution.ts` | Lead pipeline close + SoMe metrics; multiple reads with `line_total`. |
| `lib/revenue/collect.ts` | Revenue collector; orders slice with `line_total` + attribution fields. |
| `lib/revenue/getRevenueByPost.ts` | Revenue-by-post helper; `line_total` + `social_post_id` / `attribution`. |
| `lib/strategy/collect.ts` | Strategy system bundle; windowed orders with `line_total` for `totalRevenue` + count-only queries. |
| `scripts/testSocialFlow.ts` | Manual/diagnostic script; `line_total` for revenue-by-post logging (and count-only `*` head query). |

## F — False positives (2 files)

- **`app/api/admin/invoices/csv/route.ts`** — Reads only `date`, `location_id`, `slot`, `status` from `orders`. CSV `unit_price_nok` / amounts come from agreement tier resolution, not from order row economics in this select.
- **`app/api/superadmin/invoices/csv/route.ts`** — Same pattern: narrow `orders` select (`company_id`, `date`, `location_id`, `slot`, `status`); unit prices from `unitPriceNOK(tier)` / pricing helpers.

## Conclusion

The codebase has no inadvertent price exposure paths from **unused columns in `orders` selects** (Bøtte B was empty). The two CSV routes illustrate why file-level grep without select-level review over-counts.

The only **scoped single-order** path where roll-up price fields can appear for a non-superadmin API role is `getOrderForScopedUser` when `showOrderPricesForApiRole` returns true — i.e. **`company_admin`** for that company (not `employee`, `kitchen`, or `driver`). Employee-facing list/detail APIs should continue to use employee projections / views per 3F.

## Future maintenance

When adding new `orders` reads:

1. Use named projection constants from `lib/orders/projection.ts` where applicable.
2. Default to employee-safe column lists unless price is required.
3. If price is required: add a short comment justifying use (faktura / admin / metrics / attribution / archive).
4. Re-run this audit periodically (or after large order-reader refactors).

## Strict vs broad heuristic

- **Strict** (price tokens above **excluding** `line_total`): 4 files — same conclusions collapse to 2× A + 2× F.
- **Broad** (+ `line_total`): 25 files — table in this document.
