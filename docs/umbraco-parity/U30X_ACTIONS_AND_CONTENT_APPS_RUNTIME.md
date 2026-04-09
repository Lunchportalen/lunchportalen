# U30X — Actions & content apps runtime

## Primær/sekundær

- **Publiser** forblir primær i `ContentTopbar` (grønn stor knapp).
- **Lagre** ligger i `ContentSaveBar` (sidepanel) — uendret hierarki.

## Content apps

- Eksisterende «modus» (edit vs preview) og device-valg ligger i `ContentWorkspaceEditorModeStrip` — ingen ny actions-motor.

## Neste steg

- Eksplisitt «Dette redigerer du nå»-stripe kan kobles til `editorFocusLabel` (allerede delvis i AI-flater).
