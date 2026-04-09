# U17 — Workspace context (runtime)

## Komponenter

| Del | Beskrivelse |
|-----|-------------|
| `BackofficeExtensionContextStrip` | Viser workspace-navn, seksjon, modulposture, styringssignal, valgfri handlingslenke |
| `backofficeWorkspaceContextModel.ts` | Type-modell for fremtidig props (`BackofficeWorkspaceSession`) |

## Prinsipp

- **Read-only** kontekst — ingen ny state machine for publish.
- Kobler **manifest** → **MODULE_LIVE_POSTURE_REGISTRY** → **CONTROL_PLANE_DOMAIN_ACTION_SURFACES**.

## Ikke introdusert

- Global `WorkspaceContext` provider for hele backoffice (unngår duplikat state med eksisterende hooks).
