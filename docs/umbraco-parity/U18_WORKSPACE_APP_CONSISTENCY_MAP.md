# U18 — Workspace app consistency map

## Konsistent i dag

- **Content:** rike paneler (SEO, CRO, AI, konflikt, recovery).
- **Backoffice shell:** `BackofficeShell` + context strip + historikk-strip.
- **Registry:** `workspaceId` på `BackofficeWorkspaceSurface` der migrert.

## Tilfeldige / ujevne

- Noen growth-sider **fullBleed** vs `default` layout — historisk.
- Ikke alle workspaces har samme **toolbar**-mønster.

## U18-retning

- **Kontekst-strip** og **historikk-strip** gir felles «krom» uten ny shell.
- **AI Center**-side harmoniserer governance-språk med resten av backoffice.

## Ikke gjort i U18

- Full refaktor av alle sider til identisk toolbar — **ikke** påkrevd for U18 STOPPREGEL.
