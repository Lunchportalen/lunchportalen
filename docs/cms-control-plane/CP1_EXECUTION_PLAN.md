# CP1 — CMS Control Plane Runtime Integration — Execution plan

**Dato:** 2026-03-29  
**Mål:** Gjøre backoffice til tydelig **kontrollflate** med **synlig runtime-status** og **broer** til operativ sannhet — uten nye datalag, uten auth/onboarding/endringer i ordre-vindu.

## Omfang (innenfor CP1)

1. **Runtime-modulstatus** (LIVE / LIMITED / DRY_RUN / STUB) synlig i backoffice-shell — én felles sannhetsliste i kode (`lib/cms/controlPlaneRuntimeStatus.ts`).
2. **Runtime-bro** på `/backoffice/control`: lenker til superadmin/system, companies, growth/social — read-only navigasjon.
3. **Dokumentasjon:** CP1-filer + oppdaterte arbeidsstrøm-dokumenter og sluttrapport.

## Eksplisitt utenfor CP1 (ikke startet)

- Nye API-ruter for agreement-mutasjon fra CMS.
- Middleware/auth/endringer.
- Parallell week/meny-sannhet.
- Worker-implementasjon (stubs forblir dokumentert som STUB).

## Rekkefølge

1. Oppstartsdok (CP1_*.md).
2. Kode: status + bro.
3. Verifikasjon: typecheck, build:enterprise, test:run.
4. Sluttdok (UMBRACO, signoff, risiko, neste steg).

## Suksesskriterier

- Superadmin ser **ærlig** status for Social (DRY_RUN), worker-relaterte jobber (STUB), innhold (LIVE).
- Ingen regressjon i build/test.
- Ingen ny runtime-sannhet i Postgres fra CMS.
