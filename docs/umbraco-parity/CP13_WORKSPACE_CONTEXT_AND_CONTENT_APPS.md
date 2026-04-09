# CP13 — Workspace context & content apps (baseline)

## Eksisterende workspace-kontekst

- **`BackofficeWorkspaceSurface`** — `workspaceId`, `title`, `lead`, `toolbar`, `publishHistoryNote`, layout.
- **Content workspace** — paneler (SEO, CRO, AI, konflikt, recovery) fungerer som **workspace views / content apps** (Umbraco-terminologi).

## Shared state i dag

- React state i respektive klient-komponenter (`useContentWorkspace*`, osv.) — **ikke** én global Bellissima `WorkspaceContext` fra CMS-kjerne.

## Content apps / context panels

- Kartlagt i CP11 (`CP11_CONTENT_APPS_*`) — innholdssider har rikest panelsett.

## Mangler for «ren» Umbraco 17-workspace-følelse

- Én **deklarativ** `BackofficeWorkspaceSession` sendt inn på tvers av alle workspaces (delvis adressert med `lib/cms/backofficeWorkspaceContextModel.ts`).
- Global **draft/published** badge i krom — domeneavhengig; noen flater er runtime-innsyn.

## CP13-retning

- Type-modell for **workspace session** (extensionId + lifecycle + runtimeLinked).
- Ingen ny editor — **kun** tydeligere kontrakt for fremtidige props.
- Historikk-strip (CP12) forblir **ærlig** flerkilde-fortelling.
