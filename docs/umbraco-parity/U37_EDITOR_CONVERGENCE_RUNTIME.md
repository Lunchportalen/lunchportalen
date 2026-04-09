# U37 Editor Convergence Runtime

## Landed Now
- Blokkdiscovery og blokkopprettelse går nå via én kanonisk katalog: `lib/cms/backofficeBlockCatalog.ts`.
- `BlockPickerOverlay`, modal-shell-props og `createBlock()` bruker samme katalog og samme default truth.
- Den gamle `blockRegistry.ts` er fjernet, så editoren har ikke lenger et parallelt block-registry ved siden av plugin-/catalog-truth.

## Bellissima-Positive Outcome
- Block add og block pick peker nå på samme type- og defaultmodell.
- Workspace-modaler og create-flow bruker samme `BackofficeBlockDefinition`, ikke lokale registry-typer.
- Editoren har mindre intern drift mellom discovery og create.

## Still Open
- `ContentWorkspace.tsx` er fortsatt for stor og bærer fortsatt mer orkestreringsansvar enn ekte Bellissima-workspace-host burde gjøre.
- `contentWorkspaceWorkspaceRootImports.ts` lever fortsatt som import-samlingslag. Det konkurrerer ikke om runtime truth nå, men bør fortsatt bort i en senere lukkerunde.
