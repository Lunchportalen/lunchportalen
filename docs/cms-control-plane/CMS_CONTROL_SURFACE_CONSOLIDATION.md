# Arbeidsstrøm 1 — CMS control surface consolidation

**Dato:** 2026-03-29  
**Sist oppdatert (CP1):** Runtime-modulstatus-strip + bro til operative tårn — se `CmsRuntimeStatusStrip`, `control/page.tsx`.

**Mål:** Backoffice som opplevd **hovedflate** for redaksjonell og styringsmessig kontroll — uten ny shell og uten parallell arkitektur.

## CP1-leveranser (implementert)

- **`CmsRuntimeStatusStrip`** under `TopBar`: viser LIVE / LIMITED / DRY_RUN / STUB per modul med `title`-forklaring (kilde: `lib/cms/controlPlaneRuntimeStatusData.ts`).
- **`BackofficeShell`** tar valgfri `statusStrip` (server-injisert fra `layout.tsx`).
- **Ingen** ny navigasjonsshell — samme chrome (`TopBar`) og phase2a-DNA.

## Nåstatus (sterkt)

- **Én fysisk backoffice-gruppe:** `app/(backoffice)/backoffice/**` med `BackofficeShell` (varm bakgrunn, `TopBar`, workspace-split) — se `docs/phase2a/BACKOFFICE_SURFACE_HIERARCHY.md`.
- **Design system / visual DNA:** Phase2a dokumenter (`LUNCHPORTALEN_VISUAL_DNA.md`, `DESIGN_TOKEN_MAP.md`, `SECTION_SCOPE_DESIGN_IMPLEMENTATION.md`) beskriver lag og tokens — **skal gjenbrukes**, ikke dupliseres.
- **Content workspace** er stor men **kanonisk** for side/blokk-redigering.

## Gap (følelsen av minisystemer)

- **Admin (`/admin`)** og **superadmin (`/superadmin`)** bruker canonical header (`HeaderShell`) — **riktig** for roller, men **visuelt og narrativt** adskilt fra `(backoffice)`.
- **Kitchen/driver** er operative mobil/desktop-flater — **skal** være adskilt, men trenger **eksplisitte broer** (lenker/kontekst) i docs og evt. superadmin hub.

## Anbefalte tiltak (lav risiko)

1. **Superadmin «hub»-kort** som peker til backoffice content/media/AI med modulstatus — kun navigasjon og copy.
2. **Konsekvent modul-tagg** på growth-flater: LIVE / LIMITED / DRY_RUN / STUB (samme ordliste som i `CMS_GROWTH_MODULE_ALIGNMENT.md`).
3. **Ingen ny `ModulesRail` eller sidemeny** hvis tidligere fjernet — bruk `TopBar`-faner og eksisterende tre i content.

## Ikke gjøre

- Ny app-shell eller `v2`-layout.
- Flytte admin layout inn i backoffice uten sikkerhetsreview (roller er forskjellige).

## Evidens

- `app/(backoffice)/backoffice/_shell/BackofficeShell.tsx`
- `docs/phase2a/CMS_SHELL_UPLIFT.md`, `BACKOFFICE_SURFACE_HIERARCHY.md`
