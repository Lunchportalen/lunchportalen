# U31R Settings Runtime

- Title: Promote settings to a first-class section without fake CRUD
- Scope: `app/(backoffice)/backoffice/settings/layout.tsx`, `app/(backoffice)/backoffice/settings/page.tsx`, and the existing settings section chrome.
- Repro:
  1. Open `/backoffice/settings`.
  2. Compare the section posture against content and other backoffice sections.
- Expected: settings should read as its own management section with a clear collection -> workspace model and honest code-governed messaging.
- Actual: settings still felt visually secondary and mixed hub, collection, and workspace language too loosely.
- Root cause: the settings route had valid content, but its framing did not yet communicate first-class section ownership strongly enough.
- Fix: route the layout directly through `SettingsSectionChrome`, strengthen the overview page, and make code-governed/non-CRUD posture explicit in the copy and cards.
- Verification:
  - `npm run typecheck`
  - `npm run build:enterprise`
  - `npm run test:run`

## Section Posture

- `app/(backoffice)/backoffice/settings/layout.tsx` now wraps the section directly in `SettingsSectionChrome`.
- This makes the settings chrome canonical at the layout boundary instead of relying on a weaker wrapper pattern from the page level.

## Overview Posture

- `app/(backoffice)/backoffice/settings/page.tsx` now states the section posture directly with the badges:
  - `First-class section`
  - `Collection til workspace`
  - `Ingen falsk CRUD`
- The page also adds stronger management signals for document types, data types, and create policy.
- The primary action remains operationally honest: open `document types`, not perform pretend persisted CRUD.

## Runtime Truth

- Settings remains a management surface over code-governed registry and read models.
- U31R does not move settings into auth/runtime truth and does not introduce new persistence claims.
- The page now distinguishes workspace surfaces from section posture so the section reads as deliberate, not incidental.
