# U20 — Workspace actions and content apps map

## Workspaces (utvalg)

| Rute | Header / shell | Primær handling |
|------|----------------|-----------------|
| `/backoffice/content` | Content workspace | Rediger / publish via eksisterende flyt |
| `/backoffice/media` | `BackofficeWorkspaceHeader` | Bibliotek, alt, opplasting |
| `/backoffice/domains` | Workspace surface | Domenekonfigurasjon |
| `/backoffice/week-menu` | Workspace | Uke/meny governance narrative |
| `/backoffice/seo-growth` | Workspace | SEO |
| `/backoffice/social` | Workspace | Social |
| `/backoffice/esg` | Workspace | ESG |
| `/backoffice/ai-control` | PageContainer | AI governance |

## Konsistente mønstre

- **Max bredde 1440px** der `PageContainer` brukes.
- **Historikk-strip** global i layout — ærlig om kilder.

## Fortsatt ujevnt (adressert i U20 docs, minimal kode)

- Noen flater har mer **panel-dominans** enn andre — full harmonisering er egen runde; U20 legger **discovery + audit feed + AI status** uten ny shell.

## U20 standardisering

- Palett: **samme** hurtignavigasjon + **entitetstreff** ved søk.
- AI: **samme** statuskort fra `/api/backoffice/ai/status`.
