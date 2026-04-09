# U25 — Changed files

## Code

| File | Why | Risk |
|------|-----|------|
| `app/api/backoffice/content/pages/route.ts` | Canonical envelope on create; validate optional `body` | Low — fail-closed 400 on bad DT/blocks |
| `app/(backoffice)/backoffice/content/_components/contentWorkspaceCreatePageSubmit.ts` | Align `blocksBody` with stored shape | Low |
| `app/(backoffice)/backoffice/content/_components/ContentWorkspace.tsx` | Duplicate allowlist guard | Low — UX only until save |
| `app/(backoffice)/backoffice/content/_components/ContentMainShell.tsx` | Editor transparency for legacy vs envelope | Low — copy only |
| `app/(backoffice)/backoffice/settings/create-options/page.tsx` | Document U25 behaviour | Low — copy |

## Docs

- Baseline: `U25_ENVELOPE_ADOPTION_BASELINE.md`, `U25_DOCUMENT_TYPE_ENFORCEMENT_ROLLOUT.md`, `U25_CREATE_WIZARD_AND_FILTERS_MODEL.md`, `U25_PROPERTY_PRESETS_AND_SETTINGS_POLICY.md`, `U25_SETTINGS_PERSISTENCE_DECISION.md`, `U25_REPLATFORMING_GAPS.md`
- Execution: `U25_EXECUTION_LOG.md`, `U25_CHANGED_FILES.md` (this file)
- Runtime: `U25_ENVELOPE_RUNTIME.md`, `U25_CREATE_WIZARD_RUNTIME.md`, `U25_BLOCK_ALLOWLIST_RUNTIME.md`, `U25_SETTINGS_RUNTIME.md`, `U25_HARDENING.md`, `U25_VERIFICATION.md`
- Closing: `U25_DECISION.md`, `U25_TRAFFIC_LIGHT_MATRIX.md`, `U25_SIGNOFF.md`, `U25_OPEN_RISKS.md`, `U25_NEXT_STEPS.md`
