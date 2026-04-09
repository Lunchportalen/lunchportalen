# U30X-READ-R3 — Workspace context proof

## Spørsmål og svar (kodebasert)

### Hva er Lunchportalens faktiske workspace-context?

1. **Type-nivå modell:** `lib/cms/backofficeWorkspaceContextModel.ts` definerer `BackofficeWorkspaceSession` (extensionId, workspaceId, collectionKey, lifecycle, runtimeLinked).  
2. **Runtime UI:** `components/backoffice/BackofficeExtensionContextStrip.tsx` utleder `findBackofficeExtensionForPathname(pathname)` og viser seksjon, `MODULE_LIVE_POSTURE_REGISTRY`, og `controlPlaneDomainActionSurfaces`.  
3. **Innholdseditor:** `ContentWorkspace.tsx` holder **lokal React state** og mange hooks — **ikke** en enkelt `WorkspaceContext` provider for editor-feltene.

### Finnes workspace context i kode?

- **Ja, delvis:** strip + typer.  
- **Nei, for editor data:** filen `backofficeWorkspaceContextModel.ts` sier eksplisitt (kommentar linje 2–3): *«fortsatt ingen global React Context»*.

### Props vs global state?

- **Props** og **hooks** dominerer (`useContentWorkspaceShell`, `useContentWorkspacePresentationState`, …).  
- **MainViewProvider** (`ContentWorkspaceLayout`) gir sidebar overlay — begrenset «global» scope.

### Er state delt eller tilfeldig?

- Delt innen én `ContentWorkspace` mount; **ikke** automatisk isolert på tvers av parallelle workspace-instanser (ingen Umbraco-lignende multi-editor host).

### Workspace-uavhengighet — hvor brytes den?

- **URL vs tree selection:** `ContentWorkspaceLayout` velger mellom `children` og `ContentEditor` basert på `selectedNodeId` — risiko for avvik mellom deep link og tree-valg (se egen render-chain-rapport).

## Klassifisering

| Aspekt | Parity class | Begrunnelse |
|--------|--------------|-------------|
| Kontekst-strip (section/posture) | **UX_PARITY_ONLY** | Ligner Bellissima «hvor er jeg» |
| Typed session model uten runtime enforcement | **PARTIAL** | Typer uten isolert container |
| Editor state | **STRUCTURAL_GAP** | Mangler Bellissima workspace context host |
| Dokumentasjon som sier «parity» uten React Context | **DOC_DRIFT** risiko | Avhenger av om eldre docs hevder full context — verifiser mot `backofficeWorkspaceContextModel.ts` |

**Sluttdom:** **STRUCTURAL_GAP** for ekte Umbraco 17 **workspace context**; **UX_PARITY_ONLY** for visuell/IA kontekst.
