# Kitchen — visuell runtime (2C2)

## Designsystem (2A)

- **Tokens:** `--lp-border`, `--lp-surface-2`, `--lp-muted`, `--lp-divider`, `--lp-shadow-soft`, `--lp-accent` (brukes til hover/fokus — én primær aksent).  
- **Kort:** `rounded-2xl`, tydelig kant, rolig hvitt/gråflate.  
- **Touch:** primærknapper og faner `min-h-[44px]` der det er hovedinteraksjon.

## Skannbarhet

- **Faner** (`Produksjonsliste` / `Aggregert rapport`): høy kontrast aktiv tilstand (`slate-900`), inaktiv med tynn kant — lite støy.  
- **Produksjonsliste:** tre kolonner med **Per firma / Per lokasjon / Per meny** (tall-lister) — rask oversikt før detaljlinjer.  
- **Linjer:** ansatt først, deretter firma·lokasjon, meny i eget felt, allergener/notat tydelig adskilt.

## Ikke gjort

- Full redesign av landing eller admin — kun kjøkkenflaten.  
- Ingen ny global shell — `PageSection` + `KitchenRuntimeClient` under eksisterende `app/kitchen/page.tsx`.

## Print

- Fanenavigasjon skjules ved print (`print:hidden` på nav) slik at aggregert innhold kan skrives ut rent fra nettleser der det er relevant.
