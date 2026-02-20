# Company Archive RC

## Freeze-protokoll
Disse filene og endepunktene er nå låst for RC for arkivering. Ingen endringer uten eksplisitt godkjenning.

- `app/api/superadmin/companies/[companyId]/archive/route.ts`
- `app/api/superadmin/companies/[companyId]/orders/route.ts`
- `app/api/superadmin/companies/route.ts`
- `app/superadmin/companies/companies-client.tsx`
- `app/superadmin/companies/[companyId]/page.tsx`
- `app/superadmin/companies/[companyId]/ArchivePanel.tsx`

## GO/NO-GO sjekkliste (testbar)

Arkiver firma
- PASS/FAIL: Krever superadmin
- PASS/FAIL: Krever korrekt confirm `${orgnr} SLETT`
- PASS/FAIL: Idempotent (kjør to ganger → ingen feil)

Kill access
- PASS/FAIL: Ansatt i firma kan ikke logge inn etter arkivering

Firmaoversikt
- PASS/FAIL: Aktive viser kun `deleted_at IS NULL`
- PASS/FAIL: Slettet (Arkiv) viser kun `deleted_at IS NOT NULL`

API robusthet
- PASS/FAIL: `sort=updated_at` gir ikke 500 (fallback om nødvendig)
- PASS/FAIL: DB-feil returnerer tydelig message + rid

Historikk
- PASS/FAIL: Orders vises for arkivert firma
- PASS/FAIL: Økonomi-sum vises hvis snapshot finnes, ellers tydelig warning

## Acceptance tests
- GET `/api/superadmin/companies?archived=0` → 200
- GET `/api/superadmin/companies?archived=1` → 200
- Arkiver firma via UI → firma flyttes til arkivtab
- En ansatt forsøker å logge inn etter arkivering → feiler
- Arkivert firmadetalj viser orders + økonomi/varsling
