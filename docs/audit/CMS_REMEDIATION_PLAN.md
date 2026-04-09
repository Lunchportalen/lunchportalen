# CMS Remediation Plan

**Tilknyttet:** `CMS_AUDIT_REPORT.md`, `CMS_FILE_INVENTORY.md`  
**Formål:** Handlingsrettet plan uten å implementere endringer i denne leveransen.

---

## Quick wins (0–14 dager)

| Tiltak | Hva | Hvorfor | Berørte områder | Effekt | Risiko | Prioritet |
|--------|-----|---------|-----------------|--------|--------|-----------|
| QW-1 | Juster **preview-container** til samme `max-w-*` som `[slug]/page.tsx` | Reduser falsk trygghet i preview | `LivePreviewPanel.tsx`, ev. `PreviewCanvas.tsx` | Bedre WYSIWYG | Lav UI | P0 |
| QW-2 | Dokumenter i UI at CMS-sider er **superadmin** | Unngå forventningsgap | `ContentTopbar` eller `page.tsx` copy | Klarhet | Lav | P1 |
| QW-3 | Fjern eller **wire** `studio/schemas/` eller slett mappen etter bekreftelse | Fjerner «spøkelses-schema» | `studio/schemas/` | Mindre forvirring | Medium (slett) | P2 |
| QW-4 | **Konsolider** Sanity-studio: én mappe (`studio/` vs `studio/lunchportalen-studio/`) | Én sann CLI/deploy | `studio/` | Drift | Medium | P1 |

---

## Må stoppes umiddelbart (policy)

1. **Nye blokkomponenter** i `EnterpriseLockedBlockView` uten samtidig **skjemadefinisjon** og migreringsplan — leder til mer `switch`-gjeld.
2. **Nye AI-paneler** inn i `ContentWorkspace.tsx` uten å **fjerne** eller **flytte** eksisterende — øker monolitten.
3. **Nye `type`-strenger** i JSON uten oppdatering av **alle** lag (editor, map, render, test).

---

## Teknisk gjeld som ikke bør videreføres

- **Legacy-mapping** som permanent strategi (`blockTypeMap.ts` som «sannhet»).
- **9900+ linjer** i én React-komponent.
- **Tre** blokksannheter uten automatisk konsistens-sjekk (CI kan utvides utover `cms:check`).

---

## Konsepter som må inn (Umbraco-lignende kvalitet)

1. **Én canonical block schema** (TypeScript + runtime validator, f.eks. Zod) per `type`.
2. **Renderer registry** — `Record<type, Component>` i stedet for **én** `switch`.
3. **Deterministisk preview** — samme **server**-funksjon som henter design + media, eller **SSR** preview route.
4. **Document type** (side-mal) med **tillatte blokker** — forhindrer «alt i alt».
5. **Rollebassert redigering** — hvis firma-redaktører noen gang skal inn: **ikke** bare `superadmin`.

---

## 0–2 uker: Akutt stabilisering

| ID | Endring | Hvorfor | Filer / områder | Effekt | Risiko |
|----|---------|---------|-------------------|--------|--------|
| A1 | Kartlegg **alle** `block.type` i prod-data (SQL/script) | Migrering krever sannhet | DB / script | Beslutningsgrunnlag | Lav |
| A2 | Skille **preview route** som kaller **samme** server-loader som `[slug]` (valgfritt iframe av `/[slug]?preview=true`) | Paritet | `PreviewCanvas.tsx`, `loadLivePageContent` | Tillit | Medium |
| A3 | **Test** som feiler hvis `CORE_CMS_BLOCK_DEFINITIONS` og `editorBlockTypes` divergerer uten eksplisitt unntak | Fang synk-brudd | `tests/cms/` | Regresjon | Lav |

---

## 2–6 uker: Strukturell opprydding

| ID | Endring | Hvorfor | Filer | Effekt | Risiko |
|----|---------|---------|-------|--------|--------|
| S1 | Splitt `ContentWorkspace.tsx` i **lagringsmotor**, **blokkliste**, **preview**, **AI-sidebar** | Vedlikehold | `ContentWorkspace.tsx` → nye filer | Lesbarhet | Medium |
| S2 | Flytt `blockFieldSchemas` nærmere **én** `BlockSchema`-modul | Færre duplikater | `blockFieldSchemas.ts`, `componentRegistry.ts` | DRY | Medium |
| S3 | Innfør **Zod** (eller liknende) for `body` i `PATCH` handler | Korrupt data stoppes | `pages/[id]/route.ts` | Robusthet | Medium |
| S4 | Migrer **zigzagSteps** fra JSON-string til strukturert array (versjonert migrering) | Skjør data | `blockTypeMap.ts`, DB | Kvalitet | Høy uten backup |

---

## 6–12 uker: Re-arkitektur

| ID | Endring | Hvorfor | Filer | Effekt | Risiko |
|----|---------|---------|-------|--------|--------|
| R1 | Erstatt `EnterpriseLockedBlockView` **switch** med **registry map** | Utvidelse uten å endre gigantfil | `EnterpriseLockedBlockView.tsx` | Skalerbarhet | Medium |
| R2 | **Én** `BlockType` enum / union generert fra schema | Type-sikkerhet | `lib/cms/model/` | Utvikler-UX | Medium |
| R3 | **Batch-migrer** lagret JSON til **registry**-feltnavn (engangsjobb) | Fjern `adaptLegacy` | `blockTypeMap.ts` | Enklere kodebase | Høy |
| R4 | Vurder **Sanity** som kilde for **marketing pages** *eller* **styrk** Supabase med ordentlig CMS-API — **ett valg** | Slutt på split-brain | Arkitektur | Klarhet | Strategisk |

---

## 3–6 måneder: Langsiktig plattformretning

| ID | Retning | Beskrivelse |
|----|---------|-------------|
| L1 | **Observability** for CMS | Spor `rid`, feil per blokk-type ved render, dashboard for «null-render». |
| L2 | **Workflow** | Utvid `workflowRepo` / `page_versions` med eksplisitte steg (review) hvis forretning krever det. |
| L3 | **Multi-tenant editors** | Dersom krav: `content_pages.company_id` + RLS + `company_admin` — **stor** endring; planlegg separat. |

---

## Prioritert veikart (anbefalt rekkefølge)

1. **A1** → **S1** → **R1** (data → modularisering → renderer)  
2. Parallelt: **A2** eller **QW-1** for preview-tillit  
3. **R3** først når **A1** viser at data er kontrollerbar  

---

## Målinger for «ferdig»

- [ ] 0 blokktyper som kun finnes i `switch` men ikke i schema.  
- [ ] `ContentWorkspace` < **2000** linjer (eller erstattet av moduler med klare grenser).  
- [ ] Preview og prod bruker **samme** normalisering + media-oppløsning (test i CI).  
- [ ] `PATCH` avviser ugyldig `body` med **422** og felt-feil.

---

*Slutt på CMS Remediation Plan.*
