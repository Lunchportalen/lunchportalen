# U18 — Unified history model

## Kilder i dag (uendret teknisk)

| Kilde | Domene | Historikk/versjon |
|-------|--------|-------------------|
| Postgres | Innholdssider | Content workspace, recovery |
| Sanity | Menydokumenter | Studio |
| Uke/meny | Operativ + weekPlan | Uke & meny-side |

## «Unified» = narrativ, ikke motor

- U18 **forsterker** én **lesbar** fortelling i `CmsHistoryDiscoveryStrip`, med punktliste og eksplisitt: **ingen én felles tidslinje-API**.
- **Rollback:** forklart som **domeneavhengig** — ikke global undo.

## Delvis historikk

- **Social** ekstern publish — DRY_RUN mulig; historikk i policy/engine, ikke «ferdig» CMS-historikk.

## Kan bygges senere (uten falsk motor)

- Valgfri **read-only** side som lenker til eksisterende spor — fortsatt ikke én DB.
