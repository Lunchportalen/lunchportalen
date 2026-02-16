# ROLE MATRIX (LOCKED)

Last Updated: 2026-02-16  
Decision ID: SEC-KD-SCOPE-2026-02-16

## Locked Decision
- `kitchen` and `driver` are `TENANT-BOUND`.
- Required scope: `company_id` + `location_id` on profile.
- Missing scope is fail-closed: `403` + code `SCOPE_NOT_ASSIGNED`.

## Access Matrix
| Role | Orders Read | Orders Write | Scope |
|---|---|---|---|
| `superadmin` | Global (approved superadmin routes) | According to route contract | Global |
| `company_admin` | Own tenant | Own tenant policies/routes | `company_id` |
| `employee` | Own order + approved views | Own order RPC-only | `company_id` + user binding |
| `kitchen` | Own `company_id` + `location_id` only | No direct order writes | `company_id` + `location_id` |
| `driver` | Own `company_id` + `location_id` only | Delivery-specific approved actions only | `company_id` + `location_id` |

## Endpoint Scope Notes
- Kitchen/driver endpoints must pass:
  - role check
  - scope check (`company_id` + `location_id`)
- Any missing assignment must return explicit deny, not empty list.
