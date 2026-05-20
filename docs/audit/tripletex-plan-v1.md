# TRIPLETEX-PLAN-V1 — Master-plan for Tripletex-integrasjon

**Versjon:** v3 (2026-05-20 — revidert etter pre-discovery)
**Status:** Aktiv (post-Phase E + MP1-5)
**Eier:** Lunchportalen-arkitektur
**Referanser:** PROVIDER-PLAN-V1 (`08b3cf49`), Patch 15 (`5cca370c`), MP5 (`75a55235`), Pre-discovery 2026-05-20

---

## ⚠️ Endringslogg v2 → v3

Pre-discovery 2026-05-20 avdekket at v2 antok grønnfelt der det allerede finnes betydelig infrastruktur. v3 justerer scope og navn til å reflektere virkeligheten.

**Hovedendringer:**

1. **Eksisterende kanonisk Tripletex-klient** (`lib/integrations/tripletex/*`) — vi bygger PÅ den, ikke ny fra null. Legacy `lib/tripletex/client.ts` slettes som orphan.
2. **DB-navn-konvensjon justert** til eksisterende mønster: `tripletex_vat_code`, `tripletex_customers.external_customer_id`, `billing_cycle`.
3. **Provider-onboarding RPC mangler** — `lp_company_registration_approve_provider` er for *company*-godkjenning, ikke provider-onboarding. Vi må klargjøre semantikken.
4. **TPT-0 (NY): Schema-drift fix** — `invoice_periods` + `tripletex_exports` mangler på staging selv om kode forventer dem.
5. **Multi-tenant client-strategi** — eksisterende client antar én konto. Vi utvider med credentials-injection per call.
6. **Estimat redusert** fra 15-22 timer til 11-17 timer (mye er bygget).

---

## 0. Eksisterende infrastruktur (discovery 2026-05-20)

### Kanonisk Tripletex-kode (BEHOLD + UTVID)

| Path | LOC | Status | Funksjoner |
|---|---|---|---|
| `lib/integrations/tripletex/client.ts` | 796 | **Aktiv** | `resolveTripletexAuth()`, `ensureCustomer()`, `ensureProduct()`, `createInvoice()` |
| `lib/integrations/tripletexEngine.ts` | 109 | Aktiv | Invoice-orchestration |
| `lib/integrations/tripletexStatusEngine.ts` | 153 | Aktiv | Status-polling |

**Legacy som slettes:** `lib/tripletex/client.ts` (550 LOC, deprecated orphan, 0 imports).

### Eksisterende DB-felter (staging bekreftet)

```
billing_products.tripletex_product_id    -- text
billing_tax_codes.tripletex_vat_code     -- text (NB: ikke vat_type_id)
provider_invoices.tripletex_invoice_id   -- text (Patch 15)
tripletex_customers (company_id, external_customer_id, ...)
tripletex_invoices
```

### Manglende på staging (R1 — BLOCKER)

```
invoice_periods       -- kode forventer, finnes ikke
tripletex_exports     -- kode forventer, finnes ikke
```

### Eksisterende env (dokumentert i `docs/environments-runtime.json`)

`TRIPLETEX_ENABLED`, `TRIPLETEX_BASE_URL`, `TRIPLETEX_COMPANY_ID`, `TRIPLETEX_CONSUMER_TOKEN`, `TRIPLETEX_EMPLOYEE_TOKEN`, `TRIPLETEX_SESSION_TOKEN`, `TRIPLETEX_TOKEN`, `TRIPLETEX_TIMEOUT_MS`, `TRIPLETEX_MAX_RETRIES`, `TRIPLETEX_OUTBOX_CONCURRENCY`, `TRIPLETEX_REVENUE_DEFAULT_{CUSTOMER,PRODUCT,VAT_CODE}_ID`, `TRIPLETEX_CREDIT_CHECK_ENABLED`, `TRIPLETEX_ENABLE_CREDIT_NOTE_FLOW`, `BIWEEKLY_TRIPLETEX_DIRECT_INVOICE_ENABLED`.

