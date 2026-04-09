# U24 — Create restrictions og allowlist

## Før U24

- **Tre**: `allowedChildTypes` fra API (create panel).
- **Blokker**: alle `EDITOR_BLOCK_CREATE_OPTIONS` tilgjengelige — U23 dokumenterte begrensningen.

## Etter U24

| Regel | UI | Server |
|-------|-----|--------|
| Blokktype tillatt for dokumenttype | Filtrert modal/picker | `PATCH` avviser ulovlige typer |
| Legacy uten `documentType` | Full liste | Ingen allowlist-sjekk |
| Ukjent dokumenttype i envelope | Tom/ingen valg | 422 |

## Ikke-mål

- Egen policy-motor med regelspråk — **kun** registry + validering.
