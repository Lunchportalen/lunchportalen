# U00R2 Settings And Governance Audit

## What Settings / Schema / Management Surfaces Actually Exist
| Surface | Exact files | Truth source | Classification | What it really is |
|---|---|---|---|---|
| Settings hub | `app/(backoffice)/backoffice/settings/page.tsx` | `BACKOFFICE_SETTINGS_COLLECTIONS` + `backofficeSchemaSettingsModel.ts` | `ACTIVE` | Real section landing and IA shell for governance surfaces. |
| Settings section layout | `app/(backoffice)/backoffice/settings/layout.tsx`, `SettingsSectionChrome.tsx` | Route/UI composition | `ACTIVE` | Real section chrome. |
| Document types collection/workspace | `settings/document-types/**`, `lib/cms/contentDocumentTypes.ts` | Static document-type registry | `CODE_GOVERNED` | Read-only collection/workspace over code truth. |
| Data types collection/workspace | `settings/data-types/**`, `lib/cms/backofficeSchemaSettingsModel.ts` | Static field-kind/property-editor explanation model | `CODE_GOVERNED` | Read-only explanation of property-editor-like kinds. |
| Create policy | `settings/create-policy/page.tsx`, `ContentWorkspaceCreatePanel.tsx`, `app/api/backoffice/content/pages/route.ts` | Static doc-type rules + API enforcement | `PARTIAL` | Real enforcement, but not a persisted policy engine. |
| Schema (combined) | `settings/schema/page.tsx`, `backofficeSchemaSettingsModel.ts` | Static read model | `CODE_GOVERNED` | Combined explanation layer, not a schema manager. |
| Governance insights | `settings/governance-insights/page.tsx`, `/api/backoffice/content/governance-usage` | Runtime scan of `content_page_variants.body` | `ACTIVE` | One of the few governance surfaces that reads real content posture. |
| Management read | `settings/management-read/page.tsx`, `/api/backoffice/content/governance-registry` | Static code registry exported as JSON | `CODE_GOVERNED` | Management-API analogue, not a real management runtime. |
| System and drift | `settings/system/page.tsx`, `/api/backoffice/settings`, `/api/superadmin/system` | `system_settings` runtime row + separate save route | `RUNTIME_TRUTH` / `DEGRADED` | Real runtime-backed surface with a real boundary leak. |
| Global settings | `GlobalDesignSystemSection.tsx`, `/api/content/global/settings`, `global_content` migration | Persisted `global_content` row | `ACTIVE` / `STRUCTURAL_GAP` | Real persisted global truth, but outside the main page-management model. |

## Which Files Actually Control Governance
| Control area | Owning files | Actual behavior | Classification |
|---|---|---|---|
| Document types | `lib/cms/contentDocumentTypes.ts`, document-type settings pages, create/save routes | Defines aliases, allowed children, allowed block types | `CODE_GOVERNED` |
| Data types / property editor kinds | `lib/cms/backofficeSchemaSettingsModel.ts`, `blockFieldSchemas.ts`, `SchemaDrivenBlockForm.tsx` | Defines field kinds and renders block edit UI | `CODE_GOVERNED` |
| Block allowlist | `lib/cms/blockAllowlistGovernance.ts`, save/create routes | Enforces allowed block types from envelope document type | `ACTIVE` |
| Create restrictions | `contentDocumentTypes.ts`, `ContentWorkspaceCreatePanel.tsx`, `pages/route.ts` | Filters create flow and enforces allowed child types | `PARTIAL` |
| Governance usage scanning | `/api/backoffice/content/governance-usage`, `governance-insights/page.tsx` | Reads variant bodies, legacy/governed posture, allowlist violations | `ACTIVE` |
| Governance registry export | `/api/backoffice/content/governance-registry`, `backofficeSchemaSettingsModel.ts` | Exposes code-governed registry as JSON | `CODE_GOVERNED` |
| AI governance | `app/(backoffice)/backoffice/ai-control/**`, `app/api/backoffice/ai/**`, `lib/ai/**` | Separate control-plane and event-store logic | `SUPPORTING` |
| Page / global / design policy | `ContentWorkspacePropertiesRail.tsx`, `GlobalDesignSystemSection.tsx`, `designContract.ts`, `/api/content/global/settings` | Managed partly inside editor state, partly via global-content routes | `PARTIAL` / `STRUCTURAL_GAP` |

## What Is Actually First-Class
- Settings is a real backoffice section with real collections and workspaces.
- Governance usage is a real runtime scan, not brochure copy.
- System settings is a real runtime-backed surface.
- Block allowlist validation is real and enforced in create/save APIs.
- Global header/footer/settings are real persisted rows in `global_content`.

## What Only Looks First-Class
- Document types are not persisted managed entities.
- Data types are not editable property editor objects.
- Create policy is not a stored management model.
- Management read is not a full Management API platform; it is a JSON export of code truth.
- Page/global/design policy is still split between editor-owned state and separate global content routes.

## Governance Judgment
Settings is not fake. The mistake is to treat it as completed Umbraco-style management parity. The truth is harsher: it is a real management section whose strongest surfaces are runtime scanning and code-registry explanation, while the deeper type-system, Data Type, property-editor-schema, and global-content management layers remain `CODE_GOVERNED`, split, or structurally thin.