Ingen TEST/PROD-suffix i kode — isolasjon via Vercel Preview/Production env-grupper.

### Vault-status

- ✅ `supabase_vault` v0.3.1 installert + schema tilgjengelig
- ❌ `pgsodium` ikke installert (ikke nødvendig)
- ⚠️ Ingen eksisterende app-pattern for Vault read/write — grønnflate

### Eksisterende webhooks

| Route | Pattern |
|---|---|
| `app/api/webhooks/sanity/menu-day/route.ts` | `@sanity/webhook` HMAC |
| `app/api/saas/billing/webhook/route.ts` | Stripe `stripe-signature` |

Tripletex har **ingen** webhook-route ennå.

### Eksisterende cron-mekanisme

Vercel cron via `vercel.json` (12 jobs). Auth via `lib/http/cronAuth.ts`. To Tripletex-relaterte cron-routes finnes allerede men er IKKE registrert i `vercel.json`:

- `app/api/cron/credit-check/route.ts` (Tripletex status-poll)
- `app/api/cron/invoices/generate/route.ts` (invoice_periods + outbox)

---

## 1. Mål og scope

### Flow A: Superadmin → Provider (SaaS-fee)
- Månedlig, etterskudd, 14 dagers forfall
- Lunchportalen's egen Tripletex-konto

### Flow B: Provider → Company (måltids-fakturaer)
- Provider velger frekvens per agreement: hver 14. dag ELLER månedlig
- Provider's egen Tripletex-konto (Lunchportalen er proxy/middleware)

### I scope
- Begge flyter end-to-end
- Multi-tenant Tripletex via credentials-injection
- Per-agreement frekvens (utvide `billing_cycle` med `'biweekly'`)
- Paid-status sync (webhook + polling)
- Audit-log + retry

### IKKE i scope
- Lunchportalen fakturerer Company direkte (forbudt)
- Recipe & Margin Engine (Phase F)
- Multi-currency (NOK only)
- Re-skriving av `tripletexEngine.ts` / `tripletexStatusEngine.ts`

---

## 2. Datamodell-mapping

### Flow A (Lunchportalen's Tripletex)

| Lunchportalen | Tripletex | Felt-navn |
|---|---|---|
| `providers` | `Customer` | I `tripletex_customers` (mapping-tabell) |
| `provider_subscriptions` | (intern) | — |
| `provider_invoices` | `Invoice` | `provider_invoices.tripletex_invoice_id` ✅ |
| `billing_products.tier` | `Product` | `billing_products.tripletex_product_id` ✅ |
| `billing_tax_codes.MVA_15` | `VatType` | `billing_tax_codes.tripletex_vat_code` ✅ |

**Åpent Q1 (§10):** Provider-Customer mapping i `tripletex_customers` (anbefalt) eller ny kolonne på `providers`?

### Flow B (Provider's Tripletex, per provider)

| Lunchportalen | Provider's Tripletex | Felt-navn |
|---|---|---|
| `companies` | `Customer` | `tripletex_customers` utvides med `tripletex_provider_id` |
| `agreements` | (subscription-kontekst) | `agreements.billing_cycle` utvides med `'biweekly'` |
| `agreement_invoices` (NY) | `Invoice` | `agreement_invoices.tripletex_invoice_id` |
| `billing_products.tier` | `Product` | Per-provider i ny `provider_tripletex_products` |
| `provider_tripletex_credentials` (NY) | (auth) | Encrypted via Vault |

### Ny tabell: `agreement_invoices`

