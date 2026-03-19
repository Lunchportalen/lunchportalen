# Content tree – sannhet (fasit)

**Innholdstreet er persistert navigasjon med flytt/rekkefølge. Hierarki og rekkefølge lagres i content_pages (tree_parent_id, tree_root_key, tree_sort_order).**

## 1. Hva tree ER

- **Navigasjon:** Liste til venstre i backoffice content som viser Hjem, App overlays, Global, Design og tilknyttede sider. Klikk åpner siden i editoren.
- **Persistert:** Strukturen hentes fra `GET /api/backoffice/content/tree` som bygger tre fra `content_pages` (tree_parent_id, tree_root_key, tree_sort_order). Flytt og rekkefølge lagres via `POST /api/backoffice/content/tree/move`.
- **Virtual roots:** Hjem, App overlays, Global, Design er virtuelle rotter (ingen egne rader); kun content_pages-rader plasseres under dem.
- **Move:** Dokumentnoder (ikke virtuelle røtter) kan flyttes til en annen rot og rekkefølge via kontekstmeny → Flytt. Opprett/omdøp/slett gjøres i editoren, ikke i treet.

## 2. Hva tree IKKE ER

- **Ikke site map:** Tree er ikke autoritativ navigasjonsstruktur for nettstedet; det er en backoffice-navigasjonsvisning.
- **Ikke Recycle Bin:** «Recycle Bin»-node finnes ikke; ingen ekte soft-delete fra treet.

## 3. Implementasjon i kode

- **ContentTree.tsx:** Henter tre fra `GET /api/backoffice/content/tree`. Viser kun persistert data; ingen mock-fallback ved feil (tomt tre + feilmelding). `permissionsForNode` gir `canMove: true` for dokumentnoder. Flytt-modal: velg rot og rekkefølge, deretter POST til tree/move og refetch.
- **NodeActionsMenu.tsx:** Viser kun støttede handlinger: «Kopier lenke», «Forhåndsvis», og «Flytt» når `canMove` er true. Ingen «Opprett under», «Omdøp» eller «Slett» i treet (disse finnes kun i editoren).
- **treeMock.ts:** `getMockRoots` brukes ikke lenger av ContentTree; `flattenVisible` og `findNode` brukes fortsatt som rene hjelpere.
- **API:** `app/api/backoffice/content/tree/route.ts` (GET), `app/api/backoffice/content/tree/move/route.ts` (POST). Begge krever superadmin.

## 4. For redaktører

- Bruk treet til å **navigere**, **flytte** sider (rot + rekkefølge), **kopiere lenke** og **forhåndsvis**.
- Opprett nye sider, endre tittel/slug og slett via editoren (ContentWorkspace / listepanel).

## 5. Database

- **content_pages:** Kolonnene `tree_parent_id`, `tree_root_key`, `tree_sort_order`. Placement: enten (tree_parent_id null og tree_root_key satt) eller (tree_parent_id satt og tree_root_key null). Constraint: `content_pages_tree_placement_check`. **Hver insert må sette placement** (f.eks. tree_root_key + tree_sort_order for rot-nivå). Migrering: `20260320000000_content_tree_persistence.sql`.
