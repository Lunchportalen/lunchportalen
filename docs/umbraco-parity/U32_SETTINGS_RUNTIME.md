# U32 - Settings runtime

- Title: U32 settings as management section
- Scope: `lib/cms/backofficeExtensionRegistry.ts`, `app/(backoffice)/backoffice/settings/_components/SettingsSectionChrome.tsx`, and settings section pages/chrome.
- Repro:
  1. Open `/backoffice/settings`.
  2. Compare the section chrome with Bellissima-style collection -> workspace expectations.
  3. Observe that the section can read as explanatory cards more than an operational management surface.
- Expected: settings is a clear management section with explicit collections/workspaces, even where the data remains code-governed.
- Actual: the area was useful, but its collection/workspace model was not explicit enough.
- Root cause: settings metadata was not fully aligned with the same registry-driven model used by stronger Bellissima surfaces.
- Fix: expand the settings workspace view definitions and drive the chrome from shared collection/workspace metadata so the section behaves like a management surface instead of a brochure.
- Verification:
  - `npx vitest run tests/cms/backofficeExtensionRegistry.test.ts --config vitest.config.ts`
  - `npm run typecheck`
  - `npm run build:enterprise`

## What changed

- `BACKOFFICE_SETTINGS_WORKSPACE_VIEWS` now includes explicit management views for:
  - schema
  - management read
  - system and drift
- `SettingsSectionChrome.tsx` now renders workspace tabs from the shared settings collections instead of a narrower ad-hoc list.

## Result

- Settings now has clearer collection -> workspace posture.
- Code-governed surfaces are still honest about being code-governed.
- U32 improves Bellissima structure here without pretending persisted CRUD exists where it does not.
