# ESG — innsikt som støttes (Phase 2D3)

## Vises som fakta (når DB-rader finnes)

- **Bestillinger, avbestilling i tide** — fra `esg_monthly_snapshots` / `esg_yearly_snapshots` (`ordered_count`, `cancelled_in_time_count`).
- **Sparte kostnader, svinn kg, CO₂e, netto** — samme snapshots (`cost_*`, `waste_kg`, `waste_co2e_kg`).
- **Stabilitet** — `stability_score` (A–D) som i DB.
- **Månedlig trend** — 12 måneder i tabell.

## Merking: målt / estimert / mangler

| Område | Merking i UI |
|--------|----------------|
| Snapshot-tabell | «Kilde: DB» — tallene er lagrede snapshots |
| CO₂e i årsoppsummering | «(est. fra snapshot)» — følger beregningskjeden i RPC, ikke feltmåling |
| Rulleringsliste (`esg_monthly`) | Tekst: «Svinn (est.)» — aggregat/estimat |
| Ingen rader i perioden | Banner: «Ikke nok data» — **ikke** tolket som positivt utfall |

## Ikke vist som fakta

- Bransjebenchmark uten at bruker åpner dedikert superadmin-funksjon.
- Sammenligning år-over-år i narrativ når **forrige år** ikke er lastet (narrative bruker `previous: null` i CMS).
