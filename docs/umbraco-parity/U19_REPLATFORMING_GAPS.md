# U19 — Replatforming gaps

**Se også:** `U18_REPLATFORMING_GAPS.md`, `U17_REPLATFORMING_GAPS.md`.

## U19-spesifikt

| Krav | Gap |
|------|-----|
| Enterprise fulltext (Elasticsearch) | Krever **produkt** + infra |
| Én skrivebeskyttet global audit-bus | Krever **aggregator** eller event store |
| Live AI kost-dashboard med metering | Krever **billing/usage** API |

## Simuleres nå

- Indeksert **rankering** på manifest-blob.
- **Visuell** tre-spors tidslinje.
- **Governance-tekst** for AI uten nye backend-kontrakter.
