# U23 — Verifikasjon

## Kommandoer (skal kjøres ved leveranse)

```bash
npm run typecheck
npm run build:enterprise
npm run test:run
```

**Resultat (lokal kjøring):** alle tre fullført med exit code 0; `test:run`: 226 testfiler, 1241 tester passert.

## Tester berørt

- `tests/backoffice/documentTypes.test.ts` — import fra `lib/cms/contentDocumentTypes`.
- `tests/cms/backofficeSchemaSettingsModel.test.ts` — ny.

## Fokusgrupper (manuell regresjon)

- **CMS/backoffice**: Naviger Settings hub → schema → create-options → system; TopBar aktiv tilstand for `/backoffice/settings/*`.
- **Content**: Opprett panel + Legg til blokk (liste uendret innhold, én kilde).
- **Auth**: Ingen endring av guards i U23.

*(Sanity:live kun hvis organisasjonsgate krever det.)*
