# TPT-A-3 — Staging smoke-checklist (manuell)

**Formål:** Verifiser end-to-end at `lp_provider_create` → outbox → worker → Tripletex Customer → `tripletex_customers`-mapping fungerer på staging.

**Forutsetninger:**

- Staging Supabase: `uigxsboqeruxflgzqztl`
- Tripletex **test-env** konfigurert i Vercel staging / `.env.local` (`TRIPLETEX_BASE_URL` = test-API)
- Superadmin-bruker for RPC-kall
- TPT-A-2 + TPT-A-3 migrasjoner applied (✅)

**Ikke automatiseres i CI** — krever ekte Tripletex test-konto.

---

## Steg 1 — Setup

- [ ] Bekreft staging env i deploy eller lokalt:
  - `NEXT_PUBLIC_SUPABASE_URL` → `https://uigxsboqeruxflgzqztl.supabase.co`
  - Tripletex test-tokens satt (`TRIPLETEX_*`)
- [ ] Noter `request_rid` (valgfri sporbarhet): f.eks. `smoke-2026-05-20-001`

---

## Steg 2 — Opprett test-provider (RPC)

Via Supabase SQL Editor (som superadmin JWT) eller app som kaller RPC:

```sql
SELECT public.lp_provider_create(
  p_slug := 'smoke-tpt-a3-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
  p_name := 'Smoke TPT-A3 Provider AS',
  p_contact_email := 'smoke-tpt-a3@test.lunchportalen.no',
  p_org_number := '999000111',
  p_request_rid := 'smoke-2026-05-20-001'
);
```

- [ ] Returnerer `{ ok: true, provider_id, event_key, request_rid }`
- [ ] Noter `provider_id` og `event_key`

---

## Steg 3 — Verifiser outbox PENDING

```sql
SELECT id, event_key, status, payload, created_at
FROM public.outbox
WHERE event_key = 'tripletex.provider_customer_create_lp:<provider_id>';
```

- [ ] Én rad, `status = 'PENDING'`
- [ ] `payload` inneholder `provider_id`, `target: 'lp'`, `request_rid`

---

## Steg 4 — Trigger outbox-prosessor

**Manuelt** (inntil TPT-A-5 cron er registrert):

```bash
curl -X POST "https://<staging-app>/api/system/outbox/process" \
  -H "Authorization: Bearer <SYSTEM_MOTOR_SECRET eller tilsvarende gate>"
```

Eller kjør samme route fra superadmin repair/cron-verktøy hvis tilgjengelig.

- [ ] Respons `delivered >= 1` eller `providerCustomerCreateLp.delivered >= 1`
- [ ] Outbox-rad → `status = 'SENT'`

---

## Steg 5 — Verifiser mapping + audit

```sql
SELECT provider_id, company_id, tripletex_customer_id, legal_name, orgnr
FROM public.tripletex_customers
WHERE provider_id = '<provider_id>';

SELECT action, entity_type, entity_id, metadata
FROM public.lifecycle_audit_log
WHERE entity_type = 'tripletex_sync'
  AND entity_id = '<provider_id>'
ORDER BY created_at DESC
LIMIT 1;
```

- [ ] `tripletex_customers`: `company_id` NULL, `tripletex_customer_id` satt
- [ ] Audit: `action = 'provider_customer_created'`
- [ ] (Valgfritt) Bekreft Customer finnes i Tripletex test-portal med samme orgnr

---

## Steg 6 — Cleanup

```sql
-- Rekkefølge: outbox → audit → tripletex_customers → provider
DELETE FROM public.outbox
WHERE event_key = 'tripletex.provider_customer_create_lp:<provider_id>';

DELETE FROM public.lifecycle_audit_log
WHERE entity_id = '<provider_id>' AND entity_type IN ('provider', 'tripletex_sync');

DELETE FROM public.tripletex_customers WHERE provider_id = '<provider_id>';

DELETE FROM public.providers WHERE id = '<provider_id>';
```

- [ ] Test-data fjernet
- [ ] Tripletex test-Customer kan slettes manuelt i portal hvis opprettet

---

## Feilsøking

| Symptom | Sjekk |
|---------|--------|
| Outbox forblir PENDING | Kjørt `/api/system/outbox/process`? Cron ikke registrert (TPT-A-5) |
| FAILED / FAILED_PERMANENT | `last_error` på outbox-rad; Tripletex env/tokens |
| PROVIDER_ORG_NUMBER_MISSING | Provider mangler `org_number` |
| Mapping finnes ikke | Worker-logg; `ensureProviderCustomer` feil |

---

## Etter fullført smoke

- [ ] Oppdater R10 i `tripletex-plan-v1.md` v3.2 → lukket
- [ ] Noter dato + operatør i denne filen (kommentar nederst)
