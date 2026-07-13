# GLOBAL LAUNCH RUNBOOK — app.lunchportalen.no

Gjelder release av P0-pakken (auth hook-guard, SEC-001/SEC-004/CRON-001, billingblokk,
locale-kjede, kill switches). Umbraco og `lunchportalen.no` er ikke endret eller testet i
dette implementeringsoppdraget og inngår ikke i denne runbooken.

**Ingen kommandoer i dette dokumentet inneholder ekte secrets.** Alle secrets refereres ved navn.

---

## 1. Før deploy (pre-flight)

| # | Sjekk | Hvordan | Eier |
|---|-------|---------|------|
| 1 | Backup | Supabase PITR aktiv + manuelt snapshot av prod-DB før migrering | DB-eier |
| 2 | Release-SHA | Noter eksakt commit-SHA som releases; tag `global-launch-p0` | Release-eier |
| 3 | Godkjente tester | typecheck ✅ lint ✅ unit/integration ✅ (5318+) DB/RLS ✅ E2E kritiske flyter ✅ — se GLOBAL-LAUNCH-IMPLEMENTATION.md | Release-eier |
| 4 | Migrasjonsdry-run | `node scripts/ci/billing-prod-sim-verify.mjs` (lokal, simulerer eksakt prod-state) → VERIFY PASS | DB-eier |
| 5 | Secrets-validasjon | Verifiser i Vercel prod env (uten å printe verdier): `CRON_SECRET`, `SYSTEM_MOTOR_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_BILLING_PAYMENTS_WEBHOOK_SECRET`, `STRIPE_PROVIDER_SETUP_WEBHOOK_SECRET`, `SANITY_WEBHOOK_SECRET`, `RESEND/SMTP` | Ops |
| 6 | **CRON_SECRET (KRITISK)** | CRON-001-fixen er fail-closed: uten `CRON_SECRET` i prod stopper ALLE cron-jobber (tilsiktet). Sett secret FØR deploy. Vercel sender automatisk `Authorization: Bearer <CRON_SECRET>` på schedules | Ops |
| 7 | Auth hook | Bekreft at `custom_access_token_hook` er aktivert i Supabase Dashboard (Auth → Hooks) ETTER migrering (steg 4 under) | DB-eier |
| 8 | Stripe endpoints | Stripe Dashboard: webhook-endpoints for `/api/webhooks/stripe-billing-payments` og `/api/webhooks/stripe-provider-setup` registrert med riktige signing secrets (gjøres i aktiveringsfasen, ikke før deploy) | Billing-eier |
| 9 | Markedskonfigurasjon | Kun NO skal være `markets.is_active = true` ved launch (verifiser med SQL under) | Release-eier |
| 10 | E-post | Send testinvitasjon i staging; verifiser SMTP/Resend-nøkler | Ops |
| 11 | Observability | Vercel logs + Sentry + `/superadmin/system` (health NORMAL, env OK) | Ops |
| 12 | Rollback-eier | Navngi én person med Vercel + Supabase + Stripe-tilgang under release-vinduet | Release-eier |

---

## 2. Deployrekkefølge

### Steg 0 — Preflight (READ-ONLY, obligatorisk)

```text
DATABASE_URL=<prod read-only-tilkobling> node scripts/ci/production-migration-preflight.mjs --report docs/PRODUCTION-PREFLIGHT-REPORT.md
```

Skriptet er ikke-muterende (tvinger `default_transaction_read_only = on`) og verifiserer:
eksakt pending-migrasjonsliste i apply-rekkefølge, out-of-order-deteksjon (→ `--include-all`-krav),
ingen history-drift, billingblokk fraværende-eller-komplett (aldri delvis), billing-RPC-inventar,
auth hook til stede, RLS på kjernetabeller, `lp_order_set` SECURITY DEFINER. `--report` skriver
full markdown-rapport over alle 65 migrasjoner + 13 billingtabeller/RPC-er.
**Kjør til PREFLIGHT PASS før steg 1.** (Verifisert 2026-07-11 mot eksakt prod-lik lokal state:
16 pending korrekt identifisert, out-of-order flagget — se `docs/PRODUCTION-PREFLIGHT-REPORT.md`.)

