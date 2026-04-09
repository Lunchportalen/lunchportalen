# CP10 — Workspaces and content apps contract

**Dato:** 2026-03-29

## Workspaces i dag (hovedtrekk)

| Workspace | Rute | Rolle |
|-----------|------|--------|
| Content | `/backoffice/content` | Tre + editor + paneler (SEO, CRO, konflikt, recovery, AI) |
| Media | `/backoffice/media` | Opplasting, liste |
| Domener | `/backoffice/domains` | DNS/hosting-oversikt |
| Kunder | `/backoffice/customers` | Firma/kunder |
| Avtale | `/backoffice/agreement-runtime` | Avtale↔runtime (read + routing) |
| Uke & meny | `/backoffice/week-menu` | Meny/uke publisering via kontrollflate |
| SEO | `/backoffice/seo-growth` | SEO-modul |
| Social | `/backoffice/social` | Social-modul |
| ESG | `/backoffice/esg` | ESG-presentasjon |
| Control / Security / AI Tower / Enterprise / Runtime / … | egne ruter | Control towers og status |

## Context panels / «content apps» i dag

- **Content:** sidepaneler knyttet til valgt side/blokk (inspectors, SEO, CRO, AI-kontekst).
- **Media:** metadata og handlinger per medium der implementert.
- **Growth:** egne sider med modulspesifikk UI.

## Hva som mangler for full Umbraco-likhet

- **Én visuell «app»-ramme** for alle domener (Umbraco sections) — delvis dekket av felles **TopBar + palett**; ikke ny shell.
- **Egne content apps per side-type** i teknisk Umbraco-forstand — **UX-paritet** via eksisterende paneler, ikke ny plattform.

## CP10-retninger (uten parallelle systemer)

1. **Én nav-kilde:** `BACKOFFICE_NAV_ITEMS` for TopBar og palett — konsistente merkelapper og ikoner.
2. **Ingen ny workspace-root:** forsterk eksisterende `ContentWorkspace`-mønster.
3. **Ærlig modulstatus:** LIMITED/DRY_RUN/STUB skal ikke kunne mistolkes som full produksjon der backend ikke støtter det.

## Grenser (låst)

- **Agreement/company/location** sannhet forblir **runtime**; CMS viser **read/review/routing** + publish der det allerede finnes.
- **Ordre/billing/auth** — ikke flyttet inn i CMS.
