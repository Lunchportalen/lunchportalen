# TRIPLETEX-PLAN-V1 — Master-plan for Tripletex-integrasjon

**Versjon:** v3.2 (2026-05-20 — TPT-A-1/A-2/A-3 status + renummerering)
**Status:** Aktiv (post-Phase E + MP1-5)
**Eier:** Lunchportalen-arkitektur
**Referanser:** PROVIDER-PLAN-V1 (`08b3cf49`), Patch 15 (`5cca370c`), MP5 (`75a55235`), Pre-discovery 2026-05-20, Q6/Q7/Q8-discovery 2026-05-20

---

## ⚠️ Endringslogg v3.1 → v3.2

**Status-oppdatering og renummerering (etter TPT-A-2 split):**

1. **TPT-A-1, A-2, A-3** markert ✅ COMPLETED med commit-SHA-er og audit-docs.
2. **TPT-A-2 split dokumentert:** opprinnelig «Provider-onboarding RPC + Customer sync» → **TPT-A-2** (RPC + outbox) + **TPT-A-3** (worker).
3. **Påfølgende Flow A-patches renummerert:**
   - **TPT-A-4** (var A-3): SaaS Invoice generation
   - **TPT-A-5** (var A-4): Cron-registrering
   - **TPT-A-6** (var A-5): Webhook handler (Lp)
   - **TPT-A-7** (var A-6): Admin UI (Lp)
4. **R10 NY:** TPT-A-2 + A-3 ikke verifisert end-to-end mot staging (integrasjonstester + Tripletex smoke).
5. **Integrasjonstester (2026-05-20):** `SUPABASE_POSTGRES_URL` → staging ✅; `NEXT_PUBLIC_SUPABASE_URL` → prod ❌ → tester **skipped** (se §0 env).

---

## ⚠️ Endringslogg v3 → v3.1

**TPT-0 scope avklart (Q7 + R9):**

1. **Kirurgisk TPT-0** — ikke hele `202602*`-kjeden (staging er `baseline_schema_dump` + `20260520*`-patches).
2. **Apply:** `20260221_step6_10_fasit_periods_esg.sql` (dekker `invoice_periods` + `tripletex_exports`; skip `20260219` som overflødig).
3. **R9:** `external_customer_id` finnes ikke i repo-migrasjoner — kom fra prod baseline-dump; **separat repair-migrasjon** i TPT-0 (ikke `20260218` wholesale).
4. **Q6/Q7/Q8 løst** — se §10; TPT-A-2 omdøpt til `lp_provider_create` + outbox.

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
tripletex_customers (company_id, tripletex_customer_id, provider_id, …)
tripletex_invoices
```

### Manglende på staging og prod (R1 — BLOCKER)

```
invoice_periods       -- kode forventer, finnes ikke (bekreftet begge miljøer)
tripletex_exports     -- kode forventer, finnes ikke (bekreftet begge miljøer)
```

### Schema-drift (R9 — BLOCKER for Tripletex-kjøring)

```
tripletex_customers   -- live DB: external_customer_id (baseline-dump)
                      -- kode + 20260218-migrasjon: tripletex_customer_id
                      -- Ingen repo-migrasjon renamer til external_customer_id
```

Staging ble rerollet med `baseline_schema_dump_from_prod_2026_05_20_v1_REROLLED` (ikke `202602*`-sporet). `0` rader i `schema_migrations` med `version LIKE '202602%'`.

### Eksisterende env (dokumentert i `docs/environments-runtime.json`)

`TRIPLETEX_ENABLED`, `TRIPLETEX_BASE_URL`, `TRIPLETEX_COMPANY_ID`, `TRIPLETEX_CONSUMER_TOKEN`, `TRIPLETEX_EMPLOYEE_TOKEN`, `TRIPLETEX_SESSION_TOKEN`, `TRIPLETEX_TOKEN`, `TRIPLETEX_TIMEOUT_MS`, `TRIPLETEX_MAX_RETRIES`, `TRIPLETEX_OUTBOX_CONCURRENCY`, `TRIPLETEX_REVENUE_DEFAULT_{CUSTOMER,PRODUCT,VAT_CODE}_ID`, `TRIPLETEX_CREDIT_CHECK_ENABLED`, `TRIPLETEX_ENABLE_CREDIT_NOTE_FLOW`, `BIWEEKLY_TRIPLETEX_DIRECT_INVOICE_ENABLED`.

Ingen TEST/PROD-suffix i kode — isolasjon via Vercel Preview/Production env-grupper.

### Lokal staging-integrasjon (`.env.local`)

For `RUN_SUPABASE_INTEGRATION_TESTS=1` (f.eks. `tests/db/lp_provider_create.test.ts`) kreves **alle** av:

| Env | Må peke på staging-ref `uigxsboqeruxflgzqztl` |
|-----|-----------------------------------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Ja (PostgREST + Auth Admin API) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Staging branch anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Staging branch service role |
| `SUPABASE_POSTGRES_URL` | Ja (fixture DML via `pg`) |

Mapping og nøkkel-henting: `docs/audit/staging-env-mapping-2026-05-20.md` (gitignored `scripts/audit/staging-env-actual-2026-05-20.env`).

**Status 2026-05-20:** Kun `SUPABASE_POSTGRES_URL` er staging; REST-URL er fortsatt prod → integrasjonstester skipper (fail-closed).

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

### Sekvens A1: Provider-opprettelse → Lp's Tripletex Customer (BESLUTTET Q6)

```
1. Superadmin kaller lp_provider_create (TPT-A-2) — eneste runtime INSERT-path.
2. RPC: INSERT providers + lifecycle_audit_log.
3. RPC: enqueue outbox tripletex.provider_customer_create_lp (provider_id, target='lp').
4. Outbox/cron → **TPT-A-3** handler → Tripletex POST /customer (Lp-konto, resolveTripletexAuth uten providerId).
5. Mapping i tripletex_customers (`provider_id` set, `company_id` NULL — Flow A; se Q1).
6. Audit lifecycle_audit_log (entity_type='tripletex_sync').

