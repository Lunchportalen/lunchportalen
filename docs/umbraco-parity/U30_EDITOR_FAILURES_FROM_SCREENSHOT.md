# U30 — Editor failures (screenshot baseline)

**Kilde:** Brief U30 + tilstand før U30 (ingen bilde i repo). Oppdater med piksel-bevis når skjermdump finnes.

## UX-feil (konkrete)

| Kategori | Observasjon | U30-tiltak |
|----------|-------------|------------|
| IA | Global seksjon, workspace og kontekst flyter sammen | Tydeligere soner (tree / editor+preview / inspector); færre dupliserte statusrader |
| Layout | Mange nestede rammer («boks-i-boks») | Flatere hovedflate, mindre border-støy i midtkolonne |
| Preview | For smal sekundær kolonne | Økt grid-andel til preview; roligere kant |
| Inspector | Én lang vegg, blandet innhold | Seksjonstittel + gruppering (innholdsapper allerede løftet i U29R; fortsett) |
| Action hierarchy | Publiser vs lagre vs status spredd | Primærhandlinger samlet i topp; redusere mikrobadges i editor-stripe |
| Context apps | «Egenskaper» vs faner uklart | Behold eksplisitt «Innholdsapper» + høyre content-app-faner |

## Umbraco 17-gap

- Bellissima forventer forutsigbar workspace-sone og én tydelig status-sannhet — duplikat status i topp + editor-stripe bryter dette.

## Må fikses i kode (U30)

1. Redusere duplikat status i `ContentWorkspaceEditorModeStrip` når `ContentTopbar` allerede viser utkast/publisert og sync.
2. Øke tree- og preview-bredde i shell-grid.
3. Audit-panel skal ikke feile hardt når Postgres-tabell mangler (se runtime-doc).
