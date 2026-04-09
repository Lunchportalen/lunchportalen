# U17 — History / governance / rollback parity

**Arbeidsstrøm 6** — mål: Umbraco-lignende *fortelling* om tilstand uten falsk én motor.

## Hva som finnes

- **Innhold (Postgres API):** versjoner/workflow der implementert — se content API routes.
- **Sanity:** Studio history — utenfor LP om ikke eksponert.
- **Strip:** `CmsHistoryDiscoveryStrip` — forklarer **hvor** historikk lever.

## Regler

- **Ikke lat som** én global tidslinje når kildene er flere.
- **Rollback:** kun der faktisk støttet — ellers eksplisitt tekst i UI (CP11 beslutning).

## Referanse

- `CP12_UNIFIED_HISTORY_CONTRACT.md`, `CP12_PUBLISH_HISTORY_RUNTIME.md`, `CP11_PUBLISH_HISTORY_ROLLBACK_DECISION.md`
