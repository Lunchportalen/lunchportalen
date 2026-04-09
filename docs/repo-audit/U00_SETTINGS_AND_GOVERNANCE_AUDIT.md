# U00 Settings And Governance Audit

## What Settings Surfaces Actually Exist
| Surface | Exact files | Truth source | Class | What it really is |
|---|---|---|---|---|
| Settings hub | `app/(backoffice)/backoffice/settings/page.tsx` | `BACKOFFICE_SETTINGS_COLLECTIONS` + `backofficeSchemaSettingsModel.ts` | `ACTIVE` | Real section landing and IA shell for governance surfaces. |
| Settings section layout | `app/(backoffice)/backoffice/settings/layout.tsx`, `SettingsSectionChrome.tsx` | Route/UI composition | `ACTIVE` | Real section chrome. |
| Document types collection | `app/(backoffice)/backoffice/settings/document-types/page.tsx` | `getDocumentTypesForGovernance()` | `CODE_GOVERNED` | Read-only list of document types from code. |
| Document type workspace | `app/(backoffice)/backoffice/settings/document-types/[alias]/page.tsx` | `getDocType()` + governance model | `CODE_GOVERNED` | Read-only workspace for one document type. |
| Data types collection | `app/(backoffice)/backoffice/settings/data-types/page.tsx` | `getFieldKindGovernance()` | `CODE_GOVERNED` | Read-only list of field kinds/property-editor roles. |
| Data type workspace | `app/(backoffice)/backoffice/settings/data-types/[kind]/page.tsx` | `getFieldKindGovernance()` | `CODE_GOVERNED` | Read-only explanation of one field kind. |
| Create policy | `app/(backoffice)/backoffice/settings/create-policy/page.tsx` | Static registry + content API enforcement | `PARTIAL` | Real policy explanation tied to actual API validation, but not a persisted editable policy engine. |
| Schema (combined) | `app/(backoffice)/backoffice/settings/schema/page.tsx` | `backofficeSchemaSettingsModel.ts` | `CODE_GOVERNED` | Combined read-model, not a database-backed schema manager. |
| Governance insights | `app/(backoffice)/backoffice/settings/governance-insights/page.tsx`, `/api/backoffice/content/governance-usage` | Runtime scan of `content_page_variants.body` | `ACTIVE` | This is one of the few settings/governance surfaces that reads real runtime content posture. |
| Management read | `app/(backoffice)/backoffice/settings/management-read/page.tsx`, `/api/backoffice/content/governance-registry` | Static code registry exported as JSON | `CODE_GOVERNED` | Read-only “management API” analogue. |
| System & drift | `app/(backoffice)/backoffice/settings/system/page.tsx`, `/api/backoffice/settings` | `system_settings` runtime row | `RUNTIME_TRUTH` | Real runtime/system settings surface, but save path leaks to `/api/superadmin/system`. |

## Which Files Actually Control Governance
| Control area | Owning files | Actual behavior | Class |
|---|---|---|---|
| Document types | `lib/cms/contentDocumentTypes.ts`, document-type settings pages, content create/save flows | Defines aliases, allowed children, allowed block types | `CODE_GOVERNED` |
| Data types / property editor kinds | `lib/cms/backofficeSchemaSettingsModel.ts`, `app/(backoffice)/backoffice/content/_components/blockFieldSchemas.ts`, `SchemaDrivenBlockForm.tsx` | Defines field kinds and renders block edit UI | `CODE_GOVERNED` |
| Block allowlist | `lib/cms/blockAllowlistGovernance.ts`, content page save routes | Enforces allowed block types based on envelope document type | `ACTIVE` |
| Create restrictions | `contentDocumentTypes.ts`, `ContentWorkspaceCreatePanel.tsx`, `app/api/backoffice/content/pages/route.ts` | Filters create flow and enforces allowed child types on save/create | `PARTIAL` |
| Governance usage scanning | `/api/backoffice/content/governance-usage`, `governance-insights/page.tsx` | Reads variant bodies, legacy/governed posture, allowlist violations | `ACTIVE` |
| Governance registry export | `/api/backoffice/content/governance-registry`, `backofficeSchemaSettingsModel.ts` | Exposes code-governed registry as JSON | `CODE_GOVERNED` |
| AI governance | `app/(backoffice)/backoffice/ai-control/**`, `app/api/backoffice/ai/**`, `lib/ai/**` | Control-plane and runtime AI behavior live outside Settings proper | `SUPPORTING` |
| Page / global / design policy | `ContentWorkspace.tsx`, `ContentWorkspacePageEditorShell.tsx`, `ContentWorkspacePropertiesRail.tsx`, Bellissima workspace model | Managed inside the content editor rather than in a standalone settings domain | `PARTIAL` |

## What Is Actually First-Class
- Settings is a real backoffice section with real collections and workspaces.
- Governance usage is real runtime scanning, not brochure copy.
- System settings is a real runtime-backed surface.
- Block allowlist validation is real and enforced in save/create APIs.

## What Only Looks First-Class
- Document types are not persisted managed entities.
- Data types are not editable property editor objects.
- Create policy is not a stored management model.
- Management read is not a full Management API platform; it is a JSON export of code truth.
- Page/global/design policy is still editor-owned state rather than separate management objects.

## Governance Judgment
Settings is not fake. The mistake is to treat it as completed Umbraco-style management parity. The truth is harsher: it is a real management section whose strongest surfaces are runtime scan and code-registry explanation, while the deeper type-system and property-editor layers remain `CODE_GOVERNED` and structurally thin.
