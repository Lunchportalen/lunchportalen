# CP13 — Decision

**Dato:** 2026-03-29

## 1. Endelig beslutning

**GO WITH CONDITIONS**

- **GO:** Kanonisk **Bellissima-lignende extension registry** (`backofficeExtensionRegistry.ts`) er innført som **eneste** kilde for TopBar + command palette; workspace context **typer** lagt til; dokumentasjon fullført.
- **Betingelse:** Full Umbraco **.NET extension loader** / JSON manifest på disk leveres **ikke** — bevisst stack-valg.

## 2. Hva som er oppnådd

- **CMS som hovedbase:** Backoffice-moduler er manifesterte med `id`, `kind`, `sectionId`, `collectionKey`, og valgfri kobling til **domain surface** + **module posture**.
- **Domener vs CMS:** Uendret dataflyt; **forklaring** forsterket via manifest-metadata pekere til CP4–CP6.
- **Ukemeny/ukeplan:** `nav.week-menu` → `domainSurfaceId: week_menu`, `modulePostureId: operational_week_menu_governance` — samme operative kjede som før.
- **Sections/trees/workspaces:** Standardisert i registry; navigasjon avledet deterministisk.
- **AI governance:** Tower-lenke koblet til `modulePostureId` (ærlig om worker/jobb-lag); ellers uendret API-lag.

## 3. Hva som fortsatt er svakt

- Ingen **global workspace React Context** — bevisst for å unngå duplikat state.
- Ingen **serialisert** manifest-fil — kun TypeScript.
- **Social/SEO/ESG** LIMITED/DRY_RUN der tidligere.

## 4. Nærhet til Umbraco 17 / verdensklasse

**Sterkere strukturell paritet** (extension + section + workspace entry); **ikke** identisk med Umbraco **Management API** eller **Distributed Cache**.

## 5. Før ubetinget enterprise-live-ready

1. Eventuell **AI settings** UI.
2. Eventuell **global søkeindeks** (fra CP12/U17 spor).
3. Systematisk **a11y** pass på backoffice-krom.

## 6. Kan vente

- JSON manifest export.
- Full `BackofficeWorkspaceSession` på alle sider.
