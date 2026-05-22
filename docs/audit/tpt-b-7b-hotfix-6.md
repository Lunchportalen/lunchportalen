# TPT-B-7b-hotfix-6 — Outbox UUID-claim + staging schema-grants

**Dato:** 2026-05-22  
**Forrige:** hotfix-5 (`4a125df9`) — verify audit metadata

---

## Rotårsak

Outbox-worker gjorde `Number(row.id)` ved claim. `outbox.id` er **uuid** (staging + prod) → `NaN` → **0 events claimet** uten feil.

Staging hadde i tillegg schema-drift: `billing_tax_codes` og `tripletex_customers` manglet `GRANT` til `service_role` (prod OK).

---

## Fix

1. **`lib/outbox/claimIds.ts`** — `extractOutboxClaimIds()` støtter uuid-streng og legacy bigint.
2. **`app/api/system/outbox/process/route.ts`** — bruker extract i stedet for `Number(row.id)`.
3. **Migration `20260606120000`** — `GRANT SELECT` på `billing_tax_codes`; full DML på `tripletex_customers` for `service_role`.

---

## Prod-verifisering (FASE 0a)

| Miljø | `pg_typeof(outbox.id)` | outbox-rader |
|-------|------------------------|--------------|
| Prod | `uuid` | 6 |
| Staging | `uuid` | 693+ PENDING |

Bug er **prod-aktiv** — fix obligatorisk.

---

## Cron-strategi staging (ops, ikke i denne patchen)

- Vercel Cron kjører typisk på **Production** — staging krever manuell dispatch eller GitHub Action.
- Staging har Deployment Protection (SSO) — bruk `vercel curl POST` med bypass + korrekt `CRON_SECRET` fra `vercel env pull --environment=staging`.
- Etter hotfix-6: manuell dispatch skal claim'e onboarding-event og kjøre provisioning.

---

## Verifikasjon

```sql
SELECT has_table_privilege('service_role', 'billing_tax_codes', 'SELECT');
SELECT has_table_privilege('service_role', 'tripletex_customers', 'SELECT');
```

```bash
vercel curl /api/cron/tripletex-outbox --deployment <staging-dpl> -y -- \
  --request POST --header "Authorization: Bearer $STAGING_CRON_SECRET"
```