```sql
CREATE TABLE public.agreement_invoices (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    agreement_id         uuid NOT NULL REFERENCES agreements(id),
    provider_id          uuid NOT NULL REFERENCES providers(id),
    company_id           uuid NOT NULL REFERENCES companies(id),
    invoice_period_start date NOT NULL,
    invoice_period_end   date NOT NULL,
    billing_cycle        text NOT NULL CHECK (billing_cycle IN ('biweekly', 'monthly')),
    invoice_number       text,
    amount_net           numeric(10,2) NOT NULL,
    amount_tax           numeric(10,2) NOT NULL,
    amount_total         numeric(10,2) NOT NULL,
    tripletex_vat_code   text NOT NULL,
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

### Utvidelser av eksisterende tabeller

```sql
-- agreements: utvide billing_cycle CHECK
ALTER TABLE agreements DROP CONSTRAINT IF EXISTS agreements_billing_cycle_check;
ALTER TABLE agreements ADD CONSTRAINT agreements_billing_cycle_check 
  CHECK (billing_cycle IN ('monthly', 'biweekly'));
ALTER TABLE agreements ADD COLUMN billing_anchor_date date;
ALTER TABLE agreements ADD COLUMN last_invoiced_at timestamptz;

-- tripletex_customers: utvide for multi-tenant
ALTER TABLE tripletex_customers ADD COLUMN tripletex_provider_id uuid REFERENCES providers(id);
-- NULL = Lunchportalen's egen Tripletex (Flow A)
-- non-NULL = provider's Tripletex (Flow B)
```

### Ny tabell: `provider_tripletex_credentials`

```sql
CREATE TABLE public.provider_tripletex_credentials (
    id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id              uuid NOT NULL UNIQUE REFERENCES providers(id),
    env                      text NOT NULL CHECK (env IN ('test', 'prod')),
    consumer_token_secret_id uuid NOT NULL,  -- vault.secrets.id
    employee_token_secret_id uuid NOT NULL,
    company_id_tripletex     text NOT NULL DEFAULT '0',
    webhook_secret_id        uuid,
    last_session_token_at    timestamptz,
    sync_status              text NOT NULL CHECK (
        sync_status IN ('PENDING','READY','DISABLED','FAILED')),
    created_at               timestamptz NOT NULL DEFAULT now(),
    updated_at               timestamptz NOT NULL DEFAULT now()
);
```

### Ny tabell: `provider_tripletex_products`

```sql
CREATE TABLE public.provider_tripletex_products (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id          uuid NOT NULL REFERENCES providers(id),
    tier                 text NOT NULL CHECK (tier IN ('BASIS','LUXUS','ENTERPRISE')),
    tripletex_product_id text NOT NULL,
    tripletex_vat_code   text NOT NULL,
    synced_at            timestamptz NOT NULL DEFAULT now(),
    UNIQUE (provider_id, tier)
);
```

---

## 3. Arkitekturprinsipper

**P1 — Lunchportalen er source-of-truth for begge flyter.**

**P2 — Provider's Tripletex-credentials er secrets** (Vault, aldri logget).

**P3 — Idempotency overalt** (UNIQUE constraints, Lp-ID som external reference).

**P4 — Defense-in-depth for status sync** (webhook + polling + manuell reconciliation).

**P5 — Env-isolation absolutt** (test ↔ test, prod ↔ prod, hardcoded check).

**P6 — Audit-log via `lifecycle_audit_log`** med `entity_type='tripletex_sync'`.

**P7 — Fail-soft på sync-feil** (eksisterende fail-closed-mønster gjenbrukes).

**P8 — Session-token-rotasjon per konto** (eksisterende `resolveTripletexAuth()` utvides).

**P9 — Multi-tenant via credentials-injection, ikke separate clients.**
Én klient — kall med `{ providerId, env }` for provider-creds, eller uten for Lp's (default).

**P10 — Provider eier sin Tripletex-data.** Lunchportalen synker, men sletter ikke. Soft-disable ved credentials-removal.

---

## 4. End-to-end sekvenser

### Sekvens A1: Provider-onboarding → Lp's Tripletex Customer

**ÅPENT Q6:** Ingen `lp_provider_create`-RPC eksisterer. Vi må klargjøre:
- Hvor opprettes en provider i dag? (Sannsynligvis manuelt via superadmin-UI eller SQL)
- Hvilken trigger skal hooke til Tripletex Customer creation?

Sannsynlig flyt (krever bekreftelse):

```
1. Superadmin oppretter provider (manuell SQL eller ny RPC)
2. After-insert trigger / outbox-event:
   enqueue tripletex_customer_create (provider_id, target='lp')