Seed-only (ikke runtime): 20260520160001_seed_default_provider_melhus.sql (direkte INSERT).
Tester: tests/_helpers/providerTestFixtures.ts (direkte INSERT).
Superadmin UI oppretter ikke provider i dag — kun lisens/faktura (Patch 15).
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

**Mål:** Tabeller og kolonner som aktiv Tripletex-kode forventer — uten å kjøre hele `202602*`-kjeden.

**Beslutning (Q7):** Scenario B — migrasjoner finnes i repo, **ikke applied** på staging eller prod (`202602%` = 0 i `schema_migrations`). **Ikke** Variant 2 (full `202602*`-kjede): staging er baseline-rerollet; prod har eget `20260507+`-spor.

**Apply-liste (kirurgisk, begge miljøer — staging først):**

| # | Migrasjon / artefakt | Hvorfor |
|---|----------------------|---------|
| 1 | `supabase/migrations/20260221_step6_10_fasit_periods_esg.sql` | Oppretter/hardener `invoice_periods` + `tripletex_exports` (matcher outbox/cron) |
| 2 | **NY** `supabase/migrations/20260521_tpt0_tripletex_customers_repair.sql` | R9: `tripletex_customer_id` + backfill fra `external_customer_id` + manglende billing-kolonner |
| — | ~~`20260219_invoice_periods.sql`~~ | **Skip** — overflødig når (1) kjøres |
| — | ~~Hele `202602*.sql` (26 filer)~~ | **Avvist** — konfliktrisiko mot baseline + `20260520*` |

**R9 — ikke inkludert i eksisterende migrasjon:**
- `20260218_norwegian_standard_billing.sql:293` definerer `tripletex_customer_id` ved **CREATE**.
- `external_customer_id` finnes kun i baseline-dump (`scripts/audit/staging-schema-dump-2026-05-20.sql`) — **ingen** `git log -S external_customer_id` i `supabase/migrations/`.
- `CREATE TABLE IF NOT EXISTS` hopper over — **repair (2) er påkrevd**.

**Verifikasjon etter apply:**
```sql
SELECT to_regclass('public.invoice_periods'), to_regclass('public.tripletex_exports');
SELECT column_name FROM information_schema.columns
  WHERE table_name='tripletex_customers' AND column_name IN ('tripletex_customer_id','external_customer_id');
```

**Kjent gap (flagg for TPT-A-4):** `outbox/process` SELECTer `invoice_periods.tier`, men verken `20260221` eller cron `invoices/generate` persisterer `tier` → risiko `INVOICE_PERIOD_TIER_INVALID`.

**Estimat: 45-75 min** (inkl. ny repair-migrasjon + staging verify + prod apply)

**Status TPT-0:** ✅ Applied staging + prod (commits `c22fad30`, `add5cb64`; audit `docs/audit/tpt-0-schema-alignment.log`).

---

### FLOW A (TPT-A-1 → TPT-A-7) — Lunchportalen → Provider

#### TPT-A-1: Audit & augment existing client ✅ COMPLETED

- **Commits:** `22aebd53` (feat), `9bfde463` (audit)
- **Audit:** `docs/audit/tpt-a-1-client-augment.md`
- Slettet legacy `lib/tripletex/client.ts`; utvidet `resolveTripletexAuth(opts?)` + session-cache; stub `loadProviderCredentials` → TPT-B-1

#### TPT-A-2: `lp_provider_create` + outbox enqueue ✅ COMPLETED

- **Commits:** `c2186bfc` (feat), `ef01197f` (audit)
- **Audit:** `docs/audit/tpt-a-2-provider-create.md`
- RPC + `tripletex.provider_customer_create_lp:<provider_id>` outbox i samme TX
- Schema: `tripletex_customers.provider_id` + scope CHECK
- ⚠️ **R10:** Integrasjonstester ikke kjørt mot staging (env mismatch, se §0)

#### TPT-A-3: Provider-customer worker ✅ COMPLETED

