# NORWAY MENU CAPACITY PRODUCTION E2E

**Status:** `NORWAY_MENU_CAPACITY_PRODUCTION_E2E_PASS`
**Acceptance run:** `norway-menu-capacity-e2e-20260730T221016Z-35925d0f`
**Production SHA tested:** `35925d0ffe5ab72d7d35c17a9dc8381d2eccdc3c`
**Migration head:** `20260909120200`
**Workflow run:** `local`

## Capacity

- Schema: explicit `provider_capacity_policy` + `dish_day_capacity` (UNLIMITED | LIMITED | CLOSED)
- Migration: `20260909120000_norway_enterprise_explicit_capacity`
- Implicit unlimited providers: **0**
- Concurrency: 50/50 accepted of 100 (reserved=50)
- Cancel release: reserved after cleanup = 0

## Warm dish

- Dataset: production
- Common dish across BASIS/LUXUS/ENTERPRISE: measured
- Duplicate warm dishes: 0
- Sample: {"date":"2026-08-03","title":"Korma med røde linser og ris og naan","ids":["menuDay-2026-08-03-BASIS-varmrett","menuDay-2026-08-03-ENTERPRISE-varmrett","menuDay-2026-08-03-LUXUS-varmrett"],"tiers":["BASIS","ENTERPRISE","LUXUS"]}

## Orders / finance

- Orders exercised: eb7921d8-4887-4b4f-820b-5a1a84315056, ecb48faa-c34c-4f92-9fad-7c06b6caf58b
- Exact 5% commission gate: PASS
- Commission reversal: PASS

## Auth / RLS

- AUTH: PASS
- RLS: PASS
- SECRET_EXPOSURES: 0

## Final counters

```json
{
  "CAPACITY_OVERSELL": 0,
  "ORPHAN_CAPACITY_RESERVATIONS": 0,
  "DUPLICATE_CAPACITY_RESERVATIONS": 0,
  "NEGATIVE_REMAINING_CAPACITY": 0,
  "CANCEL_RELEASE_DIFFERENCE": 0,
  "DUPLICATE_WARM_DISHES": 0,
  "DUPLICATE_ORDERS": 0,
  "DUPLICATE_CANCELLATIONS": 0,
  "WRONG_PROVIDER_MENU": 0,
  "WRONG_DATE_MENU": 0,
  "WRONG_COUNTRY_MENU": 0,
  "CROSS_TENANT_FAILURES": 0,
  "WRONG_PROVIDER_ACCESS": 0,
  "PRODUCTION_DIFFERENCE": 0,
  "PACKING_DIFFERENCE": 0,
  "DELIVERY_DIFFERENCE": 0,
  "CAPACITY_DIFFERENCE": 0,
  "FINANCIAL_DIFFERENCE": 0,
  "COMMISSION_DIFFERENCE": 0,
  "SECRET_EXPOSURES": 0,
  "STRIPE_CALLS": 0,
  "REAL_EXTERNAL_NOTIFICATIONS": 0,
  "ACTIVE_TEST_ORDERS": 0,
  "RESERVED_TEST_CAPACITY": 0,
  "PLACEHOLDER_CONTENT": 0,
  "DRAFT_LEAKS": 0
}
```

## Failed gates

_none_
