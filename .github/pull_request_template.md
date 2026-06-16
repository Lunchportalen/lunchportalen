## Summary

<!-- What changed and why -->

## Protected Golden Path

- [ ] This PR does **not** touch Protected Golden Path files
- [ ] This PR **does** touch Protected Golden Path — see below

If yes, PR body must include **`Protected Golden Path Impact`** and:

- [ ] Read-only audit included (files + blast radius)
- [ ] Regression tests included or updated (`npm run test:golden-path`)
- [ ] Rollback plan included
- [ ] No provider fallback introduced
- [ ] No hardcoded tenant (Pettersen/Melhus) in runtime
- [ ] No order write-path / `lp_order_set` change without explicit approval

### Provider production status flow

- [ ] This PR does **not** touch provider production flow
- [ ] This PR **does** touch provider production flow — confirm all below

If yes:

- [ ] Provider order card (`KitchenOrderCard`)
- [ ] Provider order loader / enrichment
- [ ] Order status transition (`lp_order_advance_status`, `orderStatus.ts`, actions)
- [ ] Cutoff behavior or `batch_derived_advance` GUC path
- [ ] Order status history trigger/table

Required when touching provider production:

- [ ] Read-only audit included
- [ ] Tests included (`providerProductionStatusFlow`, `providerProductionCutoff`)
- [ ] Rollback plan included
- [ ] Employee cutoff preserved for employees
- [ ] Provider scoping preserved (`provider_id`, `lp_assert_provider_kitchen_access`)
- [ ] Wrong provider still blocked
- [ ] Order write-path untouched
- [ ] `lp_order_set` untouched

See `docs/PROTECTED_GOLDEN_PATH.md`.

## Test plan

- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run build:enterprise`
- [ ] `npm run test:golden-path` (if protected path touched)
