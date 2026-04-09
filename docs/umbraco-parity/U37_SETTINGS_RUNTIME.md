# U37 Settings Runtime

## Landed Now
- `/api/backoffice/settings` er nå den kanoniske backoffice-lesestien for systeminnstillinger og returnerer `settings + baseline`.
- System-workspacen viser baseline-status, operatorMessage og write-lock når persisted baseline ikke er klar.
- Settings-modellene og registry-et markerer `system` som runtime-managed i stedet for bare runtime-read.

## Management Outcome
- Settings-seksjonen er mer operasjonell for runtime-nære innstillinger.
- UI later ikke som lagring er trygg når baseline er `row_missing`, `table_missing` eller `read_error`.
- Document types, data types, schema og create policy lever fortsatt i samme section-logikk uten å få en falsk CRUD-historie.

## Honest Gap
- Settings er styrket som management section, men document/data/property-systemet er fortsatt primært code-governed read management.
- U37 leverte ikke ny persisted settings-motor utover den kanoniske system-settings-pathen.
