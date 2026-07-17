# PHASE 16NO — DARK DEPLOY CHECKLIST (reversible prep)

**NORWAY_RELEASE_SHA:** `a40acaf387d397868239af827b8906884d29e23a` (update after new commits)  
**Production URL:** https://app.lunchportalen.no  
**Mode:** dark — Norway fiscal flags OFF

## Required env on production deploy (all false / required)

```
COUNTRY_NO_PRODUCTION_ENABLED=false
COUNTRY_NO_REGISTRATION_ENABLED=false
COUNTRY_NO_ORDERING_ENABLED=false
COUNTRY_NO_INVOICE_ONLY_ENABLED=false
COUNTRY_NO_PLATFORM_COMMISSION_ENABLED=false
ACCOUNTANT_NORWAY_TAX_CONFIRMATION=REQUIRED
OWNER_NORWAY_TAX_MODEL_CONFIRMATION=CONFIRMED
```

## Phase A — dark deployment (when unlocked)

1. Keep Vercel production ignore-build lock until exact-SHA deploy window.
2. Deploy exact `NORWAY_RELEASE_SHA` with flags above (no ordering/commission).
3. Verify `/api/health` version = release SHA.
4. Verify login, provider/company/employee shells, no redirect loops.
5. Verify Stripe remains off; no commission invoice generation.
6. Verify non-NO country access remains blocked.
7. Re-lock production auto-deploy.

## Phase B — migration (only after backup + rehearsal PASS)

1. Run `prod-backup-read-only` evidence.
2. Restore rehearsal on isolated environment.
3. Apply migration range `20260819120000` → `20260902120000` on rehearsal.
4. Manual authorised production migrate workflow only.
5. Do **not** set Norway fiscal flags until accountant evidence stored.

## Phase C — Norway activation (blocked)

Blocked until:

- `ACCOUNTANT_NORWAY_TAX_CONFIRMATION=CONFIRMED` with stored written evidence
- Owner fiscal go after accountant
- Dark deploy + migration + post-health PASS

## Explicitly not done in this prep

- Production ordering enablement
- Commission invoicing enablement
- Other-country enablement
- Umbraco / marketing / Azure changes
