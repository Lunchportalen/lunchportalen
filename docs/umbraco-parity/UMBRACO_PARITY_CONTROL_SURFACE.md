# Umbraco parity — control surface (WS1)

## Mål

Én **Umbraco-lignende** opplevelse: seksjoner, workspaces, dashboards og **ærlig** runtime-status — uten ny shell.

## Dagens faktiske overflate

- **Inngang:** `/backoffice` med `BackofficeShell`, **superadmin-only** layout.
- **Status:** `CmsRuntimeStatusStrip` + `moduleLivePosture` data — badges: LIVE, LIMITED, DRY_RUN, STUB, INTERNAL_ONLY der relevant.
- **Domener:** `CONTROL_PLANE_DOMAIN_ACTION_SURFACES` kobler firma, avtale, uke/meny, innhold, media, tårn.
- **Design:** Følger eksisterende Tailwind/2A-visual DNA i repo (ingen parallell design system).

## Gap vs klassisk Umbraco

- Umbraco har **én** backoffice for mange roller; her er **superadmin** samlet i `/backoffice`, mens `company_admin` / `employee` har egne apper — **routing** er løsningen, ikke sammenslåing av sikkerhetsmodeller.

## Planlagt løft (uten stor refaktor)

- Fortsett å **navigasjonelt** samle «hvor gjør jeg X» via **control**- og **domains**-sider.
- Gjenta **samme seksjonsspråk** (kilde, påvirkning, trygg handling) på nye flater.
