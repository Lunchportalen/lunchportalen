# ESG — metode og tillit (Phase 2D3)

## UI-lag (synlig for bruker)

1. **Seksjon «Kilde og metode»** på `/backoffice/esg`:
   - Forklarer `esg_monthly_snapshots` / `esg_yearly_snapshots` vs `esg_monthly`.
   - Nevner cut-off for avbestilling (08:00 Europe/Oslo) på overordnet nivå.
2. **Tom data** — tydelig advarsel, ikke «grønn» tom tilstand.
3. **Narrativ** (`buildEsgNarrativeYear`) — vist som «Forklaring (snapshot-basert)»; avslutter med revisjonsvennlig setning der narrative allerede inneholder den.

## Ikke i denne leveransen

- Egendefinert revisjonsside eller PDF fra CMS (bruk superadmin).
- Automatisk e-post eller rapportering.
