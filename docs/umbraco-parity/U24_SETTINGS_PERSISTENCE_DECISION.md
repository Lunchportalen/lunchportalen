# U24 — Settings persistence beslutning

## Beslutning

- **Kanonisk sannhet** for document type + block allowlist: **`lib/cms/contentDocumentTypes.ts`** (kode, git-persistert).
- **Ingen** ny SQL-tabell for type-CRUD i U24 — unngår dobbel sannhet og uklar migrasjon.
- **`system_settings`** brukes fortsatt kun til **operativ** systempolicy (U23), ikke CMS type-editor.

## UI-ærlighet

- Settings-schemaflate viser **allowedBlockTypes** fra registry (lesbar kontrollplan).
- Hvis produktet senere innfører DB-styrte typer, kreves eksplisitt migrasjonsløp — **ikke** i U24.
