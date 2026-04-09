# U21 — Workspace context baseline

## Eksisterende kontekst i dag

- **`BackofficeExtensionContextStrip`** (klient): seksjon, modulposture, domain-surface (read-only) fra `findBackofficeExtensionForPathname`.
- **`lib/cms/backofficeWorkspaceContextModel.ts`**: `BackofficeWorkspaceSession` + `WorkspaceLifecycleHint` (type-nivå, ingen global React Context).
- **`BackofficeWorkspaceSurface` / `BackofficeWorkspaceHeader`**: H1, `lead`, `toolbar`, `publishHistoryNote`, `data-workspace`.

## Shared state

- Ingen global workspace store — bevisst; kontekst via manifest + props per side.

## Under paritet (før U21)

- Ingen felles **visuell** modell for «hva redigeres / draft vs published / runtime-koblet / primær vs sekundær handling / footer-status» på tvers av alle flater.

## U21 mål

- Utvide **samme** surface-komponenter med valgfrie `contextSummary`, `statusChips`, `secondaryActions`, `footerApps` — konsolidert på eksisterende primitiv, ikke ny motor.

## Risiko (uendret)

- Runtime-sannhet for ordre/avtale ligger utenfor CMS — kontekst skal **forklare**, ikke overskrive.
