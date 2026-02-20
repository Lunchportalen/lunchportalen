# Technical & Security Overview

## Hosting og plattform
- Next.js App Router (Node.js) og Supabase (Postgres + Auth + Storage).
- All server-side logikk kjører på backend; klient får kun API-responser med ok/rid-kontrakt.
- Datasenter følger leverandørens EU/EØS-region der dette er konfigurert.

## Autentisering og roller
- Roller: `superadmin`, `company_admin`, `employee`, `driver`, `kitchen`.
- Server-side guards håndhever tilgang. Ingen klient-redirects basert på session gjetning.
- Post-login resolver: `/api/auth/post-login` med allowlist per rolle.

## Datamodell (kjerne)
- `companies`, `company_locations`, `profiles`, `orders`.
- Konsern (valgfritt): `enterprise_groups` koblet til `companies`.
- Leveringsdata er alltid filtrert på `company_id` (og `location_id` der relevant).

## Logging og audit
- Audit: `audit_events` / `audit_log` (systemkritiske handlinger).
- Incidents: `incidents` (operasjonelle hendelser med scope, severity, rid, meta).
- Logs er strukturert og rid-sporet.

## Sikkerhet og isolasjon
- Zero cross-company leakage: alle queries filtrerer på `company_id`.
- Fail-closed: ved usikkerhet blokkeres handlinger og systemet gir trygge feilmeldinger.
- Service role brukes kun server-side for eksplisitt RLS-bypass.

## Backups og DR
- Supabase standard backups for Postgres (tilgjengelig i plattformen).
- DR-prosedyrer og restore-testing dokumenteres i enterprise-program.

## GDPR og personvern
- Dataminimering og rollebasert tilgang.
- Retensjon og sletting gjennom policy (fasevis innført).
- Databehandleravtale (DPA) tilgjengelig for enterprise-kunder.
