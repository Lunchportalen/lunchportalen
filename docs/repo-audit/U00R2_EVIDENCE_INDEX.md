# U00R2 Evidence Index

| Bevis-ID | File | Symbol/route | What it proves | Severity | Linked report sections |
|---|---|---|---|---|---|
| `EV-001` | `app/api/backoffice/content/pages/[id]/variant/publish/route.ts` | `POST` publish handler | Publish route writes `action: "content_publish"` to audit log. | Critical | Summary, Runtime/Schema Audit, Next Build Prep, Parity Scorecard |
| `EV-002` | `supabase/migrations/20260229000001_content_audit_log_workflow.sql` | `content_audit_log action check` | Allowed actions exclude `content_publish`. | Critical | Runtime/Schema Audit, Evidence chain for publish break |
| `EV-003` | `supabase/migrations/20260304000001_content_audit_log_release_execute.sql` | `content_audit_log_action_check` | Later additive constraint still excludes `content_publish`. | Critical | Runtime/Schema Audit, Releases row, Priority Map |
| `EV-004` | `app/api/backoffice/settings/route.ts` | `GET` | Backoffice settings route explicitly returns `SETTINGS_TABLE_MISSING`. | High | Summary, Runtime/Schema Audit, Settings Audit |
| `EV-005` | `supabase/migrations/20260430120000_system_settings_killswitch.sql` | migration body | Current migration evidence is additive alignment for `killswitch`, not clear create-table proof. | High | Runtime/Schema Audit, Settings Audit |
| `EV-006` | `lib/esg/latestMonthlyRollupList.ts` | `loadLatestMonthlyRollupList()` | ESG loader expects `delivered_count` / `cancelled_count`. | High | Runtime/Schema Audit, Priority Map |
| `EV-007` | `supabase/migrations/20260218_orders_rollup_invoice_esg_overview.sql` | `create table public.esg_monthly` | Older migration defines `delivered_meals` / `canceled_meals`. | High | Runtime/Schema Audit, Summary |
| `EV-008` | `supabase/migrations/20260221_step6_10_fasit_periods_esg.sql` | `public.esg_monthly` definition | Later migration changes month type and uses `delivered_count` / `cancelled_count`. | High | Runtime/Schema Audit, Summary |
| `EV-009` | `components/backoffice/ContentBellissimaWorkspaceContext.tsx` | `ContentBellissimaWorkspaceProvider` | Bellissima-like shared workspace context is real and mounted. | High | Summary, Render Chain, Bellissima Matrix |
| `EV-010` | `lib/cms/backofficeWorkspaceContextModel.ts` | `ContentBellissimaWorkspaceSnapshot`, `buildContentBellissimaWorkspaceModel()` | Views, actions, entity actions, footer apps, history state, and publish posture are modeled centrally. | High | Summary, Render Chain, Bellissima Matrix, Parity Scorecard |
| `EV-011` | `lib/cms/backofficeExtensionRegistry.ts` | `BACKOFFICE_SECTIONS`, `BACKOFFICE_NAV_ITEMS` | Registry is manifest-like, but still static code rather than runtime-loaded extensions. | Medium | Summary, Bellissima Matrix, Parity Scorecard |
| `EV-012` | `app/(backoffice)/backoffice/_shell/BackofficeShell.tsx` | `BackofficeShell()` | Backoffice chrome stacks top bar, command palette, context strip, status/history before the actual workspace. | Medium | Render Chain, UX Failures |
| `EV-013` | `app/(backoffice)/backoffice/content/_components/ContentWorkspace.tsx` | `ContentWorkspace` | Core editor state remains monolithic. | Critical | Summary, Render Chain, Implementation Priority Map |
| `EV-014` | `app/(backoffice)/backoffice/content/_components/ContentWorkspaceMainCanvas.tsx` | `ContentWorkspaceMainCanvas` | Canvas couples block editing, preview, history preview, design targeting, and reorder behavior. | High | Render Chain, UX Failures, Blocks/Schema Map |
| `EV-015` | `app/(backoffice)/backoffice/content/_components/RightPanel.tsx` | `RightPanel` | Inspector rail mixes workspace, AI, and runtime tabs in one shell. | High | UX Failures, Blocks/Schema Map |
| `EV-016` | `app/(backoffice)/backoffice/content/_components/BlockAddModal.tsx` | `BlockAddModal` | Quick-add modal is a real, separate block discovery flow. | Medium | Blocks/Schema Map, UX Failures |
| `EV-017` | `app/(backoffice)/backoffice/content/_components/BlockPickerOverlay.tsx` | `BlockPickerOverlay` | Rich picker is another real, separate discovery flow with favorites/recent logic. | Medium | Blocks/Schema Map, UX Failures |
| `EV-018` | `lib/cms/contentDocumentTypes.ts` | `documentTypes` | Only one real document type (`page`) exists. | High | Summary, Settings Audit, Bellissima Matrix |
| `EV-019` | `lib/cms/backofficeSchemaSettingsModel.ts` | `EDITOR_FIELD_KIND_GOVERNANCE` | Data-type/property-editor governance is explanatory static code, not managed runtime truth. | High | Settings Audit, Bellissima Matrix, Parity Scorecard |
| `EV-020` | `lib/cms/blockAllowlistGovernance.ts` | `validateBodyPayloadBlockAllowlist()` | Block allowlist enforcement is real and shared between client/server flows. | High | Blocks/Schema Map, Settings Audit, Parity Scorecard |
| `EV-021` | `app/api/content/global/settings/route.ts` | `GET` / `POST` | Global settings route is a real persisted CMS surface, not fake UI. | Medium | Summary, Management vs Delivery, Settings Audit |
| `EV-022` | `supabase/migrations/20260421000000_global_content.sql` | `create table public.global_content` | Header/footer/settings are persisted in a separate `global_content` truth model. | Medium | Summary, Management vs Delivery, Bellissima Matrix |
| `EV-023` | `app/(backoffice)/backoffice/content/_components/PreviewCanvas.tsx` | `fetch("/api/content/global/settings")` | Preview fidelity already depends on global content routes. | Medium | Render Chain, Blocks/Schema Map |
| `EV-024` | `app/(backoffice)/backoffice/content/_components/GlobalDesignSystemSection.tsx` | `fetch("/api/content/global/settings")` | Global design editing is already wired to persisted global settings. | Medium | Settings Audit, Management vs Delivery |

## Index Judgment
The next build phase should not start by re-exploring the repo. It should start by walking this evidence index from `EV-001` downward, because the highest-severity gaps are already proven in code and migrations.
