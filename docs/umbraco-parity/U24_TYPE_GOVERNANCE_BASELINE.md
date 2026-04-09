# U24 — Type governance baseline

## I dag (før U24)

- **Document types**: `lib/cms/contentDocumentTypes.ts` — `page` med `allowedChildren`; U23 la til schema-UI uten **håndheving** av blokktyper.
- **Blokkliste**: `lib/cms/editorBlockCreateOptions.ts` — én kilde for modal + Settings; **ingen** per-dokumenttype-filter i save-path.
- **Body**: envelope (`documentType`, `fields`, `blocksBody`) eller flat `{ version, blocks }` — `parseBodyEnvelope` / `bodyParse`.
- **API**: `PATCH /api/backoffice/content/pages/[id]` persisterer body uten blokk-policy-sjekk.

## Nær Umbraco-paritet

- Én manifest/navigasjon (CP13), Settings-hub (U23), property dataset-forklaring (U22).

## Under paritet (U24 mål)

- **Serverforankret** block allowlist når `documentType` er satt i envelope.
- **Klient** som filtrerer «Legg til blokk» og blokkplukker i tråd med samme liste.
- **Ærlig persistence**: kanonisk registry i **kode** (git-persistert), ikke falsk DB-CRUD.

## Plattform-risiko

- Ukjent `documentType` i lagret innhold må **fail-closed** ved lagring.
- Legacy sider **uten** envelope skal ikke brytes (ingen dokumenttype → ingen allowlist-sjekk).

## U24 leveranse

- Utvidet `DocumentTypeEntry` med `allowedBlockTypes`.
- Validering i PATCH + UI-filter — **én sann modell** (`blockAllowlistGovernance`).
