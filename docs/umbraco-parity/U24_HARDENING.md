# U24 — Hardening

- **Fail-closed**: ukjent `documentType` i envelope → 422 ved lagring.
- **Ingen** skjult bypass i UI uten tilsvarende server-sjekk for mutasjon via PATCH.
- **Konsolidert ekstraksjon**: `extractBlocksSource` i `lib/cms/extractBlocksSource.ts` — én implementasjon for parse + allowlist.
