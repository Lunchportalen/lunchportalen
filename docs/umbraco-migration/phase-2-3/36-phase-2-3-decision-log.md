# Phase 2–3 decision log

| ID | Decision | Status | Owner | Rationale | Dependency | Affects phase | Blocker? |
|----|----------|--------|-------|-----------|------------|---------------|----------|
| D01 | Public website pages map to **`webPage`** + **`webPageHome`** | **Accepted** | Architecture | Matches current `page` document alias | None | 2,3 | No |
| D02 | Core blocks map 1:1 to **Element Types** (with child elements for nested rows) | **Accepted** | Architecture | No JSON blob authority | ETL | 2,4 | No |
| D03 | SEO from `body.meta` → **page variant properties** | **Accepted** | SEO lead | Matches `cmsPageMetadata` | None | 2,4 | No |
| D04 | **Umbraco Workflow** on all in-scope editorial docs | **Accepted** | Editorial + Security | Program lock | Cloud license/setup | 3,4 | Yes if missing |
| D05 | **Stock** Block List/Grid; no custom Section for marketing | **Accepted** | Architecture | Anti-bloat | None | 3 | No |
| D06 | **Optional merge** of hero variants deferred — **separate** Element Types at migration | **Accepted** | UX | Lower migration risk | None | 2 | No |
| D07 | **`diagnostics`** meta **not** migrated | **Accepted** | Engineering | Not editorial | None | 2,4 | No |
| D08 | Plugin block catalog requires **inventory** before ETL | **Open** | Tech lead | Unknown persisted types | Content audit | 2,4 | Yes until done |
| D09 | **`appShellPage` / overlays** Umbraco vs app-owned | **Open** | Product | Scope ambiguity | Sign-off | 2,3 | Yes until signed |
| D10 | Public **`en`** culture live vs future-only | **Open** | Product | Code vs public routes mismatch | Locale policy | 2,4 | Yes until signed |
| D11 | Redirects: **Umbraco** vs **infra-only** | **Open** | Ops | Volume unknown | Runbook | 4 | No for Phase 3 |
