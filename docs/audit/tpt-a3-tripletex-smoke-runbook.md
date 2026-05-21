# TPT-A-3 — Tripletex test-env smoke runbook (manuell)

**Formål:** Verifiser at `lp_provider_create` → outbox → Tripletex worker → `tripletex_customers` fungerer mot Tripletex **test-API**.

**Ikke i CI** — krever ekte test-tokens og manuell cleanup.

**Relatert:** `docs/audit/tpt-a-3-staging-smoke-checklist.md` (staging Supabase SQL). Denne runbooken fokuserer på Tripletex test-env + cron-trigger etter TPT-A-5.

---

## 1. Setup

- [ ] Lokalt eller staging deploy med:
  - `TRIPLETEX_TEST_BASE_URL` (eller `TRIPLETEX_BASE_URL` peker på test)
  - `TRIPLETEX_TEST_TOKEN` / consumer + employee tokens for test-konto
  - `CRON_SECRET` for manuell cron
  - `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` mot staging
- [ ] Noter `request_rid`: f.eks. `smoke-tpt-a3-2026-05-21`

---

## 2. Opprett test-provider (RPC)

Som superadmin (JWT) i SQL Editor eller via app:

```sql
SELECT public.lp_provider_create(
  p_slug := 'smoke-tpt-a3-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
  p_name := 'Smoke TPT-A3 Provider AS',
  p_contact_email := 'smoke-tpt-a3@test.lunchportalen.no',
  p_org_number := '999000111',
  p_request_rid := 'smoke-tpt-a3-2026-05-21'
);
```

- [ ] `{ ok: true, provider_id, event_key }` — noter `provider_id`

---

## 3. Verifiser outbox PENDING

```sql
SELECT id, event_key, status, payload, created_at
FROM public.outbox
WHERE event_key = 'tripletex.provider_customer_create_lp:<provider_id>';
```

- [ ] Én rad, `status = 'PENDING'`
- [ ] `payload` har `provider_id`, `target: 'lp'`

---

## 4. Trigger Tripletex outbox cron

TPT-A-5 registrerer `/api/cron/tripletex-outbox` (hvert 3. min). Manuelt:

```bash
curl -sS -X POST "https://<app-host>/api/cron/tripletex-outbox" \
  -H "Authorization: Bearer <CRON_SECRET>"
```

- [ ] HTTP 200, `delivered >= 1` eller `providerCustomerCreateLp.delivered >= 1`
- [ ] Outbox-rad → `SENT`

---

## 5. Verifiser DB-mapping

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

- [ ] `tripletex_customers.tripletex_customer_id` satt, `company_id` NULL (Lp-provider)
- [ ] Audit: `provider_customer_created`

---

## 6. Verifiser i Tripletex test-portal

- [ ] Logg inn på Tripletex test
- [ ] Finn Customer med samme orgnr (`999000111`) / navn
- [ ] Noter Tripletex customer-id og sammenlign med DB

---

## 7. Cleanup

```sql
DELETE FROM public.outbox
WHERE event_key = 'tripletex.provider_customer_create_lp:<provider_id>';

DELETE FROM public.lifecycle_audit_log
WHERE entity_id = '<provider_id>'
  AND entity_type IN ('provider', 'tripletex_sync');

DELETE FROM public.tripletex_customers WHERE provider_id = '<provider_id>';
DELETE FROM public.providers WHERE id = '<provider_id>';
```

- [ ] Test-data fjernet i Supabase
- [ ] (Valgfritt) Slett test-Customer i Tripletex portal

---

## Feilsøking

| Symptom | Sjekk |
|---------|--------|
| Outbox PENDING | Kjør `/api/cron/tripletex-outbox` med gyldig `CRON_SECRET` |
| 403 på cron | `CRON_SECRET` matcher `Authorization: Bearer` |
| FAILED på outbox | `last_error`; Tripletex tokens og `TRIPLETEX_*_BASE_URL` |
| Ingen customer i portal | Worker logg; orgnr på provider |

**Lukking R10 A-3-del:** Denne runbooken er publisert; manuell utførelse med bekreftede test-env credentials lukker R10 A-3.
