# TPT-A-6 — Webhook handler (Tripletex Flow A)

**Dato:** 2026-05-21  
**Plan:** TRIPLETEX-PLAN-V1 v3.5 §5 TPT-A-6  
**Forrige:** TPT-A-5 (`67f33033`)

---

## Leveranse

| Komponent | Path |
|-----------|------|
| Webhook endpoint | `POST /api/webhooks/tripletex` |
| Signatur/auth | `lib/integrations/tripletex/verifyTripletexWebhookSignature.ts` |
| Handlers | `lib/integrations/tripletex/webhookHandlers.ts` |
| Idempotency key | `lib/integrations/tripletex/tripletexWebhookEventId.ts` |
| DB audit store | `public.webhook_events` |
| Migrasjon | `20260526120000_tpt_a6_webhook_events.sql` |

### Migrasjon apply

| Miljø | Project ref | Applied (MCP) | Verifisert |
|-------|-------------|---------------|------------|
| **Staging** | `uigxsboqeruxflgzqztl` | 2026-05-21 | `to_regclass('public.webhook_events')` + 10 kolonner |
| **Prod** | `hkpokyapzarefrgqzkos` | 2026-05-21 | `to_regclass('public.webhook_events')` |

---

## Tripletex webhook-sannhet (discovery)

Tripletex dokumenterer **ikke** body-HMAC. Anbefalt auth er **custom header** på subscription (`authHeaderName` / `authHeaderValue`).

LP implementerer:

1. **Primær:** `X-Lunchportalen-Tripletex-Webhook: <TRIPLETEX_WEBHOOK_SECRET>` (overstyres med `TRIPLETEX_WEBHOOK_AUTH_HEADER`)
2. **Alternativ:** `Authorization: Bearer <secret>`
3. **Valgfri HMAC:** `X-Lunchportalen-Tripletex-Signature` = `HMAC-SHA256(hex)` over raw body (tester + replay)

### Native Tripletex-events (prod-subscription)

| Tripletex `event` | LP-handler | `provider_invoices` |
|-------------------|------------|---------------------|
| `invoice.charged` | `handleInvoiceCharged` | `DRAFT` → `SENT` (match `tripletex_invoice_id`) |
| `closegroup.create` | `handleCloseGroupCreate` → `handleInvoicePaid` | `SENT`/`OVERDUE` → `PAID` |
| `customer.update` | `handleCustomerUpdated` | audit only (mapping finnes) |

### Interne / test-alias (ikke sendt av Tripletex som standard)

| `event` | Handler | Effekt |
|---------|---------|--------|
| `invoice.paid` | `handleInvoicePaid` | → `PAID` |
| `invoice.voided` | `handleInvoiceVoided` | → `VOID` |
| `customer.updated` | `handleCustomerUpdated` | audit |

Ukjent `event` → `webhook_events.status = IGNORED`, HTTP **200** (unngår retry-storm).

---

## Event-dispatch

```
POST /api/webhooks/tripletex
  → rate-limit (120/min per IP, best-effort)
  → verifyTripletexWebhookSignature (FØRST)
  → parse JSON
  → event_id = tripletex:{subscriptionId}:{event}:{id}
  → idempotency SELECT webhook_events
  → INSERT webhook_events PENDING
  → lifecycle_audit_log tripletex_webhook_received
  → dispatchTripletexWebhookEvent
  → UPDATE webhook_events PROCESSED | FAILED | IGNORED
  → lifecycle_audit_log processed/failed
  → HTTP 200 { ok, rid, data: { received } }  (selv ved handler-feil)
```

Ugyldig signatur → **401** `{ ok:false, rid, error, message }` (generisk «Unauthorized») + audit `tripletex_webhook_signature_rejected`.

---

## Idempotency

- Nøkkel: `event_id` UNIQUE i `webhook_events`
- Duplikat: HTTP 200 `{ received, duplicate: true }`, ingen ny side-effect
- Ukjent Tripletex-faktura: `FAILED` + `error_detail`, fortsatt HTTP 200 til Tripletex

---

## Env

| Variabel | Formål |
|----------|--------|
| `TRIPLETEX_WEBHOOK_SECRET` | Shared secret (påkrevd) |
| `TRIPLETEX_WEBHOOK_AUTH_HEADER` | Valgfri header-navn (default `X-Lunchportalen-Tripletex-Webhook`) |

Secret i **Vercel env** (ikke Vault) for Flow A — én LP Tripletex-konto. Flow B (TPT-B-6) bruker Vault per provider.

---

## Webhook-registrering (manuell)

Tripletex test-env og prod:

```http
POST https://tripletex.no/v2/event/subscription
{
  "event": "invoice.charged",
  "targetUrl": "https://app.lunchportalen.no/api/webhooks/tripletex",
  "authHeaderName": "X-Lunchportalen-Tripletex-Webhook",
  "authHeaderValue": "<TRIPLETEX_WEBHOOK_SECRET>"
}
```

Gjenta for: `closegroup.create`, `customer.update` (og ev. `customer.create`).

Preview/staging URL: tilsvarende host for staging-deploy.

---

## Tester

`tests/api/webhooks/tripletex.test.ts` — 7 cases:

1. Manglende signatur → 401 + audit rejected  
2. Ugyldig signatur → 401  
3. `invoice.paid` → `PAID` + `PROCESSED`  
4. Duplikat `event_id` → 200, ingen dobbel status  
5. Ukjent event → `IGNORED`  
6. Ukjent faktura → `FAILED` / `UNKNOWN_INVOICE`, HTTP 200  
7. Mock DB-feil → `FAILED`, HTTP 200  

---

## Ikke i scope

- Flow B per-provider webhook (`/api/webhooks/tripletex-provider/[id]`)  
- Admin UI (TPT-A-7)  
- Auto-registrering hos Tripletex API  
- E-postvarsler ved `PAID`
