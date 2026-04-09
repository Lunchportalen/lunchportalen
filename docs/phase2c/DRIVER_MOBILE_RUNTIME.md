# Driver — mobil UX (2C3 runtime)

## Designsystem (2A)

- Eksisterende tokens: `lp-glass-*`, `lp-progress`, `lp-safe-top` / `lp-safe-bottom`, kort med avrundede hjørner.
- **Touch:** `min-h-[44px]` på primærknapper og filterchips der det er hovedhandlinger; ikonknapper 44×44 i praksis (`h-11 w-11`).

## Mobil-first tiltak i 2C3

- **Progress** synlig også på smal skjerm (under filter), ikke bare på desktop.
- **Filterchips** for rask scanning (gjenstår vs levert) uten å endre serverdata.
- **Fast bunnlinje** (sm) med «Oppdater» bevares.
- **Kort / seksjoner** per vindu → firma → lokasjon — beholdt, med tydelig status-badge.

## Ingen global redesign

- Ingen ny app-shell; `PageSection` på `page.tsx` + `DriverRuntimeClient` som før.

## Horisontal scroll

- Unngås ved `flex-wrap`, `min-w-0`, `lp-wrap-anywhere` på adresser.
