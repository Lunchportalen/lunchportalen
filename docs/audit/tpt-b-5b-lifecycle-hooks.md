# TPT-B-5b — Agreement lifecycle hooks (proactive Flow B sync)

**Dato:** 2026-05-21  
**Plan:** TRIPLETEX-PLAN-V1 v3.13 § TPT-B-5b  
**Forrige:** TPT-B-6 (`dce3f597`)

---

## Leveranse

| Komponent | Path |
|-----------|------|
| DB trigger | `lp_agreement_lifecycle_hook()` on `public.agreements` |
| Migrasjon | `20260602120000_tpt_b5b_agreement_lifecycle_hooks.sql` |
| Product worker | `lib/integrations/tripletex/providerProductSync.ts` |
| Outbox dispatch | `app/api/system/outbox/process/route.ts` |

### Migrasjon apply

| Miljø | Project ref | Applied (MCP) |
|-------|-------------|---------------|
| **Staging** | `uigxsboqeruxflgzqztl` | 2026-05-21 |
| **Prod** | `hkpokyapzarefrgqzkos` | 2026-05-21 |

---

## Trigger-design (DB, ikke Node-hook)

Lp bruker allerede DB-triggere for outbox (`lp_orders_outbox_trigger`). TPT-B-5b følger samme mønster:

```
AFTER INSERT OR UPDATE OF status, tier ON agreements
  → lp_agreement_lifecycle_hook()  [SECURITY DEFINER, same TX]
```

**Hvorfor ikke Node-hook i RPC?** Agreement kan aktiveres via flere paths (`lp_agreement_approve_active`, direkte UPDATE, fremtidige admin-API). Trigger fanger alle uten å endre frozen RPC-er.

---

## Transition-matrise

| Transition | Outbox event_key | Handler |
|------------|------------------|---------|
| INSERT/UPDATE → `ACTIVE` (fra ikke-ACTIVE) | `tripletex.company_customer_create_provider:{company}:{provider}` | `handleCompanyCustomerCreateProvider` (B-2) |
| UPDATE `tier` (distinct) | `tripletex.provider_product_sync:{provider}:{TIER}` | `handleProviderProductSync` (B-5b) |
| INSERT `PENDING` | — | — |
| ACTIVE → PAUSED | — (ingen ny customer) | — |
| PAUSED → ACTIVE | customer (re-activation) | B-2 |

Payload inkluderer `source: 'agreement_lifecycle'`, `agreement_id`, `request_rid`.

---

## Idempotency

- **Global UNIQUE** på `outbox.event_key` (eksisterende konvensjon)
- `INSERT … ON CONFLICT (event_key) DO NOTHING`
- Customer key er per `(company, provider)` — re-activation feirer audit, men duplikat-PENDING hindres
- Product key er per `(provider, tier)` — tier A→B→A gir nøkler for B og A, ikke duplikat-PENDING for samme tier

---

## Audit

Per fired hook:

```sql
INSERT lifecycle_audit_log
  action = 'agreement_lifecycle_hook_fired'
  entity_type = 'agreement'
  metadata.hook = 'status_active' | 'tier_change'
```

---

## Defense in depth (lazy fallback)

B-4 worker kaller fortsatt `ensureCompanyCustomer` / `ensureProviderProduct` ved første invoice-push. Lifecycle-hooks reduserer synlig feil til activation-tidspunkt, men lazy path forblir backup.

---

## Tester

`tests/db/lp_agreement_lifecycle_hook.test.ts` — 9 cases (transitions, idempotency, audit, tier-only).

---

## Ikke i scope

- Backfill existing agreements
- Cancellation/termination hooks
- VAT-sync hooks (lazy ved invoice)
- Sync-status UI (TPT-B-7)
