# U106 — CMS-kjerne commit (git-sannhet)

**Dette er ikke baseline freeze. Dette er ikke proof. Dette er ikke CI/e2e.**

## Commit

- **SHA:** `b34cbc67a421eeb907cf28319ff886043cae811a`
- **Melding:** `backoffice/content: commit staged CMS core`
- **Foregående `HEAD`:** `a809362e296b80459c1adc2ae5932aeb1cb9b82f`

## Filer som inngikk (6)

- `app/(backoffice)/backoffice/content/_components/ContentWorkspace.tsx`
- `app/(backoffice)/backoffice/content/_components/contentWorkspace.aiRequests.ts`
- `app/(backoffice)/backoffice/content/_components/contentWorkspace.blocks.ts`
- `app/(backoffice)/backoffice/content/_components/contentWorkspace.outbox.ts`
- `app/(backoffice)/backoffice/content/_components/contentWorkspacePageEditorShellInput.ts`
- `app/(backoffice)/backoffice/content/_components/forsideUtils.ts`

## Eksplisitt ikke inngikk

- Audit-loggene under `docs/audit/**` (ikke en del av denne commiten)
- Øvrig `app/**`, `lib/**`, `components/**`, tests, e2e, config, workflows
- Week-ruter og alt annet utenom de seks filene over

## Verifikasjon etter commit

- `git diff --cached --name-only`: tom (ingenting staged)
- Working tree: fortsatt dirty (baseline ikke oppnådd)
- `npm run typecheck`: OK
- `npm run test:run`: OK

## Neste pakke (én)

**audit-logg-håndtering** — fullfør U105-splitten ved å historisere eller håndtere audit-dokumentasjon som bevisst ble holdt utenfor CMS-kjernen, uten å blande det inn i produktcommits.
