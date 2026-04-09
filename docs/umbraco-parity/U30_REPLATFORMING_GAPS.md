# U30 — Replatforming gaps

| Område | Full paritet krever | U30 |
|--------|---------------------|-----|
| Historikk | Sideversjoner vs Postgres audit er forskjellige spor | Audit gjøres robust; versions UI uendret |
| Roller | Tree API superadmin-only | Dokumentert; ikke endret til company_admin (runtime boundary) |
| Egenskapsmotor | Ekte property presets CRUD | Ikke i scope — fortsatt code-governed |

## Ærlig begrensning

- Uten bredere rollepolicy for CMS kan ikke «alle redaktører» få tree — det er produkt-/sikkerhetsbeslutning utenfor U30 UI-lag.
