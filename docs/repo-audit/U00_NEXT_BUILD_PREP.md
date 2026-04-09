# U00 Next Build Prep

## What Must Be Fixed First
- Fix publish/audit schema correctness before any more editor polish.
- Stabilize `system_settings` truth so the Settings -> System surface is not half-runtime, half-failsafe.
- Consolidate `esg_monthly` schema expectations before treating ESG backoffice as trustworthy.
- Promote tree/audit degraded states to first-class operator signals inside the workspace.

## What Must Not Be Touched Yet
- `middleware.ts`, `/api/auth/post-login`, `/login`, and other locked auth/redirect truths unless a separate explicit mandate says otherwise.
- Frozen runtime domains: employee week/order chain, company lifecycle A-I, and other locked operational truths named in `AGENTS.md`.
- Sanity/editorial week/menu truth model unless the next phase explicitly includes that cross-system scope.
- Large speculative refactors outside the content/backoffice/editor surface.

## Files To Open First Next Round
1. `app/api/backoffice/content/pages/[id]/variant/publish/route.ts`
2. `supabase/migrations/20260229000001_content_audit_log_workflow.sql`
3. `supabase/migrations/20260304000001_content_audit_log_release_execute.sql`
4. `app/api/backoffice/settings/route.ts`
5. `app/(backoffice)/backoffice/settings/system/page.tsx`
6. `lib/system/settingsRepository.ts`
7. `lib/settings/getSettings.ts`
8. `lib/esg/latestMonthlyRollupList.ts`
9. `app/api/backoffice/esg/latest-monthly/route.ts`
10. `app/api/admin/esg/latest-monthly/route.ts`
11. `app/(backoffice)/backoffice/content/_components/ContentWorkspace.tsx`
12. `app/(backoffice)/backoffice/content/_components/ContentWorkspacePageEditorShell.tsx`
13. `app/(backoffice)/backoffice/content/_components/ContentWorkspaceMainCanvas.tsx`
14. `app/(backoffice)/backoffice/content/_components/RightPanel.tsx`
15. `app/(backoffice)/backoffice/content/_tree/ContentTree.tsx`
16. `app/(backoffice)/backoffice/content/_components/ContentWorkspaceAuditTimeline.tsx`
17. `app/(backoffice)/backoffice/content/_components/ContentWorkspaceHistoryView.tsx`
18. `lib/cms/contentDocumentTypes.ts`
19. `lib/cms/blockAllowlistGovernance.ts`
20. `lib/cms/backofficeWorkspaceContextModel.ts`

## Docs To Ignore In The Next Build Phase
- `docs/MASTER_FULL_REPOSITORY_AUDIT.md`
- `docs/FULL_REPOSITORY_AUDIT_VERIFIED.md`
- `docs/FORENSIC_REPOSITORY_AUDIT.md`
- `docs/umbraco-parity/UMBRACO_PARITY_EDITORIAL_EXPERIENCE.md`

Use these instead:
- `docs/repo-audit/U00_RUNTIME_AND_SCHEMA_AUDIT.md`
- `docs/repo-audit/U00_EDITOR_RENDER_CHAIN.md`
- `docs/repo-audit/U00_PARITY_SCORECARD.md`
- `docs/repo-audit/U00_IMPLEMENTATION_PRIORITY_MAP.md`

## Runtime Errors To Close Before More UX Polish
- `content_publish` vs `content_audit_log_action_check`
- Missing/unclear canonical `system_settings` creation path
- `esg_monthly` column/type drift
- Any tree or audit degraded route state that is still treated as secondary UI noise

## Editor Moves With The Biggest Fastest Lift
- Make tree/audit degraded truth unavoidable in workspace chrome and history view.
- Collapse preview concepts into one clearer workspace story.
- Reduce stacked chrome and inspector scope noise before chasing new panels.
- Unify block discovery so “add block” feels like one flow, not two competing ones.

## UX-Parity-First Vs Deep Structural Change
### UX parity first
- History and degrade surfacing
- Preview coherence
- Tree-first workspace emphasis
- Block discovery calmness
- Settings section honesty

### Deep structural change
- Splitting `ContentWorkspace.tsx`
- Real document-type / data-type management parity
- Full extension/runtime parity beyond static registry
- Any attempt to unify Sanity and Postgres editorial truth into one platform model

## Build-Prep Judgment
The next round should be ruthless and narrow: restore schema/runtime correctness first, then simplify the editor around the real structures that already exist. Do not start by inventing more architecture. Start by making the existing architecture trustworthy.
