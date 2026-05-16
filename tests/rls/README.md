# RLS golden snapshot og drift-overvåking

## Hva ligger her

- **`golden-rls-snapshot.json`** — forventet kjerne-RLS for ordre/meny (16 policy-nøkler på fire tabeller) og settet av `private.*`-hjelpere (signaturer). To funksjoner har i tillegg **`capturedPrivateFunctionDefMd5`**: `md5(pg_get_functiondef(oid))` fra Postgres slik at **definisjonsendring** i prod oppdages.

## Lokalt / CI uten prod-URL

**Vitest** `migrationParity.test.ts` hopper over hvis `DATABASE_URL` / `SUPABASE_POSTGRES_URL` mangler (samme mønster som andre DB-tester).

**Drift-script** (for scheduled GitHub Actions):

```bash
node scripts/check-rls-drift.mjs
```

- Uten URL: **exit 2** + JSON med `error: "MISSING_DATABASE_URL"`.
- Med URL: **exit 0** ved match, **exit 1** ved drift, **exit 2** ved tilkoblings-/lesefeil.

`DATABASE_URL` slår `SUPABASE_POSTGRES_URL` hvis begge er satt.

## GitHub Actions

Workflow: **`.github/workflows/rls-drift-check.yml`**

- Kjører daglig **06:00 UTC** og via **workflow_dispatch**.
- Krever repo-secret **`DATABASE_URL`** (direkte Postgres, typisk port **5432** med `sslmode=require`).
- Ingen endring av golden fra jobben — ved rød jobb: fiks prod/migrasjon **eller** oppdater golden med vilje i en egen MR.

## Når prod avviker (rød jobb)

Tolking:

- **`policies.missing` / `policies.extra`** — policy lagt til/fjernet på `orders`, `order_items`, `menu_service_days`, `menu_service_day_items` uten at golden er oppdatert (eller omvendt: migrasjon ikke applyet).
- **`privateFunctions.missing` / `privateFunctions.extra`** — `private.*`-settet matcher ikke (ny helper, droppet funksjon, eller feil database).
- **`definitionHashes.drifted`** med `kind: "changed"` — samme signatur, annen kropp (f.eks. annen join / feil reparert funksjon).
- **`kind: "missing"`** — forventet funksjon for L3 finnes ikke med riktige identitetsargumenter.

Målet er å fange **ubeviste endringer** (som den brutte join mot slettede `locations`) tidlig — ikke å erstatte menneskelig reviewing av migrasjoner.

## Oppdatere golden ved bevisst endring

1. Bekreft endring via migrasjon / Supabase MCP / replikèrbar repro.
2. Kjør capturering etter Prosjektets etablerte flyt (`scripts/generate-prod-rls-capture.mjs` + migrasjon når aktuelt) og code review.
3. Oppdater **`golden-rls-snapshot.json`** i MR sammen med migrasjonen — **kjør ikke** drift-script med skrivetilgang til denne fila; den skal aldri overskrives automatisk.

## Secrets / tilkobling (v1)

- **Anbefalt i GitHub:** secret **`DATABASE_URL`** med sterk passord-rolle (v1).
- **Framtidig forbedring:** dedikert **read-only** Postgres-bruker med minimale rettigheter (kun `CONNECT` + lesing av katalog/relevante skjemaer). Samme connection string-format; ingen skriptendring nødvendig.
- Bruk **direkte** `5432` mot Supabase der mulig. Pooler `6543` / transaction mode kan gi uventet oppførsel; hold det enkelt.
- Skriptet legger til **`sslmode=require`** hvis URL mangler det.

## Relaterte tester

- `migrationParity.test.ts` — samme forventninger som L1/L2 når URL er satt.
- `check-rls-drift.mjs` — L1 + L2 (stram, inkl. ekstra policy/funksjon) + L3 (def-md5 for alle nøkler i `capturedPrivateFunctionDefMd5`). Utvidelse av L3 skjer ved å **utvide JSON-fila**, ikke ved å endre sammenligningslogikken i skriptet.
