# U23 — Document type runtime

## Oppførsel

- Register: `lib/cms/contentDocumentTypes.ts` — `page` med `allowedChildren: ["page"]`.
- Create panel: uendret logikk; `getDocType` importeres via app re-export.
- Hub + schema-side dokumenterer alias/barn for forvaltere.

## Begrensning

- Utvidelse av flere dokumenttyper krever produktbeslutning og ev. API — ikke automatisk i U23.
