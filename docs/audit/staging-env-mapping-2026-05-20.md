# B3e — Staging env mapping (Vercel)

**Dato:** 2026-05-20  
**Kilde prod:** `vercel env ls production` (lunchportalen/lunchportalen)  

**B3a-REROLL 2026-05-20:** Staging branch rotated due to credential exposure in chat (security incident). New `project_ref`: **`uigxsboqeruxflgzqztl`**. Old branch `pbwivijolkoemcvgecoj` deleted with credentials invalidated.

**Staging Supabase:** `uigxsboqeruxflgzqztl` (B3a dump bypass, rerolled B3a-REROLL)  
**Staging Sanity:** prosjekt `4udoq5d8`, dataset `staging` (B3c)  
**Staging URL:** `https://staging.app.lunchportalen.no` (B3d DNS OK → Vercel)

**Sensitive verdier:** Se gitignored `scripts/audit/staging-env-actual-2026-05-20.env` (aldri commit). Regenerer med `node scripts/audit/b3e-generate-staging-env.mjs`.

---

## STEG 1 — Prod-inventar (30 vars)

| # | Var-navn | Vercel environments (prod-liste) |
|---|----------|----------------------------------|
| 1 | `SANITY_WRITE_TOKEN` | Production |
| 2 | `SANITY_WEBHOOK_SECRET` | Production |
| 3 | `NEXT_PUBLIC_SANITY_PROJECT_ID` | Production |
| 4 | `LP_RESEND_LIVE_SEND` | Preview, Production |
| 5 | `RESEND_API_KEY` | Production, Preview |
| 6 | `PUBLIC_APP_URL` | Production |
| 7 | `SANITY_LIVE_URL` | Production |
| 8 | `SUPABASE_DB_PASSWORD` | Production |
| 9 | `SMTP_PASS` | Production |
| 10 | `SMTP_USER` | Production |
| 11 | `SMTP_SECURE` | Production |
| 12 | `SMTP_PORT` | Production |
| 13 | `SMTP_HOST` | Production |
| 14 | `LP_RESEND_FROM` | Production |
| 15 | `NEXT_PUBLIC_APP_URL` | Production |
| 16 | `LP_SMTP_PASS` | Production |
| 17 | `LP_SMTP_USER` | Production |
| 18 | `LP_SMTP_SECURE` | Production |
| 19 | `LP_SMTP_PORT` | Production |
| 20 | `LP_SMTP_HOST` | Production |
| 21 | `UMBRACO_PUBLIC_SITE_URL` | Production |
| 22 | `UMBRACO_DELIVERY_BASE_URL` | Production |
| 23 | `UMBRACO_CMS_ORIGIN` | Production |
| 24 | `CRON_SECRET` | Development, Preview, Production |
| 25 | `SYSTEM_MOTOR_SECRET` | Development, Preview, Production |
| 26 | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production, Preview, Development |
| 27 | `SUPABASE_SERVICE_ROLE_KEY` | Production, Preview, Development |
| 28 | `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview, Development |
| 29 | `NEXT_PUBLIC_SANITY_DATASET` | Development, Preview, Production |
| 30 | `NEXT_PUBLIC_SANITY_API_VERSION` | Development, Preview, Production |

**Antall:** **30** (Vercel Production-liste; ikke alle runtime-nøkler i `docs/environments.json` er satt i Vercel).

`.env.vercel.pull.checkpoint` kunne ikke leses i agent-miljø (permission); CLI er autoritativ kilde.

---

## STEG 2 — Staging credentials (redacted)

| Ressurs | Status |
|---------|--------|
| PostgREST URL | `<present>` → `https://uigxsboqeruxflgzqztl.supabase.co` |
| Anon key (legacy JWT) | `<present, ~200 chars>` — staging branch MCP `get_publishable_keys` |
| Service role key | `<present, ~200 chars>` — `supabase branches get` (kun i extract-fil) |
| DB connection | `<present>` — `POSTGRES_URL` / `POSTGRES_URL_NON_POOLING` i extract (CLI) |
| Sanity project | `4udoq5d8` (SHARED) |
| Sanity dataset | `staging` |
| Sanity API version | `2024-01-01` (default i `lib/config/env.ts`, SHARED med prod-mønster) |

---

## STEG 3–4 — Mapping (ingen hemmeligheter i tabell)

