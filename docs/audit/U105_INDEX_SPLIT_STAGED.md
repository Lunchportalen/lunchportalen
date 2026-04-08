# U105 — staged index split (git-sannhet)

**Dette er ikke baseline freeze. Dette er ikke proof. Dette er ikke CI/e2e.**

## Før split (`git diff --cached`)

Staged: **8 filer**

- `app/(backoffice)/backoffice/content/_components/ContentWorkspace.tsx` — produkt/CMS
- `app/(backoffice)/backoffice/content/_components/contentWorkspace.aiRequests.ts` — produkt/CMS
- `app/(backoffice)/backoffice/content/_components/contentWorkspace.blocks.ts` — produkt/CMS
- `app/(backoffice)/backoffice/content/_components/contentWorkspace.outbox.ts` — produkt/CMS
- `app/(backoffice)/backoffice/content/_components/contentWorkspacePageEditorShellInput.ts` — produkt/CMS
- `app/(backoffice)/backoffice/content/_components/forsideUtils.ts` — produkt/CMS
- `docs/audit/full-system/IMPLEMENTATION_LOG.md` — audit/full-system logg
- `docs/audit/full-system/POST_IMPLEMENTATION_REVIEW.md` — audit/full-system logg

`HEAD` ved operasjonen: `a809362e296b80459c1adc2ae5932aeb1cb9b82f`

## Tatt ut av staging

- `docs/audit/full-system/IMPLEMENTATION_LOG.md`
- `docs/audit/full-system/POST_IMPLEMENTATION_REVIEW.md`

(`git restore --staged` på de to over.)

## Etter split — fortsatt staged

**6 filer** (kun CMS/produktkode under backoffice content components):

- `ContentWorkspace.tsx`
- `contentWorkspace.aiRequests.ts`
- `contentWorkspace.blocks.ts`
- `contentWorkspace.outbox.ts`
- `contentWorkspacePageEditorShellInput.ts`
- `forsideUtils.ts`

## Etter split — ikke staged (audit)

De to audit-filene over er **ikke** i index: `git status` viser `??` (untracked) for begge i denne working tree.

## Neste pakke dette åpner for

**CMS-only commit:** land de seks staged CMS-filene som én ren produkt-commit når dere er klare (audit forblir utenfor / egen håndtering).

Verifisert etter split: `npm run typecheck` OK, `npm run test:run` OK.