### Steg 1 — Database

```text
supabase db push --include-all
```

**`--include-all` er OBLIGATORISK:** prod har allerede `20260810120000`; billingblokken
(20260729–20260809) sorterer før den og avvises ellers med `LegacyMigrationMissingRemoteError`
(verifisert i lokal prod-simulering). Pakken som appliseres (16 migrasjoner):

- `20260729120000` … `20260809120000` (billingblokk — 13 tabeller, RLS, RPC-er)
- `20260811120000` (auth hook archived-org guard)
- `20260812120000` (companies.preferred_locale)
- `20260813120000` (markets: MVA, cutoff, fakturaspråk, stripe_status, is_active=true for 21 markeder)
- `20260814120000` (marked-/lokasjonstidssone-cutoff i lp_order_set + trigger — NO-semantikk uendret)

**Operativ sideeffekt (Protected Golden Path Impact):** `20260730120000` erstatter
`lp_order_advance_status` og legger snapshot-trigger på `order_items`; `20260814120000`
erstatter cutoff-beregningen i `lp_order_set`/`tg_orders_cutoff_0800` (Oslo/08:00 forblir
default og eksakt NO-atferd). Regresjonstester: `npm run test:golden-path` (103/103) +
`tests/db/marketCutoffContext.test.ts` grønne lokalt.

### Steg 2–3 — Post-migration verify (RLS, policies, grants, search_path)

```text
DATABASE_URL=<prod read-only-tilkobling> node scripts/ci/post-migration-verify.mjs
```

Ikke-muterende. Verifiserer: alle 65 migrasjoner applied (ingen pending/drift) · 13 billingtabeller
med RLS ENABLED + ≥1 policy hver · 13 billing-RPC-er SECURITY DEFINER m/pinned `search_path` ·
null anon-grants på billingtabeller · auth hook m/arkivert-org-guard wiret · tidssone-cutoff wiret
i `lp_order_set` + trigger · 21/21 markeder aktive m/komplett konfig · SECDEF-hygiene-rapport.
**Krav: POST-MIGRATION VERIFY PASS før steg 4.**
(Verifisert 2026-07-11 mot simulert post-push state: PASS på alle sjekker.)

### Steg 4 — Verifiser auth (eksakte operatørsteg)

**Auth hook-aktivering (Supabase Dashboard):**
1. Åpne Supabase Dashboard → prosjekt (prod) → **Authentication → Hooks**.
2. Under «Customize Access Token (JWT) Claims hook»: velg **Postgres function**,
   schema `public`, funksjon `custom_access_token_hook` → **Enable hook** → Save.
3. Verifikasjon (uten secrets): logg inn med testbruker i prod, kopier access token fra
   nettverkskallet, dekod payload (`jwt.io` eller `node -e` base64-dekoding) og bekreft
   claims: `active_org_id`, `active_role`, `is_platform_admin`, `memberships`.
4. Negativ verifikasjon: bruker i arkivert firma (CLOSED/TERMINATED) skal IKKE få
   `active_org_id`/`active_role` (guard fra `20260811120000`).
5. Rollback: samme Dashboard-side → Disable hook (claims forsvinner ved neste token-refresh;
   RLS er ikke wired til claims — ingen tilgangsbrudd).

**CRON_SECRET (Vercel — MÅ gjøres FØR steg 5):**
1. Vercel Dashboard → prosjekt → **Settings → Environment Variables** → Production.
2. Opprett/verifiser `CRON_SECRET` (min. 32 tegn tilfeldig; generer med
   `openssl rand -base64 32` — lim aldri verdien i chat/logg).
