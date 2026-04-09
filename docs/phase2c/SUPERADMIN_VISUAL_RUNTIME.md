# Superadmin — visuell runtime (2C4)

## Designsystem (2A)

- **Tokens:** `--lp-border`, `--lp-fg`, `--lp-muted`, `rounded-2xl`, rolig hvitt/krem.  
- **Kort:** `SuperadminCard` uendret; nye signal-kort bruker samme typografi (`font-heading`, `tabular-nums`).

## Oppmerksomhet vs ro

- Signal-kort med **pending > 0** får `amber`-variant for å markere review-kø — ikke full rød; fortsatt profesjonell tone.  
- **Én** primær highlight per capabilities (eksisterende `primaryAction` på driftsoversikt-kort).

## Ingen ny global shell

- `layout.tsx` med `ControlHeader`, `ControlTowerNav` — uendret.  
- Kun innholdet på `/superadmin` er utvidet.

## Hot pink (AGENTS F6)

- Bevares på eksisterende «primær» capability-kort; signal-lenker bruker nøytral hover/underline-stil.
