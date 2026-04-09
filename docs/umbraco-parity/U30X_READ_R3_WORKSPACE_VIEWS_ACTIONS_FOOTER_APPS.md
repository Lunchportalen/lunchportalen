# U30X-READ-R3 — Workspace views, actions, footer apps

## Workspace views / content apps (Bellissima-lignende)

| LP-konstruksjon | Filer | Faktisk rolle | Parity |
|-----------------|-------|---------------|--------|
| `mainView` + global/design underpaneler | `useContentWorkspaceShell`, `ContentWorkspaceDesignTailShell.tsx`, `ContentWorkspaceGlobalMainViewShell.tsx` | Bytter «hovedflate» for design/global | **UX_PARITY_ONLY** |
| Editor mode strip | `ContentWorkspaceEditorModeStrip.tsx` | Modus/indikatorer | **UX_PARITY_ONLY** |
| Copilot / enterprise paneler | `EditorCopilotRail.tsx`, `EditorEnterpriseInsightsPanel.tsx`, … | Sekundære paneler | **PARTIAL** — ikke registrerte content apps |
| Historikk preview | `historyVersionPreview` state i `ContentWorkspace.tsx` | Read-only preview av versjon | **PARTIAL** |

**Konklusjon:** Ingen **manifest-registrerte workspace views** som i Umbraco — **STRUCTURAL_GAP**.

## Workspace actions

| Område | Filer | Atferd |
|--------|-------|--------|
| Lagre / publish | `ContentSaveBar.tsx`, workflow routes | HTTP mot `/api/backoffice/content/pages/...` |
| `ContentWorkspaceActions.ts` | Eksplisitt fil | Handlings-set for workspace |
| AI generate/apply | Modaler + hooks | Bruker godkjenner/confirm i noen flyter — se AI-rapport |

**Konklusjon:** Handlinger er **React-knapper og callbacks**, ikke Umbraco **workspace action** extension points — **STRUCTURAL_GAP**.

## Footer apps

- **Grep:** `workspaceFooterApp` — **0 treff** i TypeScript/TSX.  
- **Konklusjon:** **STRUCTURAL_GAP** (konseptet er ikke implementert som egen lag).

## Hva ligger «feil» (relativt til Bellissima)?

- **Primære handlinger** i topbar/save bar i stedet for footer-primary — **UX_PARITY_ONLY** (kan ligne bruker forventning, men ikke samme arkitektur).  
- **Entity-level actions** (delete, publish, …) er spredt; tree har **canDelete: false** for sider i `permissionsForNode` utdrag — begrensning som ikke matcher rik entity action-modell.

## Hvorfor det ikke føles som Umbraco 17

1. Ingen **footer app** row.  
2. Ingen **workspace view** picker fra manifest.  
3. **Context strip** er read-only metadata — ikke samme som editor workspace state.  
4. **Content section default page** er growth dashboard — ikke editor-first (**IA-brudd**).

**Samlet parity:** **PARTIAL** på funksjonalitet; **STRUCTURAL_GAP** på Bellissima-modell.
