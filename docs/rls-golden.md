# RLS Golden Snapshot

## Hva

`tests/rls/golden-rls-snapshot.json` er sannhet for RLS-konfigurasjonen i prod. Endringer i policyer, security helpers eller RLS-aktiverte tabeller MÅ være intentional og reflekteres i golden.

## Når oppdatere

- Du legger til/endrer/sletter en RLS-policy
- Du endrer en `private.*`-funksjon
- Du aktiverer/deaktiverer RLS på en tabell

## Hvordan oppdatere

1. Gjør endringen (via migration, MCP, etc.)
2. Eksporter `DATABASE_URL` for prod (eller legg det i `.env` / `.env.local` som ikke committes)
3. Kjør: `npm run rls:snapshot`
4. Verifiser diff i `tests/rls/golden-rls-snapshot.json`
5. Kjør test:

   `npx vitest run --config vitest.rls.config.ts tests/rls/migrationParity.test.ts`

6. Forventet: exit 0
7. Committ golden-endring sammen med RLS-endringen

## Pass/fail

PASS: golden matcher prod på alle tre dimensjonene eksakt (pluss `project_ref` og `postgres_version` i filen).

FAIL: Avvik et sted — sjekk Vitest-diff for å forstå hvorfor.

## Postgres-versjon

`body_hash` for funksjoner er `md5(pg_get_functiondef)`. Pg-versjon kan påvirke output. Hvis Supabase oppgraderer Pg-major: forvent at golden trenger regenerering.

## Policy-roller (`roles`)

Listen er sortert alfabetisk. **Tom liste (`[]`)** betyr at policyen gjelder for alle roller (Postgres: `polroles` tom — «public» i betydningen alle brukere, ikke nødvendigvis rollenavnet `public`).

## Tabeller uten policyer

3 tabeller har RLS aktivert men 0 policyer (deny-all for authenticated):

- `company_invites`
- `employee_invites`
- `menu_visibility_days`

Dette må verifiseres som intentional eller fikses (P3-backlog).

5 `_migration_*`-stubs er legacy/archive — forventet deny-all.
