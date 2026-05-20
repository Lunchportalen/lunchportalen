# TRIPLETEX-PLAN-V1 — Master-plan for Tripletex-integrasjon

**Versjon:** v2 (2026-05-20 — utvidet med Provider→Company billing)
**Status:** Aktiv (post-Phase E + MP1–MP5)
**Eier:** Lunchportalen-arkitektur
**Referanser:** PROVIDER-PLAN-V1 (commit `08b3cf49`), Patch 15 (commit `5cca370c`), MP5 (commit `75a55235`)

---

## 1. Mål og scope

**Mål:** Full automatisering av begge billing-flyter via Tripletex.

### Flow A: Superadmin → Provider (SaaS-fee)
- Lunchportalen tar SaaS-fee fra hver provider (etablert i Patch 15)
- **Månedlig, etterskudd, 14 dagers forfall**
- Bruker **Lunchportalen's egen Tripletex-konto**
- Tripletex Customer = Provider

### Flow B: Provider → Company (måltids-fakturaer)
- Provider fakturerer sine kunder (companies) for leverte måltider
- **Provider velger frekvens per agreement: hver 14. dag ELLER månedlig**
- Bruker **Provider's egen Tripletex-konto** (Lunchportalen er proxy/middleware)
- Tripletex Customer = Company

### I scope
- Begge flyter automatisert end-to-end
- Multi-tenant Tripletex (én Lunchportalen-konto + N provider-kontoer)
- Per-agreement frekvens-valg (BIWEEKLY/MONTHLY)
- Paid-status sync (begge flyter, via webhook + polling)
- Audit-log + retry-håndtering
- Token-rotasjon per konto

