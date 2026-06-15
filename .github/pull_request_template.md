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

See `docs/PROTECTED_GOLDEN_PATH.md`.

## Test plan

- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run build:enterprise`
- [ ] `npm run test:golden-path` (if protected path touched)
