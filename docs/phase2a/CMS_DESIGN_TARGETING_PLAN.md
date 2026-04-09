# CMS Design targeting — plan (2A V3)

## Mål

Gi redaktør/admin **tydelig omfang** (global vs side vs blokk) uten fri styling, med samme preview/publiseringspipeline.

## Hvordan brukeren velger side

- **Innholdstreet** (`ContentTree` i `ContentWorkspaceLayout`) velger hvilken side som redigeres — allerede systemets sannhet.
- Canvas viser **`CmsDesignTargetingBar`** med sidetittel + slug + valgt blokk (hvis noen).

## Hvordan brukeren velger seksjon/blokk

- **Klikk blokk** i listen → `selectedBlockId` → egenskaper-rail + «CMS-design (blokk)» (`CmsBlockDesignSection`).
- Inline `BlockInspectorFields` for innhold; design-tokenfelt i Egenskaper-fanen.

## Global design

- Knapp **«Globalt design (tokens)»** i targeting-bar → `goToGlobalWorkspace()` + `content-and-settings` + fane `general` → `GlobalDesignSystemSection`.
- API: `GET/POST /api/content/global/settings` (eksisterende).

## Presets

- **Globale presets:** `designSettings.card.*` + surface/spacing/typography/layout.
- **Blokk-presets:** `block.config` — samme enumerations som kontrakten.

## Preview

- **Live preview** (`LivePreviewPanel`, `PreviewCanvas`) bruker publiserte/mergede designSettings + blokker — uendret kjede.
- **Historikk-preview:** eksisterende `HistoryPreviewPayload` — ikke endret.

## Rollback

- **Global:** lagre utkast vs publiser — eksisterende knapper i `GlobalDesignSystemSection`.
- **Blokk:** lagring av side (eksisterende save) + eventuell historikk via versjonsstrip — ikke ny motor i 2A.

## Filer utvidet i V3

- `CmsDesignTargetingBar.tsx` — UI for omfang + navigasjon til globalt design.
- `CmsBlockDesignSection.tsx` — blokk-`config` UI.
- `ContentWorkspace.tsx` — `onNavigateToGlobalDesignSettings`.
- `contentWorkspaceChromeShellInput.ts` / `contentWorkspaceChromeProps.ts` — wiring.

## Gjenstår (før full «page scope»)

- Persistert `designSettings` (eller tilsvarende) på **page**-dokument + merge-rekkefølge: global → **page** → blokk.
- Eksplisitt UI for «kun denne siden» uten å åpne global.
