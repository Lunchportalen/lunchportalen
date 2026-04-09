# U31 — Bellissima target model (operativ)

## Sections / registry
- **Source:** `lib/cms/backofficeExtensionRegistry.ts` — single manifest (sections = `BackofficeNavGroupId`, entries = workspaces/surfaces/tools).
- **U31:** TopBar shows **section `<select>`** + **module row with overflow** (not an endless pill strip).

## Tree / collection
- **Tree API:** `/api/backoffice/content/tree` — virtual roots + pages; schema hints when degradable.
- **UI:** `SectionShell` + `ContentTree` — tree is primary nav; empty/error states must be explicit.

## Workspace
- **Layout:** `ContentWorkspaceLayout` → tree | workspace + **footer apps** (`BackofficeWorkspaceFooterApps`).
- **Context:** `ContentBellissimaWorkspaceSnapshot` + `ContentBellissimaWorkspaceProvider` — single read surface for footer/tooling.

## Workspace views (“content apps”)
- **Pattern:** `BackofficeWorkspaceViewTabs` — route-based tabs (overview, growth, recycle-bin).

## Actions / footer apps / entity actions
- **Primary publish/save:** `ContentTopbar` / `ContentSaveBar`.
- **Footer:** status + governance links; audit degradation signal when API reports `degraded`.
- **Entity:** existing tree `NodeActionsMenu` + `backofficeEntityActionStyles` — no second mutation engine.

## Settings (first-class)
- **Hub + sidenav:** `SettingsSectionChrome` — section → workspace list; code-governed honesty.

## Done in U31 (this phase)
- Stronger structural clarity (overflow, wider tree/preview, calmer chrome).
- Snapshot extended with audit health metadata where safe.
- Documentation + verification artifacts.

## Deferred (explicit)
- Full Umbraco Management API parity, persisted datatype CRUD, unified global history DB — **REPLATFORMING_GAP** if required for 1:1 runtime identity.
