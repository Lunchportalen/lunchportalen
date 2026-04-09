# Phase 2A — Risks (V3 + V4)

| Risk | Mitigation |
|------|------------|
| **Blokk `config` feilfylt** | Kun `designContract`-enum i UI; lagring følger eksisterende side-save |
| **Shell-navigasjon** | Samme `mainView` / `globalSubView` som før; kun ny callback |
| **PageContainer re-export path** | Relativ sti `../../src/...`; tsconfig prioriterer `src` for `@/components/layout` |
| **Meta og historikk** | `pageCmsMetaForPreview` bruker historisk body ved versjonsforhåndsvisning — ikke gjeldende utkast-meta |
| **Section-ID stavefeil** | Blokk kan peke på ukjent id; merge ignorerer (ingen overlay); UI viser «(ukjent)» i dropdown |

## Frozen areas

- Ingen endringer i middleware, auth routes, order/window, week API, billing.
