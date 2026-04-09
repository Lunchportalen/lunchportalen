# CP9 — Publish / history / rollback contract

## Save

- **Postgres sider:** lagring i workspace (eksisterende mønstre).
- **Sanity:** Studio-lagre utkast; broker publiserer `menuContent` draft→published.

## Preview

- **Sider:** preview routes i content workspace.
- **Meny:** kundesynlig filter i GROQ — samme forståelse som publisert for ansatt.

## Publish

- **Sider:** workflow publish.
- **Meny:** Studio eller CP7 API — **én** Sanity-kilde.

## Governance / schedule

- Content workflow + cron i drift — **ikke** én Umbraco Scheduler-UI.

## History / rollback

| Område | Full paritet | Simulert |
|--------|--------------|----------|
| Postgres sider | Recovery der implementert | — |
| Sanity meny | Studio history | Ikke innebygd i LP |
| **Fortelling** | Vis hvor historikk lever | — |

## CP9 bygger

- **Klarhet** i docs; **ikke** falsk unified history-UI.
