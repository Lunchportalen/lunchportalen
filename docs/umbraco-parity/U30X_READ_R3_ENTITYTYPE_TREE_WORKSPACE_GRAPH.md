# U30X-READ-R3 — Entity type · tree · workspace graph

## Tree-noder (API)

Kilde: `app/api/backoffice/content/tree/route.ts`

- Virtuelle røtter: `home`, `overlays`, `global`, `design` (`VIRTUAL_ROOTS`).  
- Side-rader: `content_pages` med `tree_parent_id`, `tree_root_key`, `tree_sort_order`, `page_key`, `slug`, `title`.  
- `kind` settes fra `page_key` eller inferens (`pageToNode`).  
- `nodeType`: `folder` | `page` | `root`.  
- Faste app-flater (`employee_week`, `superadmin`, …) tvihnet under **Hjem** uavhengig av DB-plassering.

## Entity-lignende objekter

| Tree-konsept | DB / ID | Workspace-mål | «Entity type» kontrakt |
|--------------|---------|---------------|------------------------|
| Virtuell Hjem | `id: "home"` | `targetPageId` → forside-UUID | **IMPLISITT** — ikke Umbraco entity type |
| Side | UUID | `/backoffice/content/{uuid}` | **IMPLISITT** — `page_key`/`kind` som hint |
| Mappe | `overlays`, `global`, `design` | Kun expand; `FOLDER_IDS` i `ContentTree.tsx` | **folder-only** — eksplisitt i klient |

## Routing tree → workspace

- `ContentTree` `onSelectNode` → `setSelectedNodeId` → `ContentWorkspaceLayout` viser `ContentEditor` for valgt id.  
- Router.push brukes i tre ved navigasjon (se `ContentTree.tsx` for full flyt — fil lest delvis).

## Actions på entitet

- `permissionsForNode` i `ContentTree.tsx`: create/rename/move begrenset; **canDelete: false** (hardkodet linje 94 i utdrag).  
- Ikke Umbraco **entity action** manifest — **PARTIAL**.

## Hvor kjeden bryter Bellissima

1. **Ingen entity type ID** i API som første klasse — kun `kind` string.  
2. **Superadmin gate** på tree API — ikke rolle-modell som Umbraco backoffice.  
3. **Virtuelle mapper** er ikke lagret entiteter — **STRUCTURAL_GAP** for «content tree = persisted entity hierarchy».  
4. **Content landing** (`/backoffice/content`) er **GrowthDashboard**, ikke valgt node — **workspace entry** matcher ikke klassisk CMS tree→collection→editor flow (**UX_PARITY_ONLY** / **MISLEADING** IA).

**Parity-klasser:** tree **PARTIAL**; entity binding **STRUCTURAL_GAP**; actions **PARTIAL**.
