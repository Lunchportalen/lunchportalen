# PHASE 17MENU — Norway-safe production release checklist

## Preconditions

- [x] Staging entitlement dual-write applied (`uigxsboqeruxflgzqztl`)
- [x] `npm run ci:phase17menu-gates` PASS
- [x] `npm run test:phase17menu` PASS
- [x] Norway adapter preserves `paasmurt` / `salatboks` / `varmmat` order keys
- [x] Other countries remain disabled in production activation table
- [x] MVA / Stripe / fiscal config untouched
- [x] Production deploy lock ACTIVE
- [x] Production migration lock ACTIVE

## Allowed production contents

- Canonical package category module
- Entitlement resolver (soft until `LP_PACKAGE_ENTITLEMENTS_RUNTIME=1`)
- Order snapshot types
- Sanity schema market fields (content remains NO until curated)
- i18n `timeZone`

## Forbidden in this release

- Enabling SE–CA (or any non-NO) ordering
- Auto-publishing generated menus
- Stripe enablement
- MVA 25% enablement
- Applying `20260905120000` to production without protected migrate path + owner approval

## Post-deploy verification

1. `/api/health` SHA matches exact deploy
2. Melhus Basis/Luxus/Enterprise order still works
3. `OTHER_COUNTRIES_DISABLED = 20/20`
4. `MVA_THRESHOLD_AUTOMATION_LIVE = YES`
5. Restore deploy/migration locks if temporarily lifted

## Status

**NORWAY_MENU_REGRESSION = PASS** (code-level adapter + golden-path key preservation)  
**Production deploy of this branch:** pending owner exact-SHA release (not executed in 17MENU implementation wave to respect deploy lock / no speculative prod push).
