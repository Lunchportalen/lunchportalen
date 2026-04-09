# Umbraco parity — hardening (WS7)

## Prioritert

1. **Fail-closed** på sensitive API-er (allerede mønster: `scopeOr401` + roller).
2. **Ærlige badges** — ikke skjul LIMITED/DRY_RUN/STUB.
3. **Publish-sikkerhet** — `SANITY_WRITE_TOKEN` kun server; CP7 broker dokumentert.
4. **Runbook** — token, visibility, CDN-latens (se CP7 åpne risikoer).

## Ikke i denne runden

- Bred refaktor av middleware eller auth.