3. Vercel sender automatisk `Authorization: Bearer <CRON_SECRET>` på alle cron-invocations
   når variabelen finnes. Uten den svarer alle cron-ruter 500 `CRON_SECRET_MISSING`
   (tilsiktet fail-closed) og `/api/health` viser DEGRADED.
4. Verifikasjon etter deploy: `GET /api/health` → status NORMAL; ett cron-endepunkt manuelt
   med korrekt Bearer → 200, uten header → 403.

### Steg 5 — Deploy app

Vercel-deploy av release-SHA til production.

### Steg 6 — Smoke test (skriptet + manuelt)

**Skriptet (ikke-muterende):**

```text
LP_SMOKE_BASE_URL=https://app.lunchportalen.no \
LP_SMOKE_CRON_SECRET=<CRON_SECRET> \
LP_SMOKE_SUPABASE_URL=<prod supabase url> \
LP_SMOKE_SUPABASE_ANON_KEY=<anon key> \
LP_SMOKE_EMAIL=<smoke-testbruker> LP_SMOKE_PASSWORD=<...> \
node scripts/smoke/global-launch-smoke.mjs --all
```

Verifiserer: begge Stripe-webhookene passerer middleware uten sesjon og avviser usignert/forfalsket
body med 400 `INVALID_SIGNATURE` (aldri 401, aldri 2xx) · cron feiler lukket uten Bearer og med kun
`x-vercel-cron` (403), og svarer 200 med korrekt Bearer + `dryRun=1` (ingen writes) · auth hook-claims
(`is_platform_admin`, `memberships`, `active_org_id`/`active_role`) dekodes fra ekte login og
valideres, inkl. fail-closed uten medlemskap. Skriptet printer aldri secrets/tokens.
Kjøres separert: `--webhooks`, `--cron`, `--auth`. **Krav: SMOKE PASS.**

Staging-kjøring 2026-07-11: cron-gate PASS (alle 3); webhooks flagget `WEBHOOK_SECRET_MISSING`
(signing secrets settes i steg 7 — forventet før aktivering); auth-claims flagget «hook ikke aktivert»
(aktiveres i steg 4 — forventet). Skriptet detekterer altså begge operatørhullene korrekt.

**Manuelt:**
- `GET /api/health` → 200, status NORMAL
- Login → `/week` (employee), `/leverandor` (provider), `/superadmin` (superadmin)
- Én testbestilling + avbestilling før cutoff
- `/superadmin/system`: «Env / runtime config OK», ingen degraderingsårsaker

### Steg 7 — Aktiver webhooks (eksakte operatørsteg)

**Stripe (Dashboard → Developers → Webhooks):**
1. Endpoint 1: `https://app.lunchportalen.no/api/webhooks/stripe-billing-payments`
   — events: `payment_intent.succeeded`, `payment_intent.payment_failed`,
   `payment_intent.processing`, `payment_intent.requires_action`, `charge.succeeded`, `charge.failed`.
2. Endpoint 2: `https://app.lunchportalen.no/api/webhooks/stripe-provider-setup`
   — events: `checkout.session.completed`, `setup_intent.succeeded`,
   `payment_method.attached`, `customer.updated`.
3. Kopier hver endpoints **signing secret** til Vercel Production env:
   `STRIPE_BILLING_PAYMENTS_WEBHOOK_SECRET` og `STRIPE_PROVIDER_SETUP_WEBHOOK_SECRET`
   (redeploy kreves for at env skal tre i kraft).
4. Verifikasjon: «Send test webhook» i Stripe → forvent 200 og ny rad i
   `stripe_billing_webhook_events`; send samme event igjen → svar med `duplicate: true`.
5. Feil signatur-test: kall endpointet uten `stripe-signature` → 400 `INVALID_SIGNATURE`.
6. Pause-mekanisme: kill switch `stripe_webhooks` (503 + Retry-After — Stripe redeliverer i inntil 3 døgn).

