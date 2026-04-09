# CP2 — CMS Control Plane Deep Runtime Integration — Execution plan

**Dato:** 2026-03-29

## Mål

Flytte opplevd kohærens fra «CMS-led but fragmented» mot **enterprise-coherent** ved å bygge **faktiske runtime-broer** (lesing, navigasjon, synlig kjede) — **uten** ny transaksjonell sannhet og **uten** parallell menykilde.

## CP2-omfang (implementasjon)

1. **Runtime-oversikt** (`/backoffice/runtime`): read-only aggregater (firma, lokasjoner, aktive avtaler) via eksisterende admin-klient + superadmin-gate — samme mønster som `/api/superadmin/overview`.
2. **Uke & meny** (`/backoffice/week-menu`): leseflate som henter **Sanity `menu`** via `getMenusByMealTypes` (eksisterende kilde), forklarer **GET /api/week**-kjeden, lenker til **Sanity Studio** (styring over samme kilde — ikke ny CMS-database).
3. **TopBar**: nye faner **Runtime** og **Uke & meny** for IA.
4. **Dokumentasjon**: kontrakter, week-beslutning, slutt-rapporter.

## Eksplisitt utenfor CP2

- Mutasjon av avtaler/firma fra backoffice (fortsatt superadmin/admin-ruter).
- Ny Postgres-meny eller duplikat `weekPlan` som employee-sannhet.
- Middleware/auth/onboarding/order/window/billing-endringer.

## Suksesskriterier

- Superadmin ser **én sammenhengende fortelling** om runtime + menykjede.
- **Ingen** regressjon i typecheck / build:enterprise / test:run.
- Kode forblir **fail-closed** ved manglende admin-konfigurasjon.
