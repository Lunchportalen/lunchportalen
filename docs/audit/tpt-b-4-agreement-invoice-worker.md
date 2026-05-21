# TPT-B-4 — Agreement Invoice Worker (Push to Provider's Tripletex)

**Patch:** TPT-B-4  
**Status:** ✅ COMPLETED  
**Dato:** 2026-05-21  
**Handler:** `lib/integrations/tripletex/agreementInvoiceSync.ts`  

---

## 1. Mål

Konsumere outbox-event `tripletex.agreement_invoice_create_provider:<invoice_id>`, opprette faktura i provider's Tripletex-konto, og transition `agreement_invoices.status` DRAFT → SENT.

---

## 2. Dispatch-mønster

**Polling via eksisterende outbox-dispatcher** (`POST /api/system/outbox/process`) — ikke LISTEN/NOTIFY.

Prefix: `tripletex.agreement_invoice_create_provider:%`

---

## 3. Handler-flyt

```
1. Parse payload / event_key → invoice_id
2. Idempotency: tripletex_exports.unique_ref = lp_agreement:{invoice_id}
   ELLER agreement_invoices.tripletex_invoice_id IS NOT NULL → SUCCESS
3. Load agreement_invoices (status = DRAFT)
4. Customer lookup: tripletex_customers (provider_id + company_id)
   → MISSING → FAILED permanent (MISSING_CUSTOMER_MAPPING)
5. Load agreement_invoice_lines
6. resolveTripletexAuth({ providerId }) — én session per run
7. Per linje:
   - ensureProviderProduct({ tier from product_key })
   - ensureProviderVatCode({ taxCodeId from line.tax_code_id })
8. createInvoice({ uniqueRef, customerId, invoiceLines, auth })
   - Tripletex: POST /order → PUT /order/:id/:invoice (sendToCustomer: false)
9. tripletex_exports upsert
10. agreement_invoices → SENT + tripletex_invoice_id + sent_at
11. lifecycle_audit_log (agreement_provider_invoice_created)
12. Return { ok: true }
```

---

## 4. Idempotency-strategi

| Lag | Mekanisme |
|-----|-----------|
| DB pre-check | `tripletex_invoice_id` eller status SENT → skip push |
| Export cache | `tripletex_exports` med `unique_ref = lp_agreement:{id}` |
| Tripletex 409 | Parse existing id fra conflict body → success |
| Update guard | `.eq("status", "DRAFT")` på invoice update |

---

## 5. Error-klassifisering

| Feil | Outbox |
|------|--------|
| 5xx, timeout, TRANSIENT | PENDING (retry) |
| 409 Tripletex | SENT (success) |
| 4xx validation, PERMANENT, AUTH, CONFIG | FAILED (no retry) |
| MISSING_CUSTOMER_MAPPING | FAILED permanent |
| PROVIDER_CREDENTIALS_NOT_CONFIGURED | FAILED permanent |

---

## 6. Race-håndtering (missing customer)

**Beslutning:** FAILED med `MISSING_CUSTOMER_MAPPING` — fail-closed.

Ingen auto-enqueue av B-2 customer-event. Operator må sikre customer-sync før invoice push (eller re-run outbox etter mapping finnes).

---

## 7. State-machine

`agreement_invoices.status`: **DRAFT → SENT** direkte (samme mønster som `provider_invoices` i TPT-A-4).

Ingen intermediate `SENDING` state i denne patchen.

---

## 8. VAT / Product resolution order

1. `ensureProviderProduct` — tier fra `product_key` (CUSTOM → BASIS fallback)
2. `ensureProviderVatCode` — `tax_code_id` fra linje (B-3 snapshot)
3. `createInvoice` — `tripletex_vat_code` fra ensureProviderVatCode per linje

---

## 9. Tester

`tests/integrations/agreementInvoiceCreateProvider.test.ts` (8 cases):
- Happy path
- Idempotency (already SENT)
- 409 conflict
- Missing customer
- Inline product ensure
- 503 transient
- 400 permanent
- Provider creds not configured

---

## 10. Neste steg

**TPT-B-5:** Cron `/api/cron/tripletex-agreements-daily` + auto-sync wiring.

**Manuell smoke:** Seed provider Tripletex test-creds via `lp_provider_set_tripletex_credentials` før end-to-end mot Tripletex test-env.
