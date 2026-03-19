# Health og cron – sannhet

**Fasit for hva som finnes i kode. Oppdater ved endringer.**

## Health

- **Kilde:** `lib/system/health.ts` → `runHealthChecks()`.
- **Ruter:**  
  - `app/api/system/health/route.ts` – bruker runHealthChecks, returnerer rapport (jsonOk/jsonErr).  
  - `app/api/superadmin/system/health/route.ts` – samme, med superadmin-gate.  
  - `app/api/health/route.ts` – offentlig health (omtrent samme eller forenklet).
- **Respons:** Strukturert rapport (ok, rid, data med status og subsystemer). Ingen ustrukturert 500; feil går via jsonErr.
- **Content/media/builder i health:** Ikke eksplisitt som egne subsystemer i runHealthChecks per i dag. Legg til kun ved behov og minimal risiko; ikke fake health.

## Cron

- **Auth:** `lib/http/cronAuth.ts` → `requireCronAuth(req, options?)`. Ved manglende/ugyldig secret: returnerer Response med 401/403 og tydelig body (misconfigured/forbidden). Ingen stille pass-through.
- **Ruter som bruker requireCronAuth (verifisert i grep):**  
  cleanup-invites, daily-sanity, preprod, system-motor (med SYSTEM_MOTOR_SECRET), forecast, outbox, lock-weekplans, week-scheduler, week-visibility, kitchen-print, invoices/generate, esg/daily, esg/monthly, esg/yearly, esg/generate, esg/lock/monthly, esg/lock/yearly.
- **Kontrakt:** Ved feil: jsonErr med rid, message, status, error. Ved suksess: jsonOk der ruten returnerer JSON.
- **Dokumentasjon:** `docs/CRON_AUTH.md`, `docs/drift/cron-error-handling.md`. Disse skal beskrive faktisk oppførsel; oppdater ved endring av cronAuth eller ruter.

## Drift

- Drift-docs (f.eks. under docs/drift/) skal matche kode. Ved endring i health eller cron: oppdater denne doc og eventuelle runbooks.
