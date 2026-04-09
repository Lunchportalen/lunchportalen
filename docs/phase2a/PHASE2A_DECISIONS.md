# Phase 2A — Decisions (inkl. V3)

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | **Strengthen `--lp-*`**, no second theme file | Single source of truth |
| D2 | **`--lp-chrome-bg` for TopBar** | Fjerner hardkodet `slate-900`; dark mode kan tune ett sted |
| D3 | **Targeting bar + nav til global** | Oppfyller «CMS Design styrer hvor» uten ny API |
| D4 | **Blokk-design i Egenskaper** | `block.config` allerede i `designContract`; UI manglet |
| D5 | **PageContainer → `src/components`** | Canonical layout-komponent; lav risiko |
| D6 | **Page-scope (historisk)** | Utsatt inntil V4; V4 leverer `meta.pageDesign` (se D7) |
| D7 | **Page/section design i `body.meta`** | Eksisterende `{ blocks, meta }` uten ny DB-kolonne; `pageDesign` / `sectionDesign` følger `DesignSettingsDocument`-form |
| D8 | **Én merge-funksjon** | `buildEffectiveParsedDesignSettingsLayered` brukes i `CmsBlockRenderer` og `PublicPageRenderer`; `mergeFullDesign` for blokk på toppen |
