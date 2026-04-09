# U23 — Settings og schema baseline

## Hva som finnes i dag (kode som sannhet)

### Backoffice «Settings»-flate
- **TopBar**: `nav.settings` → `/backoffice/settings` (`lib/cms/backofficeExtensionRegistry.ts`), gruppe **system**.
- **`app/(backoffice)/backoffice/settings/page.tsx`**: **Systeminnstillinger** — globale toggles, killswitch, retensjon via `GET /api/backoffice/settings` og `PUT /api/superadmin/system`. Dette er **runtime/system policy**, ikke Umbraco document/data types.

### Schema-lignende lag (implisitt i kode, ikke egen Settings-IA)
- **Document types**: `app/.../content/_components/documentTypes.ts` — én type `page` med `allowedChildren: ["page"]`; `getDocType()` brukes i create panel og properties rail.
- **Blokktyper / «components»**: `lib/cms/blocks/registryManifest.ts`, `componentGroups.ts`, `BlockAddModal.tsx` (hardkodet liste med beskrivelser), `blockFieldSchemas.ts` (**EditorBlockFieldSchema** = schema-lag).
- **Design / card presets**: `lib/cms/design/designContract.ts`, presets i kode — ikke egen data-type-database.
- **Extension registry**: `backofficeExtensionRegistry.ts` — seksjoner og workspaces (CP13), ikke Umbraco Management API.

### Allerede nær Umbraco 17-paritet
- Én manifest-lignende **extension registry** for navigasjon og palett.
- **Tre-lags forklaring** for blokker (U22): schema / configured instance / UI (`PropertyDatasetExplainer` + `blockFieldSchemas`).
- **Create panel** med valg av dokumenttype-alias og **allowedChildTypes** fra tre/forelder (workspace).

### Under paritet (før U23)
- Ingen **dedikert Settings-seksjon** som skiller **systemdrift** fra **innholdsskjema / document & data types**.
- Document type-register er **minimalt** (kun `page`).
- Data types er **spredt** (felt-typer i `blockFieldSchemas`, blokkliste i `BlockAddModal`, registry keys i `registryManifest`) uten én lesbar governance-flate.
- **Content type filters** er i stor grad **implisitte** (API + `allowedChildTypes`, envelope `documentType`) uten redaktørvennlig oppsummering.

### Åpne plattform-risikoer
- Full Umbraco **Management API** / persisted document type & data type **database** krever replatforming — se `U23_REPLATFORMING_GAPS.md`.
- Endringer i **system_settings** påvirker hele plattformen; må holdes skilt fra CMS-skjema i IA.

### Hva U23 skal levere (mønster, ikke ny motor)
- Tydelig **Settings-hub** med underflater: **System** (eksisterende) + **Schema** (lesing/governance) + **Opprettelse / filtre** (forklaring + kobling til eksisterende flyt).
- Ingen ny settings-plattform; **én navigasjonsstruktur** koblet til eksisterende filer og API-er.
