# U38 Decision

## 1. Endelig beslutning

- `GO WITH CONDITIONS`

## 2. Hva som er oppnådd

- CMS fungerer nå tydeligere som hovedbase for content workspace, settings-governance og management-read, mens operativ runtime fortsatt eier auth, ordre, billing og immutable hendelser.
- Domener som nå snakker eksplisitt med CMS-kontrollplanet i U38 er content pages, document types, data types, property-editor-governance, create-policy/management navigation, global settings control, publishing og ESG/system-read.
- Ukemeny/ukeplan er fortsatt ærlig modellert:
  - Operativ uke/meny styres fortsatt via eksisterende CMS-governance/readiness.
  - Selve publiseringskjeden går fortsatt via den publiserte kilden runtime leser.
  - `weekPlan` ble ikke gjort til ny ordretruth.
- Sections / trees / workspaces er fortsatt modellert via `backofficeExtensionRegistry` og Bellissima-lignende workspace-modell, men settings-visningene er nå eksplisitt avledet fra samme collection-register i stedet for en separat tab-definisjon.
- Workspace context fungerer nå tydeligere som den synlige sannhetslinjen fordi entity actions, footer shortcut og governance links tar utgangspunkt i samme snapshot-modell.
- Workspace views / actions / footer apps fungerer mer koherent fordi `management`, `schema` og `governance` nå er eksplisitte primitives i `backofficeWorkspaceContextModel`.
- Settings fungerer mer som seksjon enn forklaring fordi document type- og data type-workspaces viser styringsflyt og objektforhold, ikke bare tabeller med read-model data.
- Document types og data types fungerer nå tydeligere som management objects i UI, selv om de fortsatt ærlig er code-governed der persisted CRUD ikke finnes.
- Property editor-systemet er gjort eksplisitt gjennom en kanonisk modell for `schema -> configured instance -> UI -> preset/defaults`, brukt både i settings og i content workspace-governance.
- Følgende compat-lag er fjernet eller nøytralisert:
  - montert `BlockAddModal`-sti i den kanoniske workspace-stacken
  - `addBlockModalOpen`-state- og prop-kjeden
  - `_stubs.ts`-eksporten for `BlockAddModal`
  - separat settings-tab truth utenfor registry
- Følgende runtime truth-feil er lukket:
  - blocks-only PATCH som kunne miste eksisterende envelope metadata
  - publish-payload som var unødig nestet
  - `POST /api/content/global/settings` uten streng superadmin-gating
  - manglende `x-rid` på public global settings-read
  - `getSettings()` som kunne returnere `null` i stedet for fail-closed snapshot
  - ESG latest-monthly som ikke skilte tydelig nok mellom legacy drift og faktisk query-feil
- Skjermbevis som skulle støtte parity-påstanden er definert og mappet, men er fortsatt ikke samlet fordi lokal superadmin-innlogging mangler. Derfor er parity-påstanden fortsatt betinget.

## 3. Hva som fortsatt er svakt

- `ContentWorkspace.tsx` er fortsatt større enn Bellissima-idealet og bærer fortsatt for mye komposisjonsansvar.
- Document types, data types og property-systemet er fortsatt hovedsakelig styrt fra kode, ikke persisted object lifecycle.
- Full collection/bulk/entity-action-paritet på tvers av alle management-surfaces er ikke lukket.
- Screen proof mangler, og uten det er “near-Umbraco-17 parity” ikke bevist visuelt.
- Moduler som fortsatt er `LIMITED` / `DRY_RUN` / `STUB` / `INTERNAL_ONLY` ifølge kanonisk posture:
  - `weekplan_editorial` — `LIMITED`
  - `social_calendar` — `LIMITED`
  - `social_publish` — `DRY_RUN`
  - `seo_growth` — `LIMITED`
  - `esg` — `LIMITED`
  - `worker_jobs` — `STUB`
  - `cron_growth_esg` — `INTERNAL_ONLY`

## 4. Hvor nær systemet er Umbraco 17-/verdensklasse-nivå

- Systemet er nå tydeligere `CMS-led and enterprise-coherent` enn før U38.
- Det er ærlig å si at Bellissima-retningen er styrket merkbart i editor, settings og management-flow.
- Det er ikke ærlig å gi ubetinget “near-Umbraco-17 parity” før skjermbevis finnes og før editorhosten er ytterligere strammet ned.

## 5. Hva som må lukkes før ubetinget enterprise-live-ready

- Skaff gyldig superadmin-session og lever komplett skjermbevis for alle krevde ruter/stater.
- Fortsett å redusere komposisjonsansvaret i `ContentWorkspace.tsx`.
- Lukk de siste ujevne entity-action/collection-mønstrene der settings, discovery og workspace fortsatt ikke er helt like.

## 6. Hva som kan vente til senere

- Persisted CRUD/lifecycle for type-systemet dersom plattformen faktisk skal påstå slike management-objekter.
- Dypere Bellissima-paritet for bulk actions, discovery og footer-app-økosystemet.
- Videre operasjonalisering av moduler som fortsatt ærlig står som `LIMITED`, `DRY_RUN`, `STUB` eller `INTERNAL_ONLY`.
