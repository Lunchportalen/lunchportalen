# Due Diligence (Tech + M&A)

Dette dokumentet beskriver den faktiske tekniske strukturen, sikkerhetsregimet og driftsflaten i repoet. Det er ment som en kort og verifiserbar oversikt for ekstern gjennomgang.

## Arkitektur og ansvarsdeling

Repoet har ett tydelig lagdelt ansvar:

- `app/` inneholder kun Next.js routes, layouts og server/client entrypoints.
- `lib/` inneholder all domenelogikk, guards, cutoff, idempotens, ops/audit/logging og delte regler.
- `components/` inneholder kun UI-komponenter (presentasjon uten forretningslogikk).
- `app/api/` inneholder kun API-ruter som bruker guards og returnerer standard responsformat.
- `scripts/` inneholder kun scripts for auditing/sanity/CI, ikke runtime-kode.
- `docs/` inneholder drift, compliance og runbooks.

Ingen duplikat-ansvar er tillatt. Endringer i domenelogikk skjer kun i `lib/`.

## Sikkerhet og tilgang

- Alle admin/superadmin/kitchen/driver-ruter er guardet og fail-closed.
- Rolleavgjoring skjer server-side og krever gyldig profil eller eksplisitt systemkonto.
- API-responser lekker ikke stacktraces eller secrets til klient.
- Systemkontoer er hardt definert i `lib/system/emails.ts` og brukes konsekvent.

## Data og integritet

- En sannhetskilde per domene (ingen parallell logikk i UI).
- Write-endpoints er idempotente og gjenkjenner samme input uten unodvendige tidsstempel-oppdateringer.
- Cutoff håndheves server-side (08:00 Europe/Oslo).
- DB-feil blir håndtert som fail-closed med entydig feilkode og `rid`.

## Drift og observability

Nokkelendepunkter:

- `GET /api/health` gir status, timestamp og verifiserte checks (app, supabase, db_schema, sanity).
- `POST /api/cron/daily-sanity` er beskyttet og skriver strukturert ops-logg.
- Alle API-responser inneholder `rid` for sporbarhet.

Incident logging:

- Ved 5xx registreres incident-event (ops/audit-log eller JSON log fallback).
- Kun ID-felter logges (ingen PII).

## Personvern og logging

- Systemet lagrer kun nodvendige identifikatorer (user_id, company_id, location_id).
- Logging bruker `rid` for sporbarhet uten a logge sensitive felter.
- Ingen persondata logges utover IDs.

## Miljo- og deploykrav (env vars)

De viktigste miljovariablene:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- `LP_CRON_SECRET` (cron-sanity)
- `NEXT_PUBLIC_APP_URL`

Verdier skal aldri ligge i repo. Kun navn er dokumentert her.

## Build- og gatekrav

Foreskrevne gates i CI:

- `npm run typecheck`
- `npm run lint`
- `npm run build:enterprise`
- `npm run sanity:live`
- `npm run audit:api`
- `npm run audit:repo`

Alle gates ma passere for deploy. Det er ingen manuelle unntak.
