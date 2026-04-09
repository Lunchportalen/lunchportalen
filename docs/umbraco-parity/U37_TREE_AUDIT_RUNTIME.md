# U37 Tree Audit Runtime

## Landed Now
- Tree- og audit-rutene bruker nå kanoniske klassifiseringshelpers for degradert schema-/tabellfeil.
- Tree-responsen kan nå bære `missingColumns`, `detail` og `code`, ikke bare en grov degraded-tekst.
- Audit-responsen kan nå bære eksplisitt degraded payload for `TABLE_MISSING`, `COLUMN_MISSING` og `SCHEMA_CACHE_UNAVAILABLE`.
- UI viser nå operatorMessage/operatorAction, teknisk kode og manglende kolonner tydeligere.

## Why This Matters
- Manglende kolonner blir ikke lenger forvekslet med manglende tabell.
- Operatøren får et neste steg som matcher faktisk feiltype.
- History/timeline og tree holder seg lesbare og fail-closed i stedet for å 500-e eller fremstå tomme uten forklaring.

## Tests Locked
- Tree helper-klassifisering.
- Tree route degraded + page_key fallback.
- Audit helper-klassifisering.
- Audit degraded route payload.
- Tree envelope/UI-mapping.
