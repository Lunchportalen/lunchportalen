# U23 — Hardening

## Fail-closed

- Schema- og create-options-sider er **read-only** — ingen skjult mutasjon av innhold eller system.
- Systemflatedrifting forblir bak superadmin API; hub endrer ikke tilgangskontroll.

## Modulposture

- Hub lenker ærlig til **AI-styring** og **runtime** for å unngå at Settings oppleves som «alt-i-ett» uten kontekst.

## Risiko

- **Dobbel sannhet** for blokkliste unngås ved én kilde: `editorBlockCreateOptions.ts`.
