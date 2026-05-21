# TPT-B-5 — Agreement billing cron scheduler

**Status:** COMPLETED  
**Migration:** `20260531120000_tpt_b5_billing_scheduler.sql`  
**Cron:** `/api/cron/tripletex-agreements-daily` (Vercel, `0 6 * * *` UTC)

---

## Purpose

Closes Flow B scheduling loop: daily cron finds agreements due for billing, computes per-agreement period windows, generates invoices via B-3 core, and enqueues outbox events for B-4 worker.

End-to-end without manual trigger:

```
Vercel cron (06:00 UTC)
  → /api/cron/tripletex-agreements-daily (CRON_SECRET)
  → lp_run_daily_agreement_billing(Oslo today)
  → lp_compute_agreements_due_today
  → private.lp_generate_agreement_invoice_core (per agreement)
  → agreement_invoices + outbox
  → tripletex-outbox worker (B-4)
  → Tripletex
```

---

## RPCs

### `lp_compute_agreements_due_today(p_today date)`

**Auth:** `service_role` only.

**Filters:**

- Agreement `status = ACTIVE`
- Company not suspended/paused
- Provider not suspended/paused/deleted
- `last_invoiced_at` is null OR Oslo-date `< p_today`

**Returns:** `(agreement_id, provider_id, company_id, billing_cycle, period_start, period_end)`

### `lp_run_daily_agreement_billing(p_today, p_request_rid)`

**Auth:** `service_role` only.

**Default `p_today`:** `(timezone('Europe/Oslo', now()))::date`

**Behavior:**

1. Iterate `lp_compute_agreements_due_today`
2. Call `private.lp_generate_agreement_invoice_core` per row
3. Count generated / skipped / failed (exceptions logged, run continues)
4. Insert `lifecycle_audit_log` summary

**Return JSON:**

```json
{
  "ok": true,
  "run_id": "uuid",
  "ran_at": "timestamptz",
  "today": "date",
  "candidates_count": 0,
  "generated_count": 0,
  "skipped_count": 0,
  "failed_count": 0,
  "invoice_ids": [],
  "errors": []
}
```

---

## Billing window arithmetic (Europe/Oslo)

All date logic runs in **SQL** (deterministic). Cron route passes Oslo today from `osloTodayISODate()` (`lib/date/oslo.ts`).

### Monthly (`billing_cycle = 'monthly'`)

- Anchor day = `extract(day from coalesce(billing_anchor_date, starts_at, created_at))`
- Due when `extract(day from p_today) = least(anchor_day, last_day_of_month)`
- **Edge:** anchor=31 in February → due on 28/29 (last day of month)
- **Period:** previous calendar month  
  `[date_trunc('month', p_today) - 1 month, date_trunc('month', p_today) - 1 day]`

### Biweekly (`billing_cycle = 'biweekly'`)

- Anchor = `coalesce(billing_anchor_date, starts_at)::date`
- Due when `p_today >= anchor` AND `mod(p_today - anchor, 14) = 0`
- **Period:** `[p_today - 14, p_today - 1]`

### Legacy anchor before agreement start

No special skip: first due date naturally occurs on/next anchor after activation. Zero-order periods skip via B-3 (`ZERO_ORDERS`) without updating `last_invoiced_at`.

---

## Idempotency (two layers)

1. **Primary:** `last_invoiced_at` Oslo-date `< p_today` in compute filter. B-3 core sets `last_invoiced_at` on successful invoice creation.
2. **Backstop:** B-3 `UNIQUE (agreement_id, invoice_period_start)` → idempotent return on re-run same period.

Re-run same calendar day after successful billing → `candidates_count = 0`.

---

## Auth model

| Layer | Mechanism |
|-------|-----------|
| Cron endpoint | `requireCronAuth` — `Authorization: Bearer CRON_SECRET`, `x-cron-secret`, or Vercel `x-vercel-cron: 1` |
| RPCs | `service_role` only (revoked from `authenticated` / `anon`) |

Wrong/missing secret → **403 forbidden** (matches Flow A / TPT-A-5).

---

## Audit log

| Field | Value |
|-------|-------|
| `entity_type` | `agreement_billing_cron` |
| `entity_id` | `run_id` (UUID per run) |
| `metadata.today` | Oslo billing date (YYYY-MM-DD) |
| `action` | `agreement_billing_cron_completed` / `_partial` / `_failed` |
| `metadata.request_rid` | cron RID (e.g. `cron_agr_bill_…`) |
| `metadata.run_id` | UUID per RPC run |

Per-invoice audit remains in B-3 (`agreement_invoice_generated`).

Cron route also writes a Node-side audit entry mirroring SaaS monthly cron pattern.

---

## Index

```sql
agreements_billing_scheduler_idx ON (status, billing_cycle, billing_anchor_date)
WHERE status = 'ACTIVE'
```

---

## Deferred: TPT-B-5b (auto-sync hooks)

Not in B-5 scope (split for review size):

- Agreement → ACTIVE: enqueue `tripletex.company_customer_create_provider`
- Tier change: enqueue product sync

---

## Verification

- `tests/db/lp_compute_agreements_due_today.test.ts` — 8 cases
- `tests/db/lp_run_daily_agreement_billing.test.ts` — 4 cases
- `tests/api/cron-tripletex-agreements-daily.test.ts` — 5 cases

Manual smoke (post-deploy):

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://staging.lunchportalen.no/api/cron/tripletex-agreements-daily?today=2026-06-15"
```

---

## Next

**TPT-B-6** — Webhook for paid-status sync.
