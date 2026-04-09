# U00R2 Editor Render Chain

## Canonical Route -> Host -> Workspace Chain
| Layer | File | Responsibility | Mounted by | State owner | Runtime importance | Parity class | Notes |
|---|---|---|---|---|---|---|---|
| Backoffice gate | `app/(backoffice)/backoffice/layout.tsx` | Superadmin gate and shell handoff | App Router | Server layout/auth context | `RUNTIME_TRUTH` | `PARTIAL` | Real server-side boundary into backoffice. |
| Content section layout | `app/(backoffice)/backoffice/content/layout.tsx` | Creates Bellissima provider and canonical host | Backoffice layout | `ContentBellissimaWorkspaceProvider` | `ACTIVE` | `PARTIAL` | Real section entry into shared workspace state. |
| Bellissima provider | `components/backoffice/ContentBellissimaWorkspaceContext.tsx` | Publishes snapshot/model and active view | Content layout | Context state | `ACTIVE` | `PARTIAL` | Actual workspace-context analogue. |
| Canonical host | `app/(backoffice)/backoffice/content/_workspace/ContentWorkspaceHost.tsx` | Tree + header + footer + route interpretation | Content layout | Host state + Bellissima publisher | `ACTIVE` | `PARTIAL` | Real section/entity workspace host. |
| Backoffice shell | `app/(backoffice)/backoffice/_shell/BackofficeShell.tsx` | Top bar, command palette, context strip, outer glass shell | Backoffice layout | Layout only | `ACTIVE` | `UX_PARITY_ONLY` | Adds stacked chrome before the actual content workspace. |
| Section shell | `app/(backoffice)/backoffice/_shell/SectionShell.tsx` | Tree/workspace split layout | Content host | Layout only | `ACTIVE` | `PARTIAL` | Keeps tree mounted while workspaces change. |
| Tree navigation | `app/(backoffice)/backoffice/content/_tree/ContentTree.tsx` | Tree fetch, selection, node actions, degraded-tree UX | Content host | Client tree state + `/api/backoffice/content/tree` | `ACTIVE` | `PARTIAL` | Primary navigation, not a helper sidebar. |
| Header chrome | `components/backoffice/BellissimaWorkspaceHeader.tsx` | Workspace title, chips, entity actions, workspace view tabs | Content host | Bellissima model | `ACTIVE` | `PARTIAL` | Consumes shared snapshot; does not own content state. |
| Footer apps | `components/backoffice/BackofficeWorkspaceFooterApps.tsx` | Persistent status strip, footer apps, secondary shortcuts | Content host | Bellissima model | `ACTIVE` | `UX_PARITY_ONLY` | Strongest visual Bellissima echo; still downstream of runtime truth. |
| Section landing route | `app/(backoffice)/backoffice/content/page.tsx` | Section overview route | App Router | `ContentSectionLanding` local state | `ACTIVE` | `PARTIAL` | `/backoffice/content` is not the entity editor. |
| Section landing workspace | `app/(backoffice)/backoffice/content/_workspace/ContentSectionLanding.tsx` | Recent pages, create CTA, section-level workspace snapshot | `content/page.tsx` | Local state + Bellissima snapshot | `ACTIVE` | `PARTIAL` | Collection-like entry, but not a full collection-view runtime. |
| Entity route | `app/(backoffice)/backoffice/content/[id]/page.tsx` | UUID route, slug resolve, fail-closed missing-page path | App Router | Route state | `ACTIVE` | `PARTIAL` | Route-level entry into entity workspace. |
| Entity editor wrapper | `app/(backoffice)/backoffice/content/_workspace/ContentEditor.tsx` | Thin bridge into editor orchestrator | `[id]/page.tsx` | `ContentWorkspace` | `ACTIVE` | `PARTIAL` | No parallel truth here. |
| Monolithic orchestrator | `app/(backoffice)/backoffice/content/_components/ContentWorkspace.tsx` | Loads page, blocks, preview, governance, AI, modals, publish state | `ContentEditor` | Large local React state | `ACTIVE` | `STRUCTURAL_GAP` | Canonical editor brain and biggest structural hotspot. |
| Page editor shell | `app/(backoffice)/backoffice/content/_components/ContentWorkspacePageEditorShell.tsx` | Chooses entity workspace view and mount strategy | `ContentWorkspace` | Props from orchestrator | `ACTIVE` | `PARTIAL` | Real workspace-view switcher. |
| Mount router | `app/(backoffice)/backoffice/content/_components/ContentWorkspaceEditorMountRouter.tsx` | Chooses live tri-pane vs placeholder branch | Page editor shell | Props only | `TRANSITIONAL` | `TRANSITIONAL` | `Editor2` branch is still placeholder-only. |
| Tri-pane mount | `app/(backoffice)/backoffice/content/_components/ContentWorkspaceTriPaneMount.tsx` | Mounts live entity editor shell | Mount router | Props only | `ACTIVE` | `PARTIAL` | Canonical live entity mount. |
| Topbar row | `app/(backoffice)/backoffice/content/_components/ContentTopbar.tsx` | Status, support, retry/reload, publish cues | Workspace chrome | Props from orchestrator | `ACTIVE` | `PARTIAL` | Dense but real operator chrome. |
| Save/publish row | `app/(backoffice)/backoffice/content/_components/ContentSaveBar.tsx` | Save, publish, preview actions | Workspace chrome | Bellissima actions + workspace props | `ACTIVE` | `PARTIAL` | Closest analogue to workspace actions. |
| Main canvas | `app/(backoffice)/backoffice/content/_components/ContentWorkspaceMainCanvas.tsx` | Block canvas, reorder, inline preview, history preview, design targeting | Tri-pane section | Props from orchestrator | `ACTIVE` | `PARTIAL` | Core authoring surface and strongest preview coupling point. |
| Right rail | `app/(backoffice)/backoffice/content/_components/RightPanel.tsx` | Inspector tab shell for workspace/AI/runtime | Tri-pane section | Local tab state | `ACTIVE` | `PARTIAL` | Keeps AI/runtime separate, but still stacks too much into one rail. |
| Properties rail | `app/(backoffice)/backoffice/content/_components/ContentWorkspacePropertiesRail.tsx` | Document type, page/global/design, SEO, scripts, advanced controls | Right rail | Props from orchestrator | `ACTIVE` | `PARTIAL` | Real inspector; mixed scope remains a workflow problem. |
| Modal stack | `app/(backoffice)/backoffice/content/_components/ContentWorkspaceModalStack.tsx` | Block add/edit/picker/media/AI modals | `ContentWorkspace` | Props only | `ACTIVE` | `PARTIAL` | Centralizes modal mounting, not discovery truth. |
| Dedicated preview route | `app/(backoffice)/backoffice/preview/[id]/page.tsx` | Full-page draft preview using public render pipeline | Backoffice router | Route state | `ACTIVE` | `PARTIAL` | Real preview route; increases preview plurality. |

