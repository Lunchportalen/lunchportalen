# CP11 — Unified workspace model

**Dato:** 2026-03-29

## Workspaces i dag (kart)

| Område | Rute | Karakter |
|--------|------|----------|
| Content | `/backoffice/content` | Egen workspace (tre + editor) |
| Media | `/backoffice/media` | Klient-side bibliotek |
| Domener | `/backoffice/domains` | Server, kort + tabeller |
| Kunder | `/backoffice/customers` | Server, innsyn |
| Avtale | `/backoffice/agreement-runtime` | Server, runtime-speil |
| Uke & meny | `/backoffice/week-menu` | Server, publish-orchestrator |
| SEO / Social / ESG | `seo-growth`, `social`, `esg` | Klient-tunge flater |

## Hva som føltes ulikt (før CP11)

- **Typografi og bredde:** `max-w-5xl` vs `max-w-[1440px]` vs full høyde.
- **Header:** noen sider uten tydelig «workspace header» før verktøy.
- **H1:** risiko for duplikat mellom page og innbygget klient.

## CP11-modell (standardisert)

Alle berørte sider bruker **`BackofficeWorkspaceSurface`** der det er forsvarlig:

| Element | Standard |
|---------|----------|
| **Header** | Én **H1** + kort **lead** (redaktør-kontekst) |
| **Status** | Global strip i layout + modul-callout (growth) / paneler (uke) |
| **Actions** | Primærknapp/lenker i innhold, ikke i global header med mindre nødvendig |
| **Context apps** | Eksisterende paneler/kort (`Cms*Panel`, `CmsDomainActionSurfaceCard`) |
| **Info/metadata** | `code`-referanser til runtime-felt der relevant |
| **Publish/history** | Valgfri **ærlig** notis — ingen falsk samlet logg |
| **Runtime linkage** | Lenker til `/backoffice/runtime`, Studio-URL der dokumentert |

## Elementer som ikke dupliseres

- **Ny shell** ved siden av `BackofficeShell` — **nei**.
- **Ny sannhetsmodell** — **nei**.
