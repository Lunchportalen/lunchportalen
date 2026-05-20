# TPT-A-4: SaaS Invoice generation

**Date:** 2026-05-21  
**Migration:** `supabase/migrations/20260523120000_tpt_a4_saas_invoice_generation.sql`  
**References:** TRIPLETEX-PLAN-V1 v3.2 §4 Sekvens A2 + §5 TPT-A-4

## FASE 0b — Plan scope (entydig)

| Question | Answer (plan + Patch 15) |
|----------|--------------------------|
| Billing cycle | **Monthly** — `invoice_period` = `date_trunc('month', …)`; cron 1st of month → TPT-A-5 |
| Tier pricing | **Not** BASIS/LUXUS/Enterprise — `plan IN ('SAAS_FIXED','SAAS_PER_COMPANY','CUSTOM')` + `monthly_amount` |
| Amount calculation | **Fixed** `monthly_amount` per active subscription (SAAS_PER_COMPANY count logic deferred) |
| VAT | `billing_tax_codes` via `tax_code_id` (default `MVA_25`, rate 0.25) |
| Credit notes | **Out of scope** |
| Worker | **In scope** (this patch) — mirrors TPT-A-3 pattern |
| Cron | **TPT-A-5** — `vercel.json` monthly job not added here |

**Note:** `invoice_periods` is for **company** Flow B/C — SaaS uses `provider_invoices` only (not `invoice_periods`).

## RPC changes

### `lp_provider_generate_invoice_for_period` (modified)

- Drops legacy 2-arg overload (PostgREST `PGRST203` fix).
- Signature: `(p_provider_id uuid, p_invoice_period date, p_request_rid text default null)`.
- After audit: enqueues `tripletex.saas_invoice_create_lp:<invoice_id>`.
- Idempotent: existing invoice → no duplicate row; re-enqueues outbox if status `DRAFT`.

### `lp_generate_saas_invoices_for_period` (new)

- Bulk for all `ACTIVE` subscriptions (`active_to IS NULL`).
- Skips `PAUSED` / `CANCELLED` (per-provider call raises `ACTIVE_SUBSCRIPTION_NOT_FOUND`).
- Returns `{ generated, skipped_idempotent, errors, invoice_ids }`.

## Outbox contract

| Field | Value |
|-------|--------|
| `event_key` | `tripletex.saas_invoice_create_lp:<invoice_id>` |
| `payload` | `{ invoice_id, provider_id, target: 'lp', request_rid }` |
| Dedup | `ON CONFLICT (event_key) DO NOTHING` |

## Worker (`handleSaasInvoiceCreateLp`)

| Step | Action |
|------|--------|
| Idempotency | `tripletex_exports` unique_ref `lp_saas:<invoice_id>` |
| Customer | `tripletex_customers` where `provider_id` set, `company_id` null |
| Product | `TRIPLETEX_REVENUE_DEFAULT_PRODUCT_ID` |
| VAT | `billing_tax_codes.tripletex_vat_code` → fallback `TRIPLETEX_REVENUE_DEFAULT_VAT_CODE` |
| Line | `unit_price` = `amount_net` (ex VAT) |
| Success | `provider_invoices.status=SENT`, `tripletex_exports` upsert, audit `provider_saas_invoice_created` |

Dispatch: `app/api/system/outbox/process/route.ts` — prefix `tripletex.saas_invoice_create_lp`.  
SMTP guard: `lib/orderBackup/outbox.ts` excludes prefix from email worker.

## MCP / DB apply

| Environment | Project ref | Status |
|-------------|-------------|--------|
| Staging | `uigxsboqeruxflgzqztl` | ✅ Applied via `SUPABASE_POSTGRES_URL` (pg script) |
| Prod | `hkpokyapzarefrgqzkos` | ⚠️ **Pending** — no prod Postgres URL in local `.env.local`; apply same migration via MCP/dashboard before prod cron |

## Tests

| Suite | Result |
|-------|--------|
| `tests/integrations/providerSaasInvoiceCreateLp.test.ts` | **6/6 PASS** (mocked) |
| `tests/db/lp_saas_invoice_generation.test.ts` | **4/4 PASS** (staging integration) |
| `tests/db/lp_provider_create.test.ts` (FASE 0a regression) | **7/7 PASS** |

## Files changed

- `supabase/migrations/20260523120000_tpt_a4_saas_invoice_generation.sql`
- `lib/integrations/tripletex/providerSaasInvoiceSync.ts`
- `app/api/system/outbox/process/route.ts`
- `lib/orderBackup/outbox.ts`
- `tests/integrations/providerSaasInvoiceCreateLp.test.ts`
- `tests/db/lp_saas_invoice_generation.test.ts`

## Next

- **TPT-A-5:** Cron `/api/cron/tripletex-saas-monthly` + prod migration apply
- **R10:** Manual Tripletex smoke for `saas_invoice_create_lp` (after customer mapping exists)
