# Phase H1 — Neste steg

## Fullført i H1

- Lukket **anonym tilgang** til `POST /api/something` (demo/contract-smoke rute).  
- Dokumentert auth/cron/worker/observability/pilot for H1-scope.

## Anbefalt etter H1 (ikke startet her)

1. **Stikkprøve-audit** av 10–20 tilfeldige sensitive `route.ts` (admin/superadmin/cron).  
2. **Skru på `strict`** trinnvis eller for nye filer (teknisk gjeld).  
3. **Erstatt worker-stubs** (`send_email`, `ai_generate`, …) når produkt krever det — egen fase.  
4. **Sentral alert** (5xx, cron silence) — eier og verktøy.

## Stoppregel

- Ingen automatisk start av H2 eller produktfaser uten eksplisitt scope.
