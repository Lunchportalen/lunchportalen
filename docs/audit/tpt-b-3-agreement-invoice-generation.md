# TPT-B-3 — Agreement Invoice Generation (Provider → Company)

**Patch:** TPT-B-3  
**Status:** ✅ COMPLETED  
**Dato:** 2026-05-21  
**Migrasjon:** `20260530120000_tpt_b3_agreement_invoices.sql`  
**Applied:** staging (`uigxsboqeruxflgzqztl`) + prod (`hkpokyapzarefrgqzkos`) via MCP  

---

## 1. Mål

Generere fakturagrunnlag per agreement og periode fra leverte måltidsordre, lagre som `agreement_invoices` + linjer, og enqueue outbox for Tripletex-push (worker → TPT-B-4).

---

## 2. Schema-valg: **Fresh tables**

| Tabell | Beskrivelse |
|--------|-------------|
| `agreement_invoices` | Header per agreement × periode (UNIQUE `agreement_id, invoice_period_start`) |
| `agreement_invoice_lines` | Aggregerte linjer (tier × unit_price) |

**Utvidelser `agreements`:**
- `billing_cycle` CHECK utvidet: `monthly` | `biweekly`
- `billing_anchor_date`, `last_invoiced_at`

Ingen gjenbruk av legacy `invoice_periods` — Flow B har eget livssyklus.

---

## 3. Linje-beregnings-algoritme

1. Hent billbare ordrer: `orders.agreement_id = p_agreement_id`, `date` i `[period_start, period_end]`, `status <> CANCELLED`
2. **Aggreger** `GROUP BY tier, unit_price_nok`:
   - `quantity` = COUNT(*)
   - `line_amount` (net) = SUM(unit_price_nok)
3. VAT per linje: `billing_products.tax_code_id` → `billing_tax_codes.rate` (fallback `MVA_15` @ 15%)
4. Header-totaler = SUM(linjer net + tax)
5. `product_key` = tier (`BASIS`/`LUXUS`/`ENTERPRISE`) eller `CUSTOM`

**0 ordrer:** skip — `{ skipped: true, reason: 'ZERO_ORDERS' }` (ingen invoice/outbox)

---

## 4. Idempotency-design

| Lag | Mekanisme |
|-----|-----------|
| DB | UNIQUE `(agreement_id, invoice_period_start)` |
| Re-run | Returnerer eksisterende `invoice_id`, `idempotent: true` |
| Outbox | Re-enqueue kun hvis status = `DRAFT`; `ON CONFLICT (event_key) DO NOTHING` |
| Bulk | Idempotent + skipped telles separat |

---

## 5. Authorization-matrise

### `lp_provider_generate_agreement_invoice_for_period`

| Rolle | Tillatelse |
|-------|------------|
| superadmin | ✅ |
| provider_admin (egen provider) | ✅ |
| provider_admin (annen provider) | ❌ |
| employee / company_admin | ❌ |

### `lp_generate_agreement_invoices_for_period`

| Rolle | Tillatelse |
|-------|------------|
| service_role (cron) | ✅ |
| superadmin | ✅ |
| authenticated annet | ❌ |

---

## 6. Skip-regler (ikke faktureres)

- Agreement status ≠ `ACTIVE` (inkl. `PAUSED`)
- Company `suspended_at` / `paused_at` satt
- Provider `suspended_at` / `paused_at` / `deleted_at` satt
- 0 billbare ordrer i perioden

---

## 7. Outbox

**Event key:** `tripletex.agreement_invoice_create_provider:<invoice_id>`

**Payload:** `{ invoice_id, provider_id, agreement_id, target: 'provider', request_rid }`

Worker implementeres i **TPT-B-4**.

---

## 8. VAT-håndtering

- SQL-lag: `billing_tax_codes.rate` via `billing_products` per tier
- Tripletex VAT lookup (`ensureProviderVatCode`) → **TPT-B-4 worker** ved push

---

## 9. Tester

`tests/db/lp_provider_generate_agreement_invoice_for_period.test.ts` (8 cases):
- Positive (5 orders → 1 line qty 5, totals, outbox, audit)
- Idempotency
- PAUSED agreement skipped
- ZERO_ORDERS skipped
- Authorization (provider_admin same/other, outsider)
- Bulk RPC + re-run

---

## 10. Neste steg

**TPT-B-4:** Worker `handleAgreementInvoiceCreateProvider` — push DRAFT invoice til provider's Tripletex.