3. Cron leser jobs → lib/integrations/tripletex/client.ts.ensureCustomer()
4. Lagre i tripletex_customers (provider_id=null, external_customer_id=...)
5. Audit
```

### Sekvens A2: Månedlig SaaS-fee → Lp's Tripletex Invoice

```
1. Cron (1. hver måned 03:00): for hver ACTIVE provider_subscriptions:
   - lp_provider_generate_invoice_for_period (Patch 15) → DRAFT
2. TPT-A-job: konverter til Tripletex Invoice via eksisterende
   tripletexEngine.createInvoice()
3. status=SENT, Tripletex sender via email/EHF
4. Audit lifecycle_audit_log (entity_type='tripletex_sync')
```

### Sekvens B1: Provider Tripletex-onboarding

```
1. Provider-admin → /leverandor/tripletex
2. Skriver inn consumer + employee token + velger env (test/prod)
3. Lunchportalen tester credentials via
   client.resolveTripletexAuth({ providerId, env })
4. Hvis OK: vault.secrets.create + insert provider_tripletex_credentials
5. Auto-sync Products + VatType → provider_tripletex_products
6. Audit
```

### Sekvens B2: Company → Provider's Tripletex Customer

```
1. Når agreement opprettes: trigger tripletex_customer_create-job
2. TPT-B-job: ensureCustomer({ providerId, env }) på provider's Tripletex
3. Lagre i tripletex_customers (provider_id=<agreement.provider_id>,
   tripletex_provider_id=<provider_id>, external_customer_id=<resultat>)
```

### Sekvens B3: Måltids-faktura → Provider's Tripletex Invoice

```
1. Cron (hver dag 02:00): for hver ACTIVE agreement:
   - billing_cycle='biweekly': hvis last_invoiced_at + 14d <= now() → generer
   - billing_cycle='monthly': hvis forrige måned ferdig → generer
2. lp_agreement_generate_invoice(agreement_id, period_start, period_end):
   - Aggreger orders per tier × pris (BASIS 90, LUXUS 130, ENTERPRISE 170)
   - Insert agreement_invoices status=DRAFT
3. TPT-B-job: konverter til Tripletex Invoice via tripletexEngine med
   providerId-context
4. status=SENT, Tripletex sender til company.billing_email
```

### Sekvens B4: Paid-status sync (Flow B)

```
Webhook: POST /api/webhooks/tripletex-provider/[provider_id]
  → verify HMAC (vault.secrets[webhook_secret_id])
  → update agreement_invoices.status

