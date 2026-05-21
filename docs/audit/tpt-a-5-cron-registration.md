# TPT-A-5 — Cron-registrering (Tripletex Flow A)

**Dato:** 2026-05-21  
**Plan:** TRIPLETEX-PLAN-V1 v3.4 §5 TPT-A-5  
**Forrige:** TPT-A-4 (`c75aca38`)

---

## Leveranse

| Komponent | Path / schedule |
|-----------|-----------------|
| Månedlig SaaS-faktura bulk | `POST /api/cron/tripletex-saas-monthly` — `0 6 1 * *` (UTC, dag 1) |
| Tripletex outbox worker | `POST /api/cron/tripletex-outbox` — `*/3 * * * *` |
| SMTP/order outbox (eksisterende) | `POST /api/cron/outbox` — `*/2 * * * *` (uendret) |

### Månedlig cron

- Auth: `requireCronAuth` (`CRON_SECRET`, `x-cron-secret`, eller `x-vercel-cron: 1`)
- Periode: forrige kalendermåned (UTC), overstyres med `?period=YYYY-MM-01`
- RPC: `lp_generate_saas_invoices_for_period(p_invoice_period, p_request_rid)`
- Audit: `lifecycle_audit_log` — `entity_type = saas_invoice_cron`, actions `saas_invoice_cron_completed` / `saas_invoice_cron_failed`

### Tripletex outbox cron

- Tynn wrapper med `requireCronAuth` → `app/api/system/outbox/process` POST
- Prosesserer: `invoice.ready:%`, `tripletex.provider_customer_create_lp:%`, `tripletex.saas_invoice_create_lp:%`
- `/api/cron/outbox` (SMTP) **slipper** Tripletex-nøkler tilbake til `PENDING` for denne workeren

### Migrasjon

`20260525120000_tpt_a5_cron_saas_invoice_service_role.sql` — tillater `auth.role() = 'service_role'` på SaaS invoice RPCs (cron via `supabaseAdmin`).

---

## Tester

`tests/api/cron/tripletexSaasMonthly.test.ts` — 6 cases:

1. Manglende `CRON_SECRET` → 500 misconfigured  
2. Manglende auth header → 403  
3. Feil Bearer → 403  
4. Gyldig auth + mock RPC → 200 + audit completed  
5. Idempotency (andre kall, `skipped_idempotent` fra RPC)  
6. RPC-feil → 500 + audit failed  

Auth-koder følger eksisterende cron-FASIT (`403`/`500`, ikke `401`).

---

## R10

- **A-2 / A-4:** staging integrasjonstester PASS (før TPT-A-5)  
- **A-3:** `docs/audit/tpt-a3-tripletex-smoke-runbook.md` publisert; manuell Tripletex test-env smoke gjenstår for full R10-lukking  

---

## Ikke i scope (TPT-A-5)

- Webhook handler (TPT-A-6)  
- Admin UI (TPT-A-7)  
- `tripletex-status-poll-lp` cron (senere patch)  
