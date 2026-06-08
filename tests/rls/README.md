# RLS golden snapshot og drift-overvåking

## Hva ligger her

- **`golden-rls-snapshot.json` (v2)** — full katalog: alle RLS-policyer i `public`/`private`, alle `private.*`-funksjoner med `body_hash` (`md5(pg_get_functiondef)`), og alle tabeller med RLS aktivert inkl. `policy_count` (0 = ingen policy-rader; deny-all for vanlige roller).

Se **`docs/rls-golden.md`** for arbeidsflyt (`npm run rls:snapshot`, Vitest, tolkning av `roles: []`).

## Lokalt / CI uten prod-URL

**Vitest** `migrationParity.test.ts` hopper over hvis `DATABASE_URL` / `SUPABASE_POSTGRES_URL` mangler (samme mønster som andre DB-tester). Kjør eksplisitt med:

`npx vitest run --config vitest.rls.config.ts tests/rls/migrationParity.test.ts`

**Drift-script**:

```bash
npm run check:rls-drift
```

- Uten URL (og uten relevante vars i `.env`): **exit 2** + JSON med `error: "MISSING_DATABASE_URL"`.
- Med URL: **exit 0** ved match, **exit 1** ved drift, **exit 2** ved tilkoblings-/lesefeil.

`SUPABASE_POSTGRES_URL` slår `DATABASE_URL` hvis begge er satt (samme som snapshot-script og parity-test). Skriptet laster `.env.local` / `.env` via `dotenv`.

**URL-prioritet (drift + snapshot):** `RLS_DRIFT_DATABASE_URL` → `DATABASE_URL` → `SUPABASE_POSTGRES_URL`. Dette unngår at staging-`SUPABASE_POSTGRES_URL` overskriver prod-`DATABASE_URL` i `.env.local`.

**Identity guard (fail-closed):** Før diff/skriving verifiseres at tilkoblet ref (fra `postgres.<ref>` i URL) matcher pinnede `RLS_DRIFT_EXPECTED_REF` (default `hkpokyapzarefrgqzkos`), og at `golden.project_ref` matcher samme pin (kun drift-sjekk). Feil instans → exit 2 med tydelig melding — golden kan ikke regenereres mot staging ved et uhell.

## GitHub Actions

Workflow: **`.github/workflows/rls-drift-check.yml`**

- Kjører daglig **06:00 UTC** og via **workflow_dispatch`.
- Krever repo-secret **`DATABASE_URL`** (direkte Postgres, typisk port **5432** med `sslmode=require`).
- Ingen endring av golden fra jobben — ved rød jobb: fiks prod/migrasjon **eller** oppdater golden med vilje i en egen MR.

## Når prod avviker (rød jobb)

Tolking (JSON fra `check-rls-drift.mjs`):

- **`drift.policies`** — policy lagt til/fjernet/endret (inkl. `using_expr` / `check_expr` / roller) uten golden-oppdatering.
- **`drift.private_functions`** — `private.*`-signatur eller `body_hash` avviker.
- **`drift.rls_enabled_tables`** — RLS på/av på tabell, eller endret `policy_count`.
- **`meta.match: false`** — `project_ref` eller `postgres_version` stemmer ikke med golden (f.eks. annen database eller oppgradert Postgres).

Målet er å fange **ubeviste endringer** tidlig — ikke å erstatte menneskelig reviewing av migrasjoner.

## Oppdatere golden ved bevisst endring

1. Gjør endringen via migrasjon / MCP.
2. `npm run rls:snapshot` (mot riktig `DATABASE_URL` / `SUPABASE_POSTGRES_URL`), code review av diff.
3. Kjør parity-test over med `vitest.rls.config.ts`.
4. Committ golden sammen med RLS-endringen.

## Secrets / tilkobling

- **Anbefalt i GitHub:** secret **`DATABASE_URL`** med sterk passord-rolle.
- **Framtidig forbedring:** dedikert **read-only** Postgres-bruker med minimale rettigheter.
- Snapshot- og drift-verktøy bruker `ssl: { rejectUnauthorized: false }` og fjerner `sslmode` fra URL der nødvendig for Node-pg mot Supabase pooler (TLS fortsatt aktivert).
- **Session Pooler (GitHub Actions):** bruk pooler-host for IPv4-kompatibilitet mot Actions-runner der direct connection er IPv6-only.

## Relaterte tester

- `migrationParity.test.ts` — full v2-paritet mot golden når URL er satt.
- `check-rls-drift.mjs` — samme forventninger som JSON-rapport (scheduled / lokal).