- **Commits:** `d657ea83` (feat), `8acfe803` (audit)
- **Audit:** `docs/audit/tpt-a-3-provider-customer-worker.md`
- Handler: `handleProviderCustomerCreateLp` + `ensureProviderCustomer`; dispatch i `/api/system/outbox/process`
- Enhetstester: `tests/integrations/providerCustomerCreateLp.test.ts` (6/6 PASS, mocked)
- ⚠️ **R10:** Ikke smoke-testet mot Tripletex test-env — se `docs/audit/tpt-a-3-staging-smoke-checklist.md`

#### TPT-A-4 (renummerert): SaaS Invoice generation — Ikke startet

- Modifisér `lp_provider_generate_invoice_for_period` til å enqueue invoice_send
- Cron: konverter `provider_invoices.DRAFT` → Tripletex Invoice via `tripletexEngine`
- **Estimat: 60-90 min**

#### TPT-A-5 (renummerert): Cron-registrering — Ikke startet

- Legg til i `vercel.json`:
  - `/api/cron/tripletex-saas-monthly` — 1. hver måned 03:00
  - `/api/cron/tripletex-status-poll-lp` — hver time
  - Outbox-prosessor for `tripletex.provider_customer_create_lp` (etter A-3)
- Bruk `requireCronAuth()` mønster
- **Estimat: 30-45 min**

#### TPT-A-6 (renummerert): Webhook handler (Lp) — Ikke startet

- Ny route: `app/api/webhooks/tripletex/route.ts`
- HMAC-pattern fra Sanity-webhook
- Webhook-secret: `TRIPLETEX_WEBHOOK_SECRET`
- **Estimat: 45-60 min**

#### TPT-A-7 (renummerert): Admin UI (Lp) — Ikke startet

- `/superadmin/tripletex` (dashboard + queue)
- `/superadmin/tripletex/jobs` (queue inspector)
- `/superadmin/providers/[id]/tripletex` (per-provider sync-status)
- **Estimat: 60-90 min**

**Flow A total (gjenstående):** ~3.5-6 timer (A-4 → A-7)

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
| **R1: Schema-drift** (`invoice_periods`/`tripletex_exports` mangler staging+prod) | Bekreftet | Høy | TPT-0 kirurgisk apply FØR TPT-A-1 |
| **R9: `tripletex_customers` kolonneavvik** (`external_customer_id` vs `tripletex_customer_id`) | Bekreftet staging+prod | Høy | TPT-0 repair-migrasjon (2); ikke wholesale `20260218` |
| **R2: Eksisterende client brutt** ved multi-tenant-utvidelse | Medium | Høy | Default-arg bevarer eksisterende oppførsel; eksisterende tester må PASS |
| **R3: Provider-onboarding-semantikk uklar** (Q6) | **Løst** | — | `lp_provider_create` + outbox (TPT-A-2) |
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
| **R10: TPT-A-2 + A-3 ikke verifisert end-to-end mot staging** | Medium | Medium | Sett alle staging Supabase-env i `.env.local`; kjør `tests/db/lp_provider_create.test.ts`; manuell smoke (`tpt-a-3-staging-smoke-checklist.md`) |

---

## 7. Discovery-checklist

- [x] `lib/tripletex/*` audited — orphan, slettes
- [x] `lib/integrations/tripletex/*` audited — kanonisk, utvides
- [x] Eksisterende DB-felter mappet
- [x] Cron-infrastruktur kartlagt
- [x] Vault-status bekreftet
- [x] Webhook-pattern dokumentert
- [x] **Q7:** Løst — repo ja; staging+prod nei; TPT-0 kirurgisk apply
- [x] **Q6:** Løst — `lp_provider_create` + outbox (TPT-A-2)
- [x] **Q8:** Løst — optional `{ providerId?, env? }` bakoverkompatibel
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
| TPT-A-2 | Drop `lp_provider_create`; slett test-providers + outbox-events |
| TPT-A-3 | Revert worker; provider-mapping-rader kan stå |
| TPT-A-4 | Status provider_invoices tilbake til DRAFT |
| TPT-A-5 | Disable cron i `vercel.json` |
| TPT-A-6 | Disable webhook-route |
| TPT-A-7 | UI revert |
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

6. **Q6 — LØST:** Ingen `lp_provider_create` i dag. Runtime: **TPT-A-2** RPC + outbox. Seed: Melhus-migrasjon; tester: fixture INSERT. Hook: outbox etter RPC (ikke company-registration-RPC).

7. **Q7 — LØST:** Scenario B. Repo: `20260219` + `20260221` (bruk **kun** `20260221`). Staging+prod: tabeller mangler; `202602%` ikke i `schema_migrations`. TPT-0 kirurgisk — **ikke** full `202602*`-kjede.

8. **Q8 — LØST:** Ja — utvid `resolveTripletexAuth(opts?)` + `RequestOptions.auth`; eksisterende call-sites uendret. Session-cache per `(providerId|'lp', env)` er additive (~30–45 min i TPT-A-1).

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

**Next:** Lukk **R10** (staging env komplett + integrasjonstester + manuell A-3 smoke) → **TPT-A-4** (SaaS Invoice generation).
