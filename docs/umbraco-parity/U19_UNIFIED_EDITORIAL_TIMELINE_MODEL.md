# U19 — Unified editorial timeline model

## Prinsipp

**Unified** = én **forståelse** og **visuell** tidslinje (tre spor), **ikke** én teknisk aggregert logg.

## Kilder (uendret)

| Spor | Teknisk historikk |
|------|-------------------|
| A · Postgres | Content workspace, `content_audit_log` ved relevante handlinger |
| B · Sanity | Studio document history |
| C · Uke/meny | Operativ vs redaksjonell forklaring i CMS |

## U19 UI

- Tre kort (grid) i `CmsHistoryDiscoveryStrip` — tydelig **Spor A/B/C**.
- Eksisterende punktliste beholdt for detaljer og rollback-ærlighet.

## Delvis / ærlig

- Full kronologisk merge av hendelser — **ikke** levert; ville kreve aggregator.
