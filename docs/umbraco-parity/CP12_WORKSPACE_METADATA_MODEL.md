# CP12 — Workspace metadata model

**Dato:** 2026-03-29

## Standardisert (CP11–CP12)

| Element | Kilde |
|---------|--------|
| Workspace header | `BackofficeWorkspaceSurface` |
| Runtime status | `CmsRuntimeStatusStrip` + modul-callouts |
| Historikk-fortelling | `CmsHistoryDiscoveryStrip` (CP12) |
| `data-workspace` | Flater som er refaktorert |

## Kan bygges på dagens stack

- Flere **statiske** discovery-lenker i palett.
- **Kort hjelpetekst** i strip (ingen ny DB).

## UX-paritet vs teknisk likhet

- Umbraco **Audit trail**-motor — replatforming eller dyp integrasjon; ikke utgitt som falsk i LP.
