# U28 — Property preset usage model

## Hva som finnes i dag

- **Kanonisk:** `contentDocumentTypes`, `editorBlockCreateOptions`, `blockFieldSchemas` — code registry.
- **Implicit presets:** default `documentType` ved opprettelse (`page`), default `blocksBody` tom struktur — i `POST /api/backoffice/content/pages` og editor state.

## Hva som ikke finnes som persisted Umbraco «Data Type»-instanser

- Egne rad-per-tenant preset-rader i DB for hver property — **ikke** bygget; unngår dobbel sannhet.

## U28 UX-paritet uten property engine

- Governance-insights viser **blokktype-frekvens** og **dokumenttype-frekvens** — proxy for «hva brukes».
- Settings schema-side forklarer at presets er code-governed.

## Må vente

- Egen preset-editor — REPLATFORMING_GAP eller egen stor fase.
