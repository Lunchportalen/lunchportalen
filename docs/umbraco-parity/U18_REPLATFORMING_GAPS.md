# U18 — Replatforming gaps

**Se også:** `U17_REPLATFORMING_GAPS.md`, `U17_DEEP_GAP_MAP.md`.

## U18-spesifikke gap

| Krav | Realistisk på Next.js |
|------|------------------------|
| Global indeksert søk som Umbraco | Krever **søkeprodukt** eller akseptert palett-scope |
| Én historikkmotor på tvers av Postgres+Sanity+uke | **Aggregator-tjeneste** eller produktvalg |
| AI-modellvelger UI som sky | **Egen fase** — ikke U18 |

## Simuleres nå

- **Discovery** — alias + tårn i palett + historikk punktliste.
- **Governance** — full modulposture-tabell på AI Center.

## UX-paritet uten teknisk kloning

- Umbraco **Content Delivery API** — LP bruker `lib/cms/public/**` og egne API-ruter.
