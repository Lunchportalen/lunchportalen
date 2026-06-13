# RLS POLICIES (LOCKED EXCERPT)

Last Updated: 2026-02-16  
Decision ID: SEC-KD-SCOPE-2026-02-16

## Kitchen/Driver Scope Enforcement
- Policy: `orders_kitchen_driver_scope_read`
- Table: `public.orders`
- Rule:
  - If current user is not `kitchen`/`driver`, policy does not restrict that user path.
  - If current user is `kitchen`/`driver`, row is visible only when:
    - profile is active
    - `company_id` and `location_id` are assigned
    - row `company_id` + `location_id` match profile scope

## Fail-Closed Rationale
- Scope ambiguity is treated as access failure.
- Prevents cross-tenant reads through broad joins or missing filters.
- Produces deterministic deny behavior aligned with API guards (`SCOPE_NOT_ASSIGNED`).