| Var-navn | Klassifikasjon | Staging-verdi (referanse) | Note |
|----------|----------------|---------------------------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | STAGING_OVERRIDE_KNOWN | `https://uigxsboqeruxflgzqztl.supabase.co` | Branch B3a |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | STAGING_OVERRIDE_KNOWN | `<staging-branch-anon, redacted>` | Extract-fil / MCP |
| `SUPABASE_SERVICE_ROLE_KEY` | STAGING_OVERRIDE_KNOWN | `<staging-branch-service-role, redacted>` | Extract-fil / CLI branch get |
| `SUPABASE_DB_PASSWORD` | STAGING_SKIP | `<skip on Vercel>` | Valgfritt lokalt for `psql`; ikke nødvendig for Next runtime |
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | SHARED | `4udoq5d8` | Samme som prod |
| `NEXT_PUBLIC_SANITY_DATASET` | STAGING_OVERRIDE_KNOWN | `staging` | B3c |
| `NEXT_PUBLIC_SANITY_API_VERSION` | SHARED | `2024-01-01` | Samme som prod default |
| `SANITY_WRITE_TOKEN` | STAGING_OVERRIDE_USER | User-generated Sanity Editor token for project `4udoq5d8`, present in extract | Ikke prod-token |
| `SANITY_WEBHOOK_SECRET` | STAGING_OVERRIDE_USER | Generated 64-char hex, present in extract | Ny webhook mot staging deploy URL |
| `SANITY_LIVE_URL` | STAGING_OVERRIDE_KNOWN | `https://staging.app.lunchportalen.no` | Staging app origin |
| `NEXT_PUBLIC_APP_URL` | STAGING_OVERRIDE_KNOWN | `https://staging.app.lunchportalen.no` | |
| `PUBLIC_APP_URL` | STAGING_OVERRIDE_KNOWN | `https://staging.app.lunchportalen.no` | Cron/scheduler base |
| `CRON_SECRET` | STAGING_OVERRIDE_USER | `<generate-new-uuid>` | Extract-fil har forslag; **ikke** prod-verdi |
| `SYSTEM_MOTOR_SECRET` | STAGING_OVERRIDE_USER | `<generate-new-uuid>` | Extract-fil har forslag; **ikke** prod-verdi |
| `LP_RESEND_LIVE_SEND` | STAGING_OVERRIDE_KNOWN | `false` | Blokker live e-post fra staging |
| `RESEND_API_KEY` | STAGING_SKIP | `<skip>` | Ingen live Resend fra staging |
| `LP_RESEND_FROM` | STAGING_SKIP | `<skip>` | |
| `SMTP_HOST` | STAGING_SKIP | `<skip>` | |
| `SMTP_PORT` | STAGING_SKIP | `<skip>` | |
| `SMTP_SECURE` | STAGING_SKIP | `<skip>` | |
| `SMTP_USER` | STAGING_SKIP | `<skip>` | |
| `SMTP_PASS` | STAGING_SKIP | `<skip>` | |
| `LP_SMTP_HOST` | STAGING_SKIP | `<skip>` | |
| `LP_SMTP_PORT` | STAGING_SKIP | `<skip>` | |
| `LP_SMTP_SECURE` | STAGING_SKIP | `<skip>` | |
| `LP_SMTP_USER` | STAGING_SKIP | `<skip>` | |
| `LP_SMTP_PASS` | STAGING_SKIP | `<skip>` | |
| `UMBRACO_PUBLIC_SITE_URL` | STAGING_SKIP | `<skip>` | Legacy; ikke brukt i staging-mål |
| `UMBRACO_DELIVERY_BASE_URL` | STAGING_SKIP | `<skip>` | |
| `UMBRACO_CMS_ORIGIN` | STAGING_SKIP | `<skip>` | |

### Antall per klassifikasjon

| Klassifikasjon | Antall |
|----------------|--------|
| SHARED | 2 |
| STAGING_OVERRIDE_KNOWN | 8 |
| STAGING_OVERRIDE_USER | 4 |
| STAGING_SKIP | 16 |
| AMBIGUOUS | 0 |

### Valgfrie runtime-nøkler (ikke i Vercel prod-liste)

Hvis app/cron trenger dem på staging, vurder separat:

| Var | Anbefaling |
|-----|------------|
| `SUPABASE_URL` | Kommentert ut i extract; legg til staging KUN hvis B3f deploy feiler |
| `NEXT_PUBLIC_SITE_URL` | `https://staging.app.lunchportalen.no` |
| `SANITY_READ_TOKEN` | Kun hvis read-only cron mot staging dataset |

---

## STEG 5 — HARDGATE (bruker)

**Før Vercel-inntasting:** Bekreft mapping + åpne `scripts/audit/staging-env-actual-2026-05-20.env`, fyll inn Sanity-token/webhook, lim inn i **Vercel → Settings → Environments → staging**.

**Forventet antall vars på staging:** **14** (2 SHARED + 8 OVERRIDE_KNOWN + 4 OVERRIDE_USER; 16 SKIP).

---

## STEG 6 — Manuell Vercel (bruker)

1. Vercel → lunchportalen → Settings → Environments → **staging**
2. Legg til hver rad fra mapping (SKIP = ikke legg til)
3. Deploy staging branch etterpå (B3f)

---

## STEG 7 — Verifikasjon (etter bruker-input)

```bash
vercel env ls staging
```

Forvent **14** vars. Sammenlign med tabellen over.

---

## Variant C-sjekk

Staging-env skal peke til:

- Supabase `uigxsboqeruxflgzqztl` (tom data, schema fra dump)
- Sanity `staging` dataset (tom innhold utenom bootstrap)
- Ingen live e-post (`LP_RESEND_LIVE_SEND=false`, SMTP/Resend utelatt)
