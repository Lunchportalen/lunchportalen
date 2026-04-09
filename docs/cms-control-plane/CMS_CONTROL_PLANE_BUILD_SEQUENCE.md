# CMS Control Plane — Build sequence (lav risiko først)

**Dato:** 2026-03-29  
**Prinsipp:** Dokumenter og IA før database-endringer; les før skriv; én sannhetskjede om gangen.

## Fase 0 — Kartlegging (fullført som docs)

1. Baseline + SOT-map + runtime boundaries (denne mappen).
2. Avstem mot `OPEN_PLATFORM_RISKS.md` — ingen illusjon om at docs lukker A1/A3 alene.

## Fase 1 — IA & navigasjon (lav risiko)

1. **Konsolidér backoffice navigasjon** under eksisterende `BackofficeShell` / `TopBar` — ingen ny shell.
2. Tydelige modulmerker (LIVE / LIMITED / DRY_RUN / STUB) på growth-flater.
3. Krysslenker: admin/superadmin ↔ backoffice der det gir mening (**navigasjon**, ikke ny data).

## Fase 2 — Uke/meny sannhetskjede (medium risiko — kun med tester)

1. Dokumenter end-to-end: Sanity menu → `GET /api/week` → UI (allerede delvis i kode).
2. Vurder **én** redaksjonell «publish»-knapp-fortelling (uten ny DB) — align med `weekplan/publish` policy.
3. Eksplisitt **UI-tekst** som skiller `weekPlan` (editorial) fra operative menyer.

## Fase 3 — Company/agreement innsyn (medium, read-first)

1. Server-side helpers som henter agreement summary for superadmin/backoffice **read-only** paneler.
2. Ingen skriving til `company_current_agreement` fra CMS save uten egen sikker API — **ikke** i content route.

## Fase 4 — Growth-moduler (medium)

1. Konsolider SEO/social/ESG **innganger** i én modul-fortelling per `CMS_GROWTH_MODULE_ALIGNMENT.md`.
2. Fjern eller merk **STUB**-veier i worker før bruker-synlig «klar».

## Fase 5 — Hardening (høy risiko — koordinert)

1. API gate audit (mekanisk der mulig) — **separat** mandate; ikke bland med CMS UX.
2. `strict: true` — egen migrasjonskampanje — **ikke** smågrep i samme leveranse som CMS IA.

## eksplisitt ikke i denne sekvensen (uten ny instruks)

- Nye parallelle content stores.
- Middleware-rolle refaktor som enkelt «CMS»-fix.
- Endring av onboarding eller ordre-schema «fordi CMS».
