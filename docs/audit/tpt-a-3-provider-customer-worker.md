# TPT-A-3: Provider-Customer Worker

**Date:** 2026-05-20  
**Commit:** `d657ea83`  
**References:** TRIPLETEX-PLAN-V1 v3.1 §4 Sekvens A1, TPT-A-2 `c2186bfc`

## Plan note (FASE 0b)

§5 **TPT-A-3** i planen sier fortsatt «SaaS Invoice generation» — utdatert etter TPT-A-2-split.  
Implementert scope = **steg 4–6 i Sekvens A1** (worker + mapping). SaaS invoice flyttes til egen patch (f.eks. TPT-A-3b / renummerering).

## Handler design

| Item | Value |
|------|--------|
| Modul | `lib/integrations/tripletex/providerCustomerSync.ts` |
| Export | `handleProviderCustomerCreateLp(admin, row, getRunAuth)` |
| Dispatch | `app/api/system/outbox/process/route.ts` — prefix `tripletex.provider_customer_create_lp` |
| SMTP cron guard | `lib/orderBackup/outbox.ts` — release claim (samme som `invoice.ready`) |

### Idempotency

1. `SELECT tripletex_customers WHERE provider_id = $1 AND company_id IS NULL`
2. Hvis `tripletex_customer_id` finnes → `ok: true` (ingen Tripletex-kall, ingen ny audit)
3. Ellers `ensureProviderCustomer()` → upsert mapping

## Tripletex API usage

| Function | Role |
|----------|------|
| `resolveTripletexAuth()` | Lp's konto (default, ingen `providerId`) |
| `ensureProviderCustomer()` | POST `/customer`, GET lookup on 409, upsert `tripletex_customers` |

### 409 handling

`ensureProviderCustomer` fanger `TripletexClientError` med `status === 409`, resolver ID via conflict `detail` eller `GET /customer?organizationNumber=`.

## Mapping schema

```text
tripletex_customers:
  company_id = NULL
  provider_id = <providers.id>
  tripletex_customer_id = <Tripletex customer id>
  + billing profile columns (orgnr, legal_name, address, …)
```

### Audit

```text
lifecycle_audit_log:
  entity_type = 'tripletex_sync'
  action = 'provider_customer_created'
  entity_id = provider_id
  metadata = { provider_id, tripletex_customer_id, created, request_rid, event_key }
```

Skrives **før** outbox markeres SENT (via route `markOutboxSent` etter `ok: true`).

## Error handling matrix

| Condition | Outbox (route) | Mapping |
|-----------|----------------|---------|
| Success / idempotent hit | SENT | Exists or created |
| 409 resolved in client | SENT | Upserted |
| TRANSIENT (5xx, timeout, DB) | FAILED (retry via attempts) | None |
| PERMANENT (validation, PROVIDER_NOT_FOUND) | FAILED_PERMANENT | None |
| INVALID_PAYLOAD | FAILED_PERMANENT | None |

## FASE 0a — TPT-A-2 staging verification

| Check | Result |
|-------|--------|
| `RUN_SUPABASE_INTEGRATION_TESTS=1` + `tests/db/lp_provider_create.test.ts` | **7 skipped** — mangler `SUPABASE_POSTGRES_URL` med staging-ref i `.env.local` (kun prod URL + service key) |
| Risk | **(b)** Fortsett TPT-A-3; manuell staging-verifisering anbefales etter creds satt |

Foreslått `.env.local` (gitignored): `SUPABASE_POSTGRES_URL` med `uigxsboqeruxflgzqztl` — se `docs/audit/staging-env-mapping-2026-05-20.md`.

## Test coverage

`tests/integrations/providerCustomerCreateLp.test.ts` — **6/6 PASS** (mocked)

1. Happy path + audit  
2. Idempotency (existing mapping)  
3. 409 path via mocked ensureProviderCustomer  
4. 500 transient  
5. PROVIDER_NOT_FOUND  
6. INVALID_PAYLOAD  

## TPT-A-4 hook

- Registrer cron som kaller `/api/system/outbox/process` (eller dedikert route) regelmessig
- Manuell smoke mot Tripletex test-env etter cron er live

## Files changed

- `lib/integrations/tripletex/client.ts` — `ensureProviderCustomer`
- `lib/integrations/tripletex/providerCustomerSync.ts` — handler
- `app/api/system/outbox/process/route.ts` — dual-prefix batch
- `lib/orderBackup/outbox.ts` — release tripletex provider events from SMTP worker
- `tests/integrations/providerCustomerCreateLp.test.ts`
