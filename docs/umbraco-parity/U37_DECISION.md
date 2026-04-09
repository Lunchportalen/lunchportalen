# U37 Decision

## 1. Endelig beslutning
- `GO WITH CONDITIONS`

## 2. Hva som er oppnådd
- CMS fungerer nå tydeligere som synlig control plane for content, settings og management-read, mens operativ runtime fortsatt eier auth, ordre, billing og immutable hendelser.
- Domener som nå snakker eksplisitt med CMS-kontrollplanet i U37 er innholdstre, publishing/audit, settings/system, ESG latest-monthly, document/data type-governance, create policy og AI governance.
- Ukemeny/ukeplan er fortsatt ærlig splittet:
  - Operativ uke/meny styres gjennom CMS-governance/backoffice-readiness.
  - Selve publiseringskjeden går fortsatt via Sanity Studio på samme publiserte kilde som runtime leser.
  - `weekPlan` forblir editorial-only og ble ikke gjort til ordretruth.
- Sections, trees og workspaces er fortsatt modellert via `backofficeExtensionRegistry` + Bellissima-lignende workspace-modell, ikke via parallelle nav-/manifeststrukturer.
- Workspace context fungerer nå bedre som kanonisk snapshot for views, actions, history-status og footer/statusflater, men den store editorhosten er fortsatt for tung.
- Workspace views / actions / footer apps lever videre på Bellissima-modellen, med styrket runtime-truth rundt publish, audit og degraded history.
- Settings fungerer tydeligere som seksjon fordi `system` nå er `runtime_managed`, og fordi settings-API/UI deler samme baseline-truth.
- Document types, data types og property editor-systemet er eksplisitte management-objekter i UI, men fortsatt ærlig code-governed/read-only der persisted CRUD ikke finnes.
- Følgende compat-lag ble faktisk slått ned eller nøytralisert:
  - `blockRegistry.ts` fjernet.
  - `createBlock()` flyttet over på kanonisk katalogtruth.
  - modal-stack/modal-shell bruker katalogtypene direkte.
- Følgende runtime-truth-feil er lukket:
  - publish-route vs audit-action constraint
  - `system_settings` baseline-truth
  - `esg_monthly` legacy-column drift
  - tree/audit degraded operator payloads

## 3. Hva som fortsatt er svakt
- `ContentWorkspace.tsx` er fortsatt for stor og for lite Bellissima-ren som host/orchestrator.
- `contentWorkspaceWorkspaceRootImports.ts` finnes fortsatt som restlag, selv om den ikke lenger eier runtime truth.
- Document types, data types og property-systemet mangler fortsatt persisted object lifecycle og ekte CRUD-paritet.
- Entity actions / collections / bulk actions er fortsatt ikke helt like konsistente som Umbraco 17.
- Moduler som fortsatt ikke er bredt live ifølge kanonisk posture:
  - `weekplan_editorial` — `LIMITED`
  - `social_calendar` — `LIMITED`
  - `social_publish` — `DRY_RUN`
  - `seo_growth` — `LIMITED`
  - `esg` — `LIMITED`
  - `worker_jobs` — `STUB`
  - `cron_growth_esg` — `INTERNAL_ONLY`

## 4. Hvor nær systemet er Umbraco 17 / verdensklasse-nivå
- Systemet er nå `CMS-led and enterprise-coherent`.
- Det er ikke ærlig å kalle dette `near-Umbraco-17 parity` ennå, fordi editorhosten fortsatt er for stor, management-objektene er fortsatt primært read-governed, og full action/collection-paritet ikke er lukket.

## 5. Hva som må lukkes før ubetinget enterprise-live-ready
- Splitt `ContentWorkspace.tsx` videre til en tydeligere workspace-host uten rest-orchestrator.
- Fjern `contentWorkspaceWorkspaceRootImports.ts` og andre resterende import-/assembly-lag som fortsatt skjuler eierskap.
- Løft document types / data types / property editor-presetter videre fra lesemodeller til tydeligere object lifecycle dersom persisted backend skal påstås.
- Stram entity actions og collection parity videre slik at tree, discovery, settings og workspace headers oppfører seg likere.

## 6. Hva som kan vente til senere
- Full persisted CRUD for type-systemet.
- Dypere Bellissima-paritet i discovery/bulk actions/footer apps.
- Ytterligere performance- og build-tidsoptimalisering så lenge gatekjeden forblir grønn og deterministisk.