Polling fallback: hourly cron poller per provider's Tripletex
```

---

## 5. Patch-breakdown

### TPT-0: Schema-drift fix (PRE-REQUISITE)

**Mål:** Få staging på samme schema som repo.

**Tasks:**
- Apply `invoice_periods`-migrasjon til staging (hvis i repo)
- Apply `tripletex_exports`-migrasjon til staging
- Verifiser at `app/api/cron/credit-check` + `app/api/cron/invoices/generate` ikke feiler

**Hvis migrasjonene IKKE finnes i repo:** klargjør om de skal opprettes eller om kode skal endres.

**Estimat: 30-60 min**

---

### FLOW A (TPT-A-1 → TPT-A-6) — Lunchportalen → Provider

**TPT-A-1: Audit & augment existing client**

- Slett legacy `lib/tripletex/client.ts` (orphan, 0 imports)
- Utvid `lib/integrations/tripletex/client.ts`: `resolveTripletexAuth()` tar `{ providerId?, env? }`
- Hvis `providerId` set: hent fra `provider_tripletex_credentials` + Vault
- Hvis `providerId` null: bruk Lp's env-vars (eksisterende oppførsel)
- Token-cache per `(providerId|'lp', env)`
- **Estimat: 60-90 min**

**TPT-A-2: Provider-onboarding RPC + Customer sync**

- Klargjør semantikk: lag `lp_provider_create`-RPC hvis ikke finnes
- Trigger eller outbox-event: enqueue Tripletex Customer-sync
- Cron-route eller utvidelse av eksisterende
- Lagre i `tripletex_customers` (provider_id, target='lp')
- **Estimat: 60-90 min**

**TPT-A-3: SaaS Invoice generation**

- Modifisér `lp_provider_generate_invoice_for_period` til å enqueue invoice_send
- TPT-A-cron: konverter `provider_invoices.DRAFT` → Tripletex Invoice via `tripletexEngine`
- **Estimat: 60-90 min**

**TPT-A-4: Cron-registrering**

- Legg til i `vercel.json`:
  - `/api/cron/tripletex-saas-monthly` — 1. hver måned 03:00
  - `/api/cron/tripletex-status-poll-lp` — hver time
- Bruk `requireCronAuth()` mønster
- **Estimat: 30-45 min**

**TPT-A-5: Webhook handler (Lp)**

- Ny route: `app/api/webhooks/tripletex/route.ts`
- HMAC-pattern fra Sanity-webhook
- Webhook-secret: `TRIPLETEX_WEBHOOK_SECRET`
- **Estimat: 45-60 min**

**TPT-A-6: Admin UI (Lp)**

- `/superadmin/tripletex` (dashboard + queue)
- `/superadmin/tripletex/jobs` (queue inspector)
- `/superadmin/providers/[id]/tripletex` (per-provider sync-status)
- **Estimat: 60-90 min**

**Flow A total: ~4.5-7 timer**

---

### FLOW B (TPT-B-1 → TPT-B-6) — Provider → Company

**TPT-B-1: Provider credentials vault**

- Ny tabell `provider_tripletex_credentials`
- Etablere Vault read/write-pattern (grønnflate)
- RPC: `lp_provider_save_tripletex_credentials`, `lp_provider_test_tripletex_connection`
- UI: `/leverandor/tripletex`
- Klartekst tokens **aldri** logget, **aldri** returnert til client
- **Estimat: 90-120 min**

**TPT-B-2: Per-provider Product/VatType sync**

- Ny tabell `provider_tripletex_products`
- Auto-sync ved credentials-add (eller eksplisitt re-sync)
- Bruker eksisterende `client.ensureProduct({ providerId, env })`
- **Estimat: 45-60 min**

**TPT-B-3: Company → Provider's Tripletex Customer sync**

- Trigger på agreement-creation
- Bruker eksisterende `client.ensureCustomer({ providerId, env })`
- Utvide `tripletex_customers` med `tripletex_provider_id`
- **Estimat: 60-90 min**

**TPT-B-4: agreement_invoices + billing_cycle utvidelse**

- Migration: ny `agreement_invoices`-tabell
- Migration: utvide `agreements.billing_cycle` CHECK med `'biweekly'`
- Legg til `billing_anchor_date`, `last_invoiced_at`
- RPC: `lp_agreement_set_billing_cycle`
- UI: `/leverandor/kunder/[id]` viser cycle-velger
- **Estimat: 60-90 min**

**TPT-B-5: Invoice generering + cron + send**

- RPC: `lp_agreement_generate_invoice_for_period`
- Aggreger orders per tier
- Cron: `/api/cron/tripletex-agreements-daily`
- Send via eksisterende `tripletexEngine` med providerId-context
- **Estimat: 90-120 min**

**TPT-B-6: Webhook + admin UI (per provider)**

- `app/api/webhooks/tripletex-provider/[provider_id]/route.ts`
- HMAC-secret fra Vault per provider
- `/leverandor/faktura` utvidet med agreement-invoices-tab
- **Estimat: 60-90 min**

**Flow B total: ~6.5-9.5 timer**

---

### TOTAL ESTIMAT: ~11-17 timer

Redusert fra v2's 15-22 timer fordi mye er bygget. TPT-0 + Flow A er kortere; Flow B forblir grønnflate.

---

## 6. Risk register

| Risk | Sannsynlighet | Impact | Mitigering |
|---|---|---|---|
| **R1: Staging schema-drift** (invoice_periods/tripletex_exports mangler) | Bekreftet | Høy | TPT-0 fixer FØR TPT-A-1 |
| **R2: Eksisterende client brutt** ved multi-tenant-utvidelse | Medium | Høy | Default-arg bevarer eksisterende oppførsel; eksisterende tester må PASS |
| **R3: Provider-onboarding-semantikk uklar** (Q6) | Bekreftet | Medium | Avklar FØR TPT-A-2 |
| Provider's credentials leaker | Lav | Kritisk | Vault encrypted, audit-log på read |
| Duplicate invoices | Medium | Høy | UNIQUE constraints, idempotency |
| Tripletex API down | Lav | Medium | Retry-queue, fail-closed-mønster |
| Session token expires | Medium | Lav | `resolveTripletexAuth` håndterer |
| Webhook spoofing | Lav | Kritisk | HMAC per Tripletex-konto, Vault-secret |
| Customer-mapping out-of-sync | Medium | Medium | Daily drift-check job |
| Provider sletter credentials | Lav | Medium | Soft-disable, sync_status=DISABLED |
| Stuck jobs | Medium | Lav | Max 5 retries → DEAD-state |
| Frekvens-endring mid-periode | Medium | Lav | Snapshot på agreement_invoice |
| MVA-regler endrer seg | Lav | Lav | VatType lest fra Tripletex |
| **R8: Ingen eksisterende Vault read/write app-pattern** | Bekreftet | Medium | TPT-B-1 bygger grønnflate |

---

## 7. Discovery-checklist

- [x] `lib/tripletex/*` audited — orphan, slettes
- [x] `lib/integrations/tripletex/*` audited — kanonisk, utvides
- [x] Eksisterende DB-felter mappet
- [x] Cron-infrastruktur kartlagt
- [x] Vault-status bekreftet
- [x] Webhook-pattern dokumentert
- [ ] **Q7: invoice_periods + tripletex_exports migrasjoner — finnes i repo?**
- [ ] **Q6: Provider-opprettelse i dag — manuell SQL eller egen RPC?**
- [ ] **Vault read/write-pattern — eksempel-implementasjon?**
- [ ] **`tripletexEngine.createInvoice` — input-format? (review signature)**

---

## 8. Success criteria

### Flow A
- Ny provider → Lp's Tripletex Customer opprettes automatisk
- Månedlig: SaaS-faktura sendes
- Provider betaler → status synkes innen 1 time

### Flow B
- Provider setter Tripletex-credentials i `/leverandor/tripletex`
- Provider velger billing_cycle per agreement
- Company → Customer i provider's Tripletex (auto)
- Hver 14d eller månedlig: faktura genereres + sendes
- Company betaler → status synkes tilbake

### End-to-end
- Provider onboarder seg → får SaaS-faktura månedlig
- Provider får kunde → setter agreement med biweekly/monthly
- Company mottar måltids-fakturaer via provider's Tripletex
- Lunchportalen aldri direkte i Provider→Company-relasjonen

---

## 9. Rollback-strategi

| Patch | Rollback |
|---|---|
| TPT-0 | Migrasjons-revert (forsiktig — kode forventer disse tabellene) |
| TPT-A-1 | Revert client-endringer; default-args bevarer kompatibilitet |
| TPT-A-2 | Drop onboarding-trigger; Customer-rader forblir |
| TPT-A-3 | Status tilbake til DRAFT |
| TPT-A-4 | Disable cron i `vercel.json` |
| TPT-A-5 | Disable webhook-route |
| TPT-A-6 | UI revert |
| TPT-B-1 | Drop `provider_tripletex_credentials`, slett Vault-secrets |
| TPT-B-2 | Drop `provider_tripletex_products` |
| TPT-B-3 | Drop `tripletex_provider_id`-kolonne |
| TPT-B-4 | Drop `agreement_invoices`, revert `billing_cycle` CHECK |
| TPT-B-5 | Drop RPC, disable cron |
| TPT-B-6 | UI revert + disable webhook |

---

## 10. Åpne spørsmål

**Krever brukerens beslutning før TPT-A-1:**

1. **Q1 — Customer-mapping for Flow A:** Skal Lp's Provider→Customer-mapping ligge i ny `providers.tripletex_customer_id`-kolonne, ELLER i eksisterende `tripletex_customers`-tabell med `tripletex_provider_id=NULL`-markering?
   - **Anbefaling:** Bruk `tripletex_customers`-tabellen (gjenbruk eksisterende infrastruktur).

2. **Q2 — Encrypted credentials:** Supabase Vault confirmed ✅. Plan-default bekreftet.

3. **Q3 — Billing-cycle default:** Eksisterende `billing_cycle CHECK = 'monthly'`. Utvide med `'biweekly'`. Default for nye agreements: `monthly`.

4. **Q4 — Hvis Provider ikke har Tripletex:** Eksisterende fail-closed-mønster brukes. Anbefaling bekreftet.

5. **Q5 — Sletting av agreement_invoices:** Norge krever 5 års oppbevaring. Anbefaling: ingen auto-sletting, soft-archive senere.

6. **Q6 (NY) — Provider-opprettelse semantikk:** Hvor opprettes providers i dag? Manuelt via SQL, superadmin UI, eller egen RPC? Hvilken trigger skal hooke til Tripletex Customer creation?

7. **Q7 (NY) — Migrasjons-status:** Finnes `invoice_periods` + `tripletex_exports`-migrasjoner i repo, eller må de opprettes for staging?

8. **Q8 (NY) — Multi-tenant client-pattern:** Bekreft at vi kan utvide `lib/integrations/tripletex/client.ts` med `{ providerId?, env? }`-args uten å bryte eksisterende kall.

---

## 11. Tekniske referanser

- **Tripletex API base URL (prod):** `https://tripletex.no/v2/`
- **Tripletex API base URL (test):** `https://api-test.tripletex.tech/v2/`
- **Auth-flyt:** `PUT /token/session/:create?consumerToken=X&employeeToken=Y&expirationDate=Z`
- **Authorization header:** `Basic <base64(companyId:sessionToken)>`, companyId = 0 for primary
- **Session-token utløp:** Maks 7 dager
- **Dokumentasjon:** [developer.tripletex.no/docs](https://developer.tripletex.no/docs)

### Eksisterende kode-referanser

```typescript
// lib/integrations/tripletex/client.ts (eksisterende)
export async function resolveTripletexAuth(): Promise<TripletexAuth>
export async function ensureCustomer(args: EnsureCustomerArgs): Promise<TripletexCustomer>
export async function ensureProduct(args: EnsureProductArgs): Promise<TripletexProduct>
export async function createInvoice(args: CreateInvoiceArgs): Promise<TripletexInvoice>

// Utvidelse i TPT-A-1 (foreslått):
export async function resolveTripletexAuth(opts?: {
  providerId?: string | null;
  env?: 'test' | 'prod';
}): Promise<TripletexAuth>
```

---

**Next:** Besvar Q6-Q8 (krever discovery av migrasjons-status + provider-opprettelse), deretter TPT-0 (schema-drift fix), deretter TPT-A-1.