### IKKE i scope
- Lunchportalen fakturerer Company direkte (**eksplisitt forbudt** — det er Provider's relasjon)
- Recipe & Margin Engine (Phase F)
- Multi-currency (kun NOK)
- Voucher/posting-eksport
- Lønn/payroll

---

## 2. Datamodell-mapping

### Flow A (Lunchportalen's Tripletex)

| Lunchportalen | Tripletex | Notes |
|---|---|---|
| `providers` (én rad) | `Customer` | Lagret: `providers.tripletex_customer_id` |
| `provider_subscriptions` | (intern state) | Tripletex ser kun per-invoice-beløp |
| `provider_invoices` | `Invoice` | Lagret: `provider_invoices.tripletex_invoice_id` |
| `billing_products.tier` | `Product` | 3 produkter i Lp's Tripletex |
| `billing_tax_codes.MVA_15` | `VatType` "Mat" | Lagret: `billing_tax_codes.tripletex_vat_type_id` |
| `providers.billing_org_number` | `Customer.organizationNumber` | Norsk org.nr. (9 siffer) |
| `providers.billing_email` | `Customer.email` | Send via EMAIL eller EHF |

### Flow B (Provider's Tripletex, per provider)

| Lunchportalen | Provider's Tripletex | Notes |
|---|---|---|
| `companies` (én rad) | `Customer` i provider's konto | Lagret: `companies.tripletex_customer_ids` JSONB per-provider |
| `agreements` | (subscription-kontekst) | Frekvens lagret på agreement |
| `agreement_invoices` (NY) | `Invoice` | Lagret: `agreement_invoices.tripletex_invoice_id` |
| `billing_products.tier` | `Product` | Mapping per provider |
| `provider_tripletex_credentials` (NY) | (auth) | Encrypted consumer + employee token |

### Ny tabell: `agreement_invoices`

```sql
CREATE TABLE public.agreement_invoices (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    agreement_id         uuid NOT NULL REFERENCES agreements(id),
    provider_id          uuid NOT NULL REFERENCES providers(id),
    company_id           uuid NOT NULL REFERENCES companies(id),
    invoice_period_start date NOT NULL,
    invoice_period_end   date NOT NULL,
    billing_frequency    text NOT NULL CHECK (
        billing_frequency IN ('BIWEEKLY', 'MONTHLY')),
    invoice_number       text,
    amount_net           numeric(10,2) NOT NULL,
    amount_tax           numeric(10,2) NOT NULL,
    amount_total         numeric(10,2) NOT NULL,
    tax_code_id          text NOT NULL REFERENCES billing_tax_codes(id),
    status               text NOT NULL CHECK (
        status IN ('DRAFT','PENDING_SYNC','SENT','PAID','OVERDUE',
                   'SYNC_FAILED','VOID')),
    tripletex_invoice_id text,
    due_date             date,
    sent_at              timestamptz,
    paid_at              timestamptz,
    metadata             jsonb DEFAULT '{}'::jsonb,
    created_at           timestamptz NOT NULL DEFAULT now(),
    UNIQUE (agreement_id, invoice_period_start, invoice_period_end)
);
```

### Nye felt på `agreements`

- `billing_frequency` ENUM (`BIWEEKLY` | `MONTHLY`), default `MONTHLY`
- `billing_anchor_date` date — start-dato for periode-rytmen
- `last_invoiced_at` timestamptz — for cron-scheduling

### Ny tabell: `provider_tripletex_credentials`

Lagrer encrypted Tripletex-credentials per provider. Bruker pgsodium eller Supabase Vault. Aldri logget i klartekst.

---

## 3. Arkitekturprinsipper

**P1 — Lunchportalen er source-of-truth for begge flyter.**
Tripletex (både Lp's og providers') synker FRA Lunchportalen.

**P2 — Provider's Tripletex-credentials er secrets.**
Lagres kryptert. Provider-admin setter via UI. Lunchportalen-superadmin har IKKE direkte tilgang til klartekst.

**P3 — Idempotency overalt.**
Hver invoice har unique constraint på (agreement_id, period_start, period_end) eller (provider_id, invoice_period). Tripletex-objects opprettes med Lp-ID som external reference.

**P4 — Defense-in-depth for status sync.**
- Primær: webhook per Tripletex-konto
- Sekundær: hourly polling
- Tertiær: manuell admin-reconciliation

**P5 — Env-isolation absolutt.**
- Lp staging → Lp Tripletex TEST (`api-test.tripletex.tech`)
- Lp prod → Lp Tripletex PROD (`tripletex.no/v2`)
- Provider's Tripletex: Provider velger selv (typisk PROD)
- Hardcoded env-check ved client init

**P6 — Audit-log på alle Tripletex-mutations.**
Bruker `lifecycle_audit_log` med `entity_type='tripletex_sync'`. Lagrer Tripletex requestID + response for debugging.

**P7 — Fail-soft på sync-feil.**
Retry-queue med exponential backoff (1m → 5m → 30m → 2h → 12h). Etter 5 retries: DEAD-state + admin-alert.

**P8 — Session-token-rotasjon automatisk per konto.**
Tripletex session-tokens utløper (max 7 dager). Cache med auto-refresh. Retry på 401.

**P9 — Multi-tenant Tripletex per provider.**
Hver Provider har egen Tripletex-konto. Lunchportalen håndterer N+1 Tripletex-kontoer (Lp + N providers). Token-cache per `(provider_id, env)`.

**P10 — Provider eier sin Tripletex-data.**
Lunchportalen synker, men sletter ikke. Hvis Provider sletter integrasjon: Lunchportalen slutter å syke, men data i Tripletex forblir.

---

## 4. End-to-end sekvenser

### Sekvens A1: Provider-onboarding → Lp's Tripletex Customer

```
1. Public registration → /registrer (Patch 13)
2. Superadmin godkjenner via lp_approve_registration_as_provider
3. Provider opprettes (providers row)
4. TPT-A-trigger: opprett Customer i Lp's Tripletex
   - Lunchportalen: insert tripletex_jobs (customer_create)
   - Cron: les jobs, kall Lp Tripletex POST /v2/customer
   - Lagre providers.tripletex_customer_id
   - Audit: 'customer_created_in_lp_tripletex'
5. Ved fail: SYNC_FAILED-state, retry, admin-alert
```

### Sekvens A2: Månedlig SaaS-fee → Lp's Tripletex Invoice

```
1. Cron (1. hver måned 03:00 UTC):
   - For hver ACTIVE subscription:
     - lp_provider_generate_invoice_for_period (eksisterer fra Patch 15)
     - status = DRAFT → PENDING_SYNC
2. TPT-A-job: konverter PENDING_SYNC til Tripletex Invoice
   - Konstruer Invoice med:
     - customer = provider.tripletex_customer_id
     - invoiceDate = invoice_period (1. i måneden)
     - dueDate = invoice_period + 14 dager
     - orderLines: én linje med product + vatType + monthly_amount
     - isPrioritizeAmountsIncludingVat = false
   - POST /v2/invoice
   - Lagre tripletex_invoice_id
   - status = SENT
3. Tripletex sender via Customer.invoiceSendMethod (EMAIL/EHF)
4. Audit: 'invoice_sent_to_lp_tripletex' + requestID
```

### Sekvens B1: Provider Tripletex-onboarding (NY)

```
1. Provider-admin navigerer til /leverandor/tripletex
2. Skriver inn consumer + employee token (test eller prod, velger env)
3. Lunchportalen tester credentials:
   - PUT /token/session/:create
   - Hvis 200 OK: lagre kryptert i provider_tripletex_credentials
   - Hvis fail: vis feilmelding, ikke lagre
4. Auto-sync 3 Products + MVA_15 VatType til provider's Tripletex
   - POST /v2/product × 3 (Lunsj Basis, Luxus, Enterprise)
   - GET /v2/ledger/vatType, finn "Mat" (15%)
   - Lagre IDs i provider_tripletex_product_mappings
5. Audit: 'tripletex_credentials_added' + 'tripletex_products_synced'
```

### Sekvens B2: Company → Provider's Tripletex Customer (NY)

```
1. Når agreement opprettes (provider ↔ company):
   - Sjekk: har provider Tripletex-credentials?
     - Hvis nei: enqueue customer-sync som PENDING_PROVIDER_TPT_SETUP
     - Hvis ja: enqueue customer-sync som READY
2. TPT-B-job: opprett Customer i provider's Tripletex
   - Decrypt provider's credentials
   - POST /v2/customer (i provider's konto)
   - Lagre tripletex_customer_id i companies.tripletex_customer_ids
     med key = provider_id
3. Audit: 'customer_created_in_provider_tripletex'
```

### Sekvens B3: Måltids-faktura → Provider's Tripletex Invoice (NY)

```
1. Cron (hver dag 02:00 UTC):
   - For hver ACTIVE agreement:
     - Sjekk billing_frequency:
       - BIWEEKLY: hvis siste invoice + 14 dager <= now() → generer
       - MONTHLY: hvis siste invoice var forrige måned → generer
2. lp_agreement_generate_invoice(agreement_id, period_start, end):
   - Aggreger orders i perioden per tier
   - amount_net = sum(orders × tier_price)
     - BASIS: 90 NOK/måltid
     - LUXUS: 130 NOK/måltid
     - ENTERPRISE: 170 NOK/måltid
   - amount_tax = amount_net × 0.15 (MVA mat)
   - amount_total = amount_net + amount_tax
   - INSERT agreement_invoices status=DRAFT
3. TPT-B-job: konverter DRAFT til provider's Tripletex Invoice
   - Decrypt provider's credentials
   - Konstruer Invoice:
     - customer = company.tripletex_customer_ids[provider_id]
     - invoiceDate = today
     - dueDate = today + 14 dager
     - orderLines: én per dag/tier (eller én aggregert per tier)
   - POST provider's Tripletex /v2/invoice
   - Lagre tripletex_invoice_id
   - status = SENT
4. Tripletex sender til company.billing_email
5. Audit
```

### Sekvens B4: Paid-status sync (Flow B)

```
Variant 1 — Webhook:
1. Provider's Tripletex POST → /api/webhooks/tripletex-provider/[provider_id]
2. Verify HMAC (per-provider secret stored ved credentials-setup)
3. Lookup tripletex_invoice_id → agreement_invoices
4. status = PAID, paid_at = now()
5. Audit

Variant 2 — Polling (hourly):
1. Cron: SELECT FROM agreement_invoices WHERE status='SENT'
2. For hver: decrypt provider credentials, GET /v2/invoice/{id}
3. Hvis amountOutstanding = 0: status = PAID
4. Hvis date > due_date + 7 dager: status = OVERDUE
```

---

## 5. Patch-breakdown

### FLOW A (TPT-A-1 → TPT-A-7) — Lunchportalen → Provider

**TPT-A-1: Foundation**
- `lib/tripletex/client.ts` (generisk HTTP-client)
- `lib/tripletex/auth.ts` (session-token rotation, cache)
- `lib/tripletex/types.ts` (DTOs: Customer, Invoice, Product, VatType)
- `lib/tripletex/config.ts` (env-isolation guard)
- `tripletex_sync_state` + `tripletex_jobs` tabeller
- Env: `TRIPLETEX_CONSUMER_TOKEN_TEST/PROD`, `EMPLOYEE_TOKEN_TEST/PROD`
- **Estimat: 60–90 min**

**TPT-A-2: Lp Tax + Product mapping**
- Sync 3 Products + VatType til Lp's Tripletex
- Migration: `tripletex_product_id` på billing_products, `tripletex_vat_type_id` på billing_tax_codes
- Admin UI for manual re-sync
- **Estimat: 45–60 min**

**TPT-A-3: Provider Customer sync (i Lp's Tripletex)**
- Trigger på provider-godkjenning
- POST /v2/customer i Lp's konto
- Lagre `providers.tripletex_customer_id`
- **Estimat: 60–90 min**

**TPT-A-4: SaaS Invoice generation**
- `provider_invoices` DRAFT → Lp's Tripletex Invoice
- Modifisér `lp_provider_generate_invoice_for_period` til å enqueue invoice_send-job
- Map til Tripletex Invoice-objekt
- **Estimat: 90–120 min**

**TPT-A-5: Cron + scheduling (Flow A)**
- `app/api/cron/tripletex-monthly-saas/route.ts` (1. hver måned)
- `app/api/cron/tripletex-poll-status-lp/route.ts` (hver time)
- `vercel.json` cron-config
- **Estimat: 45–60 min**

**TPT-A-6: Webhook handler (Lp)**
- `app/api/webhooks/tripletex/route.ts`
- HMAC-verifisering
- Idempotency på event_id
- **Estimat: 60–90 min**

**TPT-A-7: Admin UI (Lp)**
- `/superadmin/tripletex` (dashboard, queue, retry)
- `/superadmin/tripletex/jobs` (queue inspector)
- `/superadmin/providers/[id]/tripletex` (per-provider)
- **Estimat: 60–90 min**

**Flow A total: ~7–10 timer**

---

### FLOW B (TPT-B-1 → TPT-B-7) — Provider → Company

**TPT-B-1: Provider credentials vault**
- `provider_tripletex_credentials` tabell (encrypted via pgsodium eller Supabase Vault)
- Provider-side UI: `/leverandor/tripletex` (set/test credentials)
- RPC: `lp_provider_save_tripletex_credentials`, `lp_provider_test_tripletex_connection`
- Hardregler: Lunchportalen-superadmin har IKKE read-access til klartekst
- **Estimat: 90–120 min**

**TPT-B-2: Per-provider Product/VatType sync**
- Når credentials lagres: auto-sync 3 Products + VatType til provider's Tripletex
- Lagre IDs i `provider_tripletex_product_mappings`
- Manual re-sync fra `/leverandor/tripletex`
- **Estimat: 60–90 min**

**TPT-B-3: Company → Provider's Tripletex Customer sync**
- Trigger på agreement-creation (når provider og company kobles)
- POST /v2/customer i provider's Tripletex
- `companies.tripletex_customer_ids` JSONB (per-provider mapping)
- **Estimat: 60–90 min**

**TPT-B-4: Agreement billing-frekvens + agreement_invoices tabell**
- Migration: `agreement_invoices` + `agreements.billing_frequency`, `billing_anchor_date`, `last_invoiced_at`
- RPC: `lp_agreement_set_billing_frequency`
- Provider-UI: `/leverandor/kunder/[id]` viser frekvens-velger
- **Estimat: 60–90 min**

**TPT-B-5: Invoice generering per agreement**
- RPC: `lp_agreement_generate_invoice_for_period`
- Aggreger orders per periode + tier
- Beregn amount_net/tax/total
- **Estimat: 90–120 min**

**TPT-B-6: Cron + scheduling (BIWEEKLY + MONTHLY)**
- `app/api/cron/tripletex-daily-agreements/route.ts` (daglig)
- For hver agreement: sjekk om periode utløpt, generer invoice
- `app/api/cron/tripletex-poll-status-providers/route.ts` (hver time)
- **Estimat: 60–90 min**

**TPT-B-7: Webhook + admin UI (per provider)**
- `app/api/webhooks/tripletex-provider/[provider_id]/route.ts`
- `/leverandor/faktura` utvidet med agreement-fakturaer (sin-fakturaer-til-kunder-tab)
- Per-provider retry/reconciliation UI
- **Estimat: 90–120 min**

**Flow B total: ~8–12 timer**

---

### TOTAL ESTIMAT: ~15–22 timer Cursor-tid

Realistisk: 2–3 sesjoner à 6–8 timer.

---

## 6. Risk register

| Risk | Sannsynlighet | Impact | Mitigering |
|---|---|---|---|
| Provider's credentials leaker | Lav | Kritisk | pgsodium-encrypted, RLS-beskyttet, audit-log på read |
| Test-data leaker til prod | Lav | Kritisk | Env-isolation, hardcoded check, separate API hosts |
| Duplicate invoices | Medium | Høy | Idempotency-keys, UNIQUE constraints |
| Tripletex API down | Lav | Medium | Retry-queue, manual fallback |
| Session token expires mid-request | Medium | Lav | Auto-refresh + retry på 401 |
| Webhook spoofing | Lav | Kritisk | HMAC per Tripletex-konto |
| Mapping out-of-sync (Customer renames) | Medium | Medium | Daily drift-check |
| Provider sletter credentials | Lav | Medium | Soft-disable, beholde data |
| Stuck jobs (uendelig retry) | Medium | Lav | Max 5 retries → DEAD-state |
| Frekvens-endring mid-periode | Medium | Lav | Snapshot frekvens på agreement_invoice (immutable) |
| Company med flere providers | Lav | Lav | tripletex_customer_ids JSONB per-provider |
| MVA-regler endrer seg | Lav | Lav | VatType lest fra Tripletex, ikke hardkodet |

---

## 7. Discovery-checklist (kjør før TPT-A-1)

- [ ] `lib/tripletex/*` — eksisterende kode (Patch 2.1 nevnte "deprecated som orphan")
- [ ] `provider_invoices.tripletex_invoice_id` — finnes (Patch 15)
- [ ] `companies` — finnes `tripletex_customer_ids`-felt?
- [ ] `agreements` — finnes `billing_frequency`-felt?
- [ ] Vercel cron-infrastruktur — hvordan registreres jobs?
- [ ] Vercel env-vars for Lp's Tripletex (TEST + PROD)
- [ ] Supabase Vault tilgjengelig? pgsodium installert?
- [ ] Tripletex test-konto detaljer: company_id, eksisterende Products, hvilken VatType-ID har "Mat 15%"
- [ ] Provider-godkjenning RPC (Patch 13) — kan vi hooke inn TPT-trigger?
- [ ] Agreement-creation flow — hvor opprettes agreements?

---

## 8. Success criteria

### Flow A
- Ny provider → Lp's Tripletex Customer opprettes automatisk
- Månedlig: SaaS-faktura sendt fra Lunchportalen til provider via Lp's Tripletex
- Provider betaler → status synkes tilbake innen 1 time

### Flow B
- Provider setter Tripletex-credentials i `/leverandor/tripletex`
- Provider velger frekvens per agreement (BIWEEKLY/MONTHLY)
- Company → Customer i provider's Tripletex (auto)
- Hver 14d eller månedlig: faktura genereres + sendes via provider's Tripletex
- Company betaler → status synkes tilbake til Lunchportalen innen 1 time

### End-to-end
- Provider onboarder seg → blir godkjent → får SaaS-faktura månedlig fra Lunchportalen
- Provider får kunde (company) → setter agreement med BIWEEKLY/MONTHLY
- Company mottar måltids-fakturaer på valgt frekvens via provider's Tripletex
- Lunchportalen er aldri direkte i Provider→Company fakturarelasjonen

---

## 9. Rollback-strategi (per patch)

| Patch | Rollback |
|---|---|
| TPT-A-1 | Drop `tripletex_sync_state` + `tripletex_jobs`, fjern `lib/tripletex/*` |
| TPT-A-2 | Sett `tripletex_product_id` + `vat_type_id` til NULL |
| TPT-A-3 | Drop trigger på provider-godkjenning |
| TPT-A-4 | Status tilbake til DRAFT, fjern Tripletex-refs |
| TPT-A-5 | Disable cron i `vercel.json` |
| TPT-A-6 | Disable webhook-route |
| TPT-A-7 | UI revert |
| TPT-B-1 | Drop `provider_tripletex_credentials`, slett Vault-secrets |
| TPT-B-2 | Drop `provider_tripletex_product_mappings` |
| TPT-B-3 | Drop `tripletex_customer_ids` fra companies |
| TPT-B-4 | Drop `agreement_invoices`, drop `agreements.billing_frequency` |
| TPT-B-5 | Drop RPC |
| TPT-B-6 | Disable cron |
| TPT-B-7 | UI revert + disable webhook |

**Total rollback:** Mulig per patch. Full rollback krever manuell Tripletex-opprydding (Customers, Invoices, Products) hvis ønskelig. Beste praksis: forward-fix.

---

## 10. Åpne spørsmål (krever brukerens beslutning før TPT-B-1)

1. **Provider's Tripletex-konto:** Antar at hver provider HAR egen konto. Bekreft.
2. **Encrypted credentials:** Supabase Vault eller pgsodium? Default: Vault hvis tilgjengelig, ellers pgsodium-extension.
3. **Frekvens-default:** MONTHLY for nye agreements? Default i CHECK constraint.
4. **Hvis Provider ikke har Tripletex:** Skal måltids-fakturaer genereres uten å sendes (Lunchportalen-only) som backup, eller blokkeres helt? Default: blokkeres med tydelig UI-feedback.
5. **Sletting av agreement_invoices:** Norge krever 5 års oppbevaring av regnskapsbilag. Default: ingen auto-sletting.

---

## 11. Tekniske referanser

- **Tripletex API base URL (prod):** `https://tripletex.no/v2/`
- **Tripletex API base URL (test):** `https://api-test.tripletex.tech/v2/`
- **Auth-flyt:** `PUT /token/session/:create?consumerToken=X&employeeToken=Y&expirationDate=Z` → session token
- **Authorization header:** `Basic <base64(companyId:sessionToken)>`, companyId = 0 for primary
- **Session-token utløp:** Maks 7 dager fra nå
- **Dokumentasjon:** [developer.tripletex.no/docs](https://developer.tripletex.no/docs)
- **OpenAPI:** [tripletex.no/v2-docs](https://tripletex.no/v2-docs)
- **Conventions:**
  - Actions har `:` prefix (f.eks. `/v2/invoice/{id}/:send`)
  - Aggregations har `>` prefix (f.eks. `/v2/hours/>thisWeeksBillables`)
  - `requestID` returneres i alle responses for debug
  - `fields=*,subElement(*)` for expanded responses

---

**Next:** TPT-A-1 (Foundation) etter discovery + svar på åpne spørsmål.
