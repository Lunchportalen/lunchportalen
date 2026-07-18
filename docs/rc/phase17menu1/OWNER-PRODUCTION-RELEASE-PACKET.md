# PHASE 17MENU.1 — OWNER PRODUCTION-RELEASE PACKET

**Status:** Prepared for owner review.  
**Production deploy:** NOT APPROVED  
**Production migration:** NOT APPROVED  
**Non-Norway country activation:** NOT APPROVED  

Do not deploy until the owner explicitly approves each lock below.

---

## Baseline (must remain true)

| Lock | Required value |
|------|----------------|
| Production SHA (pre-release) | `771a4207e9743fd232971eb95ecc27e45723a89d` |
| Production migration head | `20260904120000` |
| Norway ordering | ENABLED |
| MVA threshold automation | LIVE |
| Official Norwegian MVA registration | NO |
| Invoices with 25% MVA | BLOCKED |
| Other production countries | DISABLED 20/20 |
| Stripe | OFF |
| Payment mode | `invoice_only` |
| Production deploy lock | ACTIVE |
| Production migration lock | ACTIVE |

---

## Staging candidate (release branch)

| Field | Value |
|-------|--------|
| Branch | `release/global-menu-universes-21` |
| Staging Supabase | `uigxsboqeruxflgzqztl` |
| Staging migrations applied | `20260905120000_phase17menu_package_entitlements_canonical` + `phase17menu1_enterprise_contracts_staging` |
| Commercial model | `agency_commission_invoice_only_v1` |
| Commission | exact 500 bps + remainder carry |
| Package model | Basis / Luxus / Enterprise contract (not auto-Luxus) |

---

## Pre-production checklist (owner)

- [ ] Sanity staging seed verified 21/21 countries, 126 lunchCategory docs, production dataset untouched
- [ ] `npm run ci:phase17menu1-gates` PASS on release SHA
- [ ] `npm run test:phase17menu` PASS
- [ ] `LP_PACKAGE_ENTITLEMENTS_RUNTIME=1` validated on staging only
- [ ] Isolated 63-flow matrix evidence reviewed
- [ ] Native culinary approvals: accept 0/21 or schedule reviewers (do not fake)
- [ ] Norway regression: PASS; other countries remain disabled in production
- [ ] Explicit owner approval for production migration (if any)
- [ ] Explicit owner approval for production deploy
- [ ] Explicit owner approval before activating any non-NO country

---

## Migrations that must NOT run until approved

1. `20260905120000_phase17menu_package_entitlements_canonical.sql`
2. `phase17menu1_enterprise_contracts_staging` (staging-only name — promote only via a dedicated production migration after review)

---

## Decision ladder

1. Staging technical PASS → owner reviews packet  
2. Native culinary review (per country/locale) → optional before activation  
3. Owner unlocks production migration (if required)  
4. Owner unlocks production deploy  
5. Owner unlocks non-NO activation country-by-country  

Until step 3–5 are explicit, keep production unchanged.
