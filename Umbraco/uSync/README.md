# uSync — repo-first schema and phase-1 content



## Ownership



| Concern | Source of truth in git | Applied at runtime |

|--------|-------------------------|---------------------|

| **Schema** (document types, element types, compositions, data types, block list config) | `uSync/v17/**` | `uSync:Settings:ImportAtStartup` = `All` in `appsettings.json` |

| **Phase-1 marketing pages** (`home`, `phase1-demo`) | `uSync/v17/Content/*.config` | Same uSync import |

| **Content fallback / repair** | `MarketingPhase1/MarketingPhase1StartupHandler.cs` | Runs after import: creates pages only if missing; fills empty `home` `bodyBlocks` when safe |



Backoffice UI is for **verification and later edits**, not for defining the initial phase-1 model.



## Clean database



1. Clone the repo (includes `uSync/v17`).

2. Start the Umbraco site: uSync imports schema + content from disk.

3. No manual creation of `marketingPage`, `lpHero`, `lpRichText`, or the two pages is required for a first run.

## Canonical content model

See `docs/umbraco/CANONICAL_CONTENT_MODEL.md` for document types (`homePage`, `contentPage`, `contactPage`, `legalPage`, `landingPage`, …), block catalogue, and boundaries (Umbraco public vs Sanity week vs Supabase ops).



If you previously created **duplicate** types or nodes with different keys (proof-of-concept), remove them or reset the SQLite DB once so imports match repo keys (`MarketingPhase1Guids` in `MarketingPhase1Guids.cs`).



## Updating schema or seed content



1. Change the relevant files under `uSync/v17/` (or export from a dev site **intentionally** and commit the diff).

2. Keep `ExportAtStartup` as `None` in committed `appsettings.json` so a running site does not overwrite git with ad-hoc DB state.



## Keys



Marketing document type, data types, and content node keys align with `Umbraco/MarketingPhase1/MarketingPhase1Guids.cs` so Delivery, Next adapter, and uSync stay consistent.