**Sanity:** verifiser menu-day webhook (publisér testdag i staging-dataset først); pause via kill switch `sanity_webhook`.

### Steg 8 — Aktiver Stripe

Setup intent-flyt for pilot-provider; verifiser `payment_methods`-rad.

### Steg 9 — Aktiver billing

Kill switch `billing` = false (default åpen). Kjør `lp_billing_invoice_close_dry_run` for pilotperiode; verifiser tall før skarp kjøring.

### Steg 10 — Aktiver cron

Verifiser Vercel cron schedules treffer med 200 (Authorization-header). Sjekk `cron_runs`/logger for første kjøring av outbox + invoices/generate (dryRun=1 først).

### Steg 11 — Verifiser markeder

Alle 21 markeder aktiveres av migrasjonen `20260813120000` (GLOBAL RELEASE GATE):

```sql
SELECT count(*) FROM public.markets WHERE is_active = true;                    -- forventet: 21
SELECT country_code, vat_rate_food, cutoff_local_time, invoice_language, stripe_status
FROM public.markets ORDER BY country_code, locale;                            -- komplett konfig per rad
```

Kommersiell aktivering per marked styres videre av provider-/company-onboarding + Stripe-status;
nødstopp per funksjon via kill switches. MVA-satsene er seed-defaults som krever
kommersiell/juridisk godkjenning før første faktura i nytt marked.

### Steg 12 — Overvåk

Første 48 timer: Vercel-logger på `[cron.*]`, `killswitch`, webhook-feil (`INVALID_SIGNATURE`, `WEBHOOK_IDEMPOTENCY_WRITE_FAILED`), Sentry, `/superadmin/system`.

---

## 3. Rollback

| Område | Handling | Detalj |
|--------|----------|--------|
| App | Vercel instant rollback | Forrige deployment; ingen DB-avhengighet (migrasjonene er additive) |
| Feature/marked | Kill switches (superadmin, `system_settings.killswitch`) | `orders`, `cancellations`, `emails`, `stripe_webhooks`, `stripe_setup`, `stripe_charges`, `billing`, `commission_posting`, `invoice_generation`, `cron`, `sanity_webhook`, `production_generation`, `global`. Server-side håndhevet; webhooks/cron svarer 503 + Retry-After (Stripe/Sanity redeliverer) |
| Stripe pause | Kill switch `stripe_webhooks` (myk) eller deaktiver endpoint i Stripe Dashboard (hard) | Events redeliveres i inntil 3 dager |
| Cron pause | Kill switch `cron` (myk) eller pause schedules i Vercel (hard) | Idempotente jobber tåler gap |
| E-postpause | Kill switch `emails` | Eksisterende enforced path |
| Fakturapause | Kill switch `invoice_generation` | Generering er idempotent per (company, period) — trygg å gjenoppta |
| Auth hook | Deaktiver hook i Supabase Dashboard | Claims forsvinner ved neste token-refresh; RLS er ikke wired til claims (Fase 2 shadow) → ingen tilgangsbrudd |
| Database recovery | Supabase PITR til pre-release-tidspunkt | KUN ved korrupsjon; billingblokken sletter ingen data (verifisert: ingen DROP/DELETE/TRUNCATE av businessdata) |
| Kommunikasjon | Rollback-eier varsler i drift-kanal + statusside; providere varsles ved Stripe/billing-pause | Mal: hva, siden når, forventet løsning, neste oppdatering |

## 4. Kill switch-referanse

Endres kun av superadmin via system-workspacen (persistert i `public.system_settings.killswitch`).
Default: alle av (= alt åpent). Endringer logges (ops-logg `OPS_KILL_SWITCH_BLOCKED` ved blokkering).
Håndhevelse: server-side i route handlers (`lib/system/opsKillSwitch.ts`, `lib/system/enforcement.ts`) — ingen klientstyrt bypass.