## Editor Open Dependencies
| Dependency type | Exact dependency | Why it is needed on open |
|---|---|---|
| Tree data | `GET /api/backoffice/content/tree` | Left navigation, virtual roots, degraded schema hints. |
| Page list and create | `GET/POST /api/backoffice/content/pages` | Section landing, recent pages, create flow, parent/child validation. |
| Page detail and save | `GET/PATCH /api/backoffice/content/pages/[id]` | Loads selected entity and persists title/slug/body/document-type changes. |
| Published-body compare | `GET /api/backoffice/content/pages/[id]/published-body` | Preview diff and publish-state cues. |
| Audit/history | `GET /api/backoffice/content/audit-log` | History/runtime posture in history view and footer chips. |
| Governance usage | `GET /api/backoffice/content/governance-usage` | Settings/governance insight, legacy scan, allowlist posture. |
| Governance registry | `GET /api/backoffice/content/governance-registry` | Read-only management registry export. |
| Releases | `/api/backoffice/releases/**` | Release orchestration and publish scheduling state. |
| Media | `/api/backoffice/media/**` | Asset selection in block/page editors. |
| AI capability/status | `/api/backoffice/ai/**` | Assistive flows, not schema truth. |
| Global settings | `GET/POST /api/content/global/settings` | Used by `PreviewCanvas.tsx`, `GlobalDesignSystemSection.tsx`, and `SocialGrowthLocationSection.tsx` for global/design overlays and preview fidelity. |
| Preview route | `/backoffice/preview/[id]` | Full-page draft review outside inline preview. |

## Render Chain Judgment
The render chain is real, layered, and materially Bellissima-inspired. The weakness is not absence of structure. The weakness is that once the route reaches entity mode, too much truth still collapses back into `ContentWorkspace.tsx`, while shell chrome, preview surfaces, and inspector scopes remain more numerous than the underlying workspace model can cleanly carry.
