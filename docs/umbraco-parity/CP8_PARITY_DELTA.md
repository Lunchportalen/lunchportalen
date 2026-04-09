# CP8 — Umbraco parity delta

**Dato:** 2026-03-29  
**Bygger på:** `docs/umbraco-parity/*` (baseline), `docs/cms-control-plane/CP1–CP7`, CP7 publish-broker.

## Hva som allerede er nær Umbraco-paritet

- **Backoffice som hub:** `BackofficeShell` + `TopBar` med seksjoner (Control, Domener, Uke & meny, Content, Media, SEO, Social, ESG, …).
- **Content workspace:** tre, blokker, preview/publish for Postgres-sider — enterprise-redaksjonell kjerne.
- **Domain action surfaces:** modulhierarki med kilde, posture, handlinger, «why it matters».
- **Operativ meny-kjede:** nummerert kjede + readiness + native publish panel + Studio-handoff.
- **Module posture:** LIVE / LIMITED / DRY_RUN / STUB — ærlig runtime-status.
- **CP7:** server-broker for `menuContent` publish (Sanity Actions), superadmin.

## Hva som fortsatt er under Umbraco-paritet

- **Én teknisk CMS-kjerne** (.NET Content Service) — finnes ikke; Postgres + Sanity + Supabase er bevisst adskilt.
- **Én samlet history/rollback-tidslinje** på tvers av Postgres og Sanity.
- **Granulerte CMS-roller** i samme backoffice (kun `superadmin` i `/backoffice`).
- **Null opplevde gap** for alle brukere — urealistisk uten bred brukertest; mål er **kontrollert** løft.

## Løst siden Umbraco-parity baseline

- Operativ publish-kjede i kode/UI **synkronisert** med CP7 broker (samme narrativ som broker, ikke bare Studio).
- Dokumentasjon under `docs/umbraco-parity/` + denne CP8-pakken.

## Åpen plattformrisiko (uendret)

- Sanity ↔ ev. `menu_visibility_days` (superadmin meny) — operativ forståelse.
- CDN-latens etter publish.
- Growth-moduler kan være LIMITED — avhenger av deployment.

## Hva CP8 skal bygge for «ett samlet CMS»-følelse

- **Tydeligere redaksjonell kontrakt** (workflow, document-type/property-editor språk) — dokumentert.
- **Gap-closure matrix** med konkrete, lavrisiko tiltak (UX/copy/IA), ikke replatforming.
- **Minimal kode:** sync av publish-kjede-tekst med faktisk CP7-atferd; ingen ny motor.
