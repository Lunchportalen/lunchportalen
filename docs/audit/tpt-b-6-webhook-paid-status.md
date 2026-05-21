# TPT-B-6 — Webhook paid-status sync (Flow B reverse)

**Dato:** 2026-05-21  
**Plan:** TRIPLETEX-PLAN-V1 v3.12 §5 TPT-B-6  
**Forrige:** TPT-B-5 (`d946606f`)

---

## Leveranse

| Komponent | Path |
|-----------|------|
| Webhook endpoint | `POST /api/webhooks/tripletex-provider/[providerId]?env=prod\|test` |
| Signatur/auth | `lib/integrations/tripletex/verifyTripletexWebhookSignature.ts` (gjenbruk Flow A) |
| Handlers | `lib/integrations/tripletex/agreementWebhookHandlers.ts` |
| Idempotency key | `lib/integrations/tripletex/providerTripletexWebhookEventId.ts` |
| Re-verifisering | `getTripletexInvoicePaymentStatus()` i `client.ts` |
| DB idempotency | `public.tripletex_webhook_events` |
| Webhook secrets | `public.provider_tripletex_webhook_secrets` (Vault) |
| Migrasjon | `20260601120000_tpt_b6_webhook_paid_status.sql` |

### RPCs

| RPC | Auth | Formål |
|-----|------|--------|
| `lp_provider_rotate_webhook_secret` | `provider_admin` / superadmin | Genererer og lagrer per-provider secret (returneres én gang) |
| `lp_provider_load_webhook_secret` | `service_role` | Leser secret fra Vault for webhook-endpoint |
| `lp_apply_tripletex_paid_status` | `service_role` | `agreement_invoices` SENT → PAID + audit |

### Migrasjon apply

| Miljø | Project ref | Applied (MCP) | Verifisert |
|-------|-------------|---------------|------------|
| **Staging** | `uigxsboqeruxflgzqztl` | 2026-05-21 | `tripletex_webhook_events` + RPCs |
| **Prod** | `hkpokyapzarefrgqzkos` | 2026-05-21 | `tripletex_webhook_events` + RPCs |

---

## Tripletex webhook-sannhet

Tripletex har **native webhooks** (ikke polling). Auth er **custom header / Bearer secret** — ikke body-HMAC fra Tripletex.

LP implementerer (samme som Flow A):

1. **Primær:** custom header (`X-Lunchportalen-Tripletex-Webhook` eller per-subscription `authHeaderName`)
2. **Alternativ:** `Authorization: Bearer <secret>`
3. **Valgfri HMAC:** `X-Lunchportalen-Tripletex-Signature` = `HMAC-SHA256(hex)` over raw body (defense in depth)

Per-provider secret lagres i **Supabase Vault** via `lp_provider_rotate_webhook_secret` — ikke Vercel env.

### Events (Flow B)

| Tripletex `event` | Handler | Effekt |
|-------------------|---------|--------|
| `closegroup.create` | `handleTripletexProviderPaidStatusUpdate` | OCR/betaling → re-verify → SENT → PAID |
| `invoice.paid` | samme (forward-compat alias) | SENT → PAID |
| `order.update` | samme (hvis paid-signaler) | re-verify før transition |

Ukjent event → `tripletex_webhook_events.status = IGNORED`, HTTP **200**.

---

## Auth / signatur (før alt annet)

```
POST /api/webhooks/tripletex-provider/{providerId}?env=prod
  → valider UUID providerId
  → lp_provider_load_webhook_secret (Vault)
  → verifyTripletexWebhookSignature(rawBody, secret)  ← FØRST etter secret load
  → mismatch → 401 + audit tripletex_provider_webhook_signature_rejected
```

- **Timing-safe compare** via `crypto.timingSafeEqual` (Flow A helper)
- Raw body leses **før** JSON-parse (HMAC krever uendret payload)

---

## Re-verifisering (defense in depth)

Etter signatur-pass og idempotency-insert:

```
GET /v2/invoice/:id  (fallback GET /v2/order/:id)
  → resolveTripletexAuth({ providerId, env })
  → amountOutstanding <= 0  ⇒ paid
  → ellers: audit + 200 noop (REVERIFY_NOT_PAID)
  → 5xx/transient: event forblir PENDING, HTTP 200 (Tripletex retry)
```

Aldri stol på webhook payload alene — beskytter mot kompromittert secret eller feil event.

---

## Idempotency

- Nøkkel: `tripletex:{providerId}:{env}:{subscriptionId}:{event}:{id}` (UNIQUE i `tripletex_webhook_events`)
- Duplikat INSERT conflict → HTTP 200 `{ duplicate: true }`, ingen ny side-effect
- Ukjent `agreement_invoices`-rad → RPC `NOT_FOUND`, HTTP 200

---

## State machine

Kun **SENT → PAID** tillatt via `lp_apply_tripletex_paid_status`:

| Current | Action |
|---------|--------|
| `SENT` | UPDATE PAID + `paid_at` + `last_status_change` + audit `agreement_invoice_paid` |
| `PAID` | noop (`ALREADY_PAID`) |
| `DRAFT` / annet | audit `agreement_invoice_paid_transition_rejected`, noop |

---

## Retry-strategi

| Scenario | HTTP | Event status |
|----------|------|--------------|
| Ugyldig/manglende signatur | **401** | — |
| Forstått event, håndtert | **200** | PROCESSED / IGNORED |
| Duplikat event_id | **200** | — |
| Re-verify transient (5xx) | **200** | PENDING (Tripletex sender på nytt) |
| Handler-feil (permanent) | **200** | FAILED + audit |

Tripletex retrier non-2xx aggressivt — derfor **alltid 2xx** unntatt auth-feil.

---

## Secret rotation

```
provider_admin → lp_provider_rotate_webhook_secret(provider_id, env)
  → extensions.gen_random_bytes(32) → hex
  → vault.create_secret
  → provider_tripletex_webhook_secrets upsert
  → audit tripletex_webhook_secret_rotated
  → return { webhook_secret }  ← kun denne responsen
```

Secret deles via sikker kanal til provider ved onboarding (TPT-B-7). Webhook-URL-registrering i provider's Tripletex er **manuell** inntil B-7.

### Webhook-URL (manuell)

```
https://app.lunchportalen.no/api/webhooks/tripletex-provider/{providerId}?env=prod
```

Registrer hos Tripletex for: `closegroup.create` (primær betaling), ev. `order.update`.

---

## Tester

| Fil | Cases |
|-----|-------|
| `tests/api/webhook-tripletex-provider.test.ts` | 11 (HMAC, idempotency, re-verify, transitions) |
| `tests/db/lp_apply_tripletex_paid_status.test.ts` | 4 (SENT→PAID, DRAFT reject, PAID noop, auth) |
| `tests/db/lp_provider_rotate_webhook_secret.test.ts` | 3 (provider_admin, cross-provider deny, rotation) |

---

## Ikke i scope

- Webhook-URL auto-registrering (TPT-B-7)
- Provider UI for paid-status (TPT-B-7)
- Credit notes / VOID
- Late-payment reminders

---

## Aktivering

Endpoint er live ved deploy, men **ingen provider sender** før:

1. `lp_provider_rotate_webhook_secret` er kjørt
2. Secret er konfigurert i Tripletex subscription
3. Webhook-URL er registrert i provider's Tripletex
