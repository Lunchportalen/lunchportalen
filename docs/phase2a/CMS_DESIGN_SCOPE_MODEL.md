# CMS Design — scope model

## Kanonisk lag (implementert i kode i dag)

| Scope | Datakilde | Hvem overstyrer hvem |
|-------|-----------|----------------------|
| **Global** | `global_content.settings.data.designSettings` | Basis for alle sider |
| **Blokk** | `block.config` (`BlockConfig` i `lib/cms/design/designContract.ts`) | Overstyrer globalt for den blokken |
| **Merge** | `mergeFullDesign(config, designSettings, blockType)` | En sannhet ved render/preview |

## Side-nivå (planlagt — ikke full datakontrakt i 2A V3)

| Scope | Beskrivelse | Status |
|-------|-------------|--------|
| **Page** | Egne `designSettings` eller meta-felt per side | Dokumentert; krever page-envelope + API-utvidelse i senere fase |

## Tillatte stilvalg per nivå

### Global (`designSettings`)

- `card.<blockTypeKey>`: `variant`, `hover` (enumerations)
- `surface.section`, `spacing.section`, `typography.*`, `layout.container`

### Blokk (`block.config`)

- `theme`, `layout`, `card`, `container`, `surface`, `spacing`, `typography` — **kun** via `designContract`-typer

### Låst av systemet

- Fri inline CSS, vilkårlige hex-farger i `data`, ukjente klassenavn utenom godkjente `lp-*` / tokens.

## Variant / tilstand

- **Hover / lift / glow** — `CardHover` på kort-lag
- **Theme** — `default` | `dark` | `highlight`
- **Layout** — `standard` | `full` | `split` (blokk)

## Referanse

- `lib/cms/design/designContract.ts`
- `GlobalDesignSystemSection.tsx`
- `CmsBlockDesignSection.tsx`
