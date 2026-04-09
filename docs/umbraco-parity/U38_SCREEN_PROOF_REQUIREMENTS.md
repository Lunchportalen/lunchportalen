# U38 Screen Proof Requirements

U38 is not approved without new screenshots stored under `docs/umbraco-parity/u38-screen-proof/` and summarized in `docs/umbraco-parity/U38_SCREEN_PROOF.md`.

## Required Routes

- `/backoffice/content`
- `/backoffice/content/[id]`
- `/backoffice/settings`
- `/backoffice/settings/document-types/[alias]`
- `/backoffice/settings/data-types/[kind]`
- `/backoffice/settings/create-policy`
- Relevant degraded tree state
- Relevant degraded audit state

## Required For Each Screenshot

- Route or state name
- Short note on what is visibly improved
- Which Bellissima principle is visible
- Remaining weakness if the surface is still partial

## Capture Rules

- Use an authenticated superadmin session.
- Capture the canonical shell, not isolated component mocks.
- Save stable filenames that map one-to-one to the route or degraded state.
- Do not claim near-Umbraco-17 parity until these files exist.
