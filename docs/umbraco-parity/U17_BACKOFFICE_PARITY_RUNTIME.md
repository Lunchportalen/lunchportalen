# U17 — Backoffice parity (runtime)

**U17 DEEP (2026-03-29):** `BackofficeExtensionContextStrip` + `findBackofficeExtensionForPathname` — se `U17_EXTENSION_REGISTRY_RUNTIME.md`, `U17_WORKSPACE_CONTEXT_RUNTIME.md`.

**Arbeidsstrøm 1** — mål: Umbraco 17-lignende helhet uten ny shell.

## Status ved U17

- **Navigasjon:** `lib/cms/backofficeNavItems.ts` (barrel) + `backofficeExtensionRegistry.ts` — grupper (`groupId`), seksjoner, ingen parallell meny.
- **Workspace-kontekst (strip):** seksjon, modulposture, styringssignal fra eksisterende CP4–CP6-registre.
- **Workspace:** `BackofficeWorkspaceSurface` — felles krom for backoffice-sider som er migrert (CP11/CP12).
- **Discovery:** `BackofficeCommandPalette` + `BACKOFFICE_PALETTE_ITEMS` (én registry-kilde, inkl. discovery-ruter).
- **Historikk-fortelling:** `CmsHistoryDiscoveryStrip` — ærlig om kilder (Postgres vs Sanity vs uke).

## Prinsipper (Umbraco 17 LTS-alignment)

- **Én moden flate** — ikke «ny backoffice v2»; iterasjon på eksisterende shell.
- **Runtime-status** — LIMITED/STUB/DRY_RUN skal kunne vises der modulen definerer det (ingen grønnvasking).
- **2A design DNA** — behold tokens og mønstre fra eksisterende design system.

## Ikke gjort i U17 (dokumentert stop)

- Ingen nye routes som dupliserer `BackofficeShell`.
- Ingen endring av frosne superadmin-flyter uten egen godkjenning.

## Neste (utenfor U17-kode)

- Eventuell utvidelse av **dashboard**-KPI på backoffice root — produktvalg.
