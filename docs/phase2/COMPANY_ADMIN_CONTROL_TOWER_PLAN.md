# Phase 2 — Company admin control tower (plan)

**Role:** `company_admin` — tenant-scoped; server truth `profiles.company_id` (AGENTS.md C3, D4).

## 1. Existing `/admin` routes (inventory)

Representative pages under `app/admin/**`:

| Route area | Purpose |
|------------|---------|
| `app/admin/page.tsx` | Dashboard entry |
| `app/admin/people/page.tsx`, `ansatte`, `employees`, `users` | People / users |
| `app/admin/locations/page.tsx` | Locations |
| `app/admin/agreement/page.tsx` | Agreement insight |
| `app/admin/orders/page.tsx` | Orders (admin context) |
| `app/admin/insights/page.tsx`, `dashboard` | Metrics |
| `app/admin/baerekraft/page.tsx` | Sustainability / ESG |
| `app/admin/history/page.tsx`, `audit` | History / audit |
| `app/admin/control-tower/page.tsx` | Control tower (naming aligns with “tower” concept) |
| `app/admin/invite`, `firma-onboarding`, `companies` | Onboarding / invites |

*Exact file list may evolve; grep `app/admin` for source of truth.*

## 2. Required capability areas (from product brief)

| Capability | Direction | Risk |
|------------|-----------|------|
| **Ansatte** | Use existing people/employees routes; unify naming in UI | Low if read-only lists stay tenant-scoped |
| **Lokasjoner** | `locations` | Medium |
| **Økonomi** | Tie to existing billing/insights APIs — **no vanity numbers** (AGENTS.md S5) | High — must use real aggregates |
| **Fakturaer** | Existing invoice CSV/API surfaces (`app/api/admin/invoices/**` per grep history) | High — contract |
| **Avtaleinnsyn** | `agreement` page + `currentAgreement` | Medium |
| **Oppsigelse / fornyelse** | Legal/process — likely agreement metadata; **requires product spec** | High |
| **Påminnelse 3 mnd før binding** | Scheduler + notification — **new**; must not ship without data model review | High |

## 3. Control tower UX (conceptual)

- **One entry:** `/admin` dashboard with **3 signals + 1 primary action** per view (AGENTS.md B2 1–3–1 rule) where applicable.
- **No duplicate KPIs** across dashboard and insights unless explicitly different time windows.
- **Mobile:** Admin is less critical than employee/driver; still readable without zoom.

## 4. Implementation strategy

1. **Map** each capability to **existing** page + API (consumer map).
2. **Fill gaps** with new UI only where API already exists; otherwise **document** API gap.
3. **Avoid** new parallel admin apps or routes outside `/admin`.

## 5. Sensitive dependencies

- `lib/auth/scope.ts`, `getScopeServer`
- All `app/api/admin/**` routes — tenant isolation tests
- Onboarding flows — frozen per AGENTS.md A1.5

## 6. Phase placement

- **Company admin polish** fits **Phase 2C** after CMS/media foundations — see `PHASE2_IMPLEMENTATION_SEQUENCE.md`.
