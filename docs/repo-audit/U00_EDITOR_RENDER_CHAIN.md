# U00 Editor Render Chain

## Canonical Route -> Host -> Workspace Chain
| Layer | File | Responsibility | Mounted by | State owner | Runtime importance | Notes |
|---|---|---|---|---|---|---|
| Backoffice gate | `app/(backoffice)/backoffice/layout.tsx` | Superadmin gate and shell handoff | App Router | Server layout/auth context | `RUNTIME_TRUTH` | Keeps content/settings inside the backoffice plane. |
| Content section layout | `app/(backoffice)/backoffice/content/layout.tsx` | Creates Bellissima workspace provider and host | Backoffice layout | `ContentBellissimaWorkspaceProvider` | `ACTIVE` | Canonical entry into content section state-sharing. |
| Bellissima provider | `components/backoffice/ContentBellissimaWorkspaceContext.tsx` | Stores snapshot/model and exposes publish/setActiveView | Content layout | Context state | `ACTIVE` | Shared workspace truth for header/footer/actions. |
| Canonical host | `app/(backoffice)/backoffice/content/_workspace/ContentWorkspaceHost.tsx` | Tree + header + footer + section/entity route interpretation | Content layout | Host local state + Bellissima publisher | `ACTIVE` | This is the real section shell. |
| Section shell | `app/(backoffice)/backoffice/_shell/SectionShell.tsx` | Two-column tree/workspace framing | Content host | Layout only | `ACTIVE` | Tree stays mounted while workspaces change. |
| Tree navigation | `app/(backoffice)/backoffice/content/_tree/ContentTree.tsx` | Fetches tree, routes selection, node actions, degraded tree UX | Content host | Internal client state + `/api/backoffice/content/tree` | `ACTIVE` | Primary navigation, not a secondary sidebar. |
| Header chrome | `components/backoffice/BellissimaWorkspaceHeader.tsx` | Workspace title, chips, entity actions, view tabs | Content host | Bellissima model | `ACTIVE` | Consumes published snapshot; does not own editor data. |
| Footer apps | `components/backoffice/BackofficeWorkspaceFooterApps.tsx` | Persistent workspace status strip and shortcuts | Content host | Bellissima model | `ACTIVE` | Shows publish/save/history/governance/runtime context. |
| Section landing route | `app/(backoffice)/backoffice/content/page.tsx` | Section overview route | App Router under content layout | `ContentSectionLanding` client state | `ACTIVE` | Not the editor; it is the content landing/control point. |
| Section landing view | `app/(backoffice)/backoffice/content/_workspace/ContentSectionLanding.tsx` | Recent pages, create action, section snapshot | `content/page.tsx` | Local client state + section Bellissima snapshot | `ACTIVE` | Confirms `/backoffice/content` is a landing, not entity workspace. |
| Entity route | `app/(backoffice)/backoffice/content/[id]/page.tsx` | UUID editor route, slug resolve/redirect, fail-closed missing-page path | App Router under content layout | Route params/search params | `ACTIVE` | Entry point for page workspaces. |
| Entity editor wrapper | `app/(backoffice)/backoffice/content/_workspace/ContentEditor.tsx` | Thin bridge into `ContentWorkspace` | `[id]/page.tsx` | `ContentWorkspace` | `ACTIVE` | No parallel state here. |
| Monolithic orchestrator | `app/(backoffice)/backoffice/content/_components/ContentWorkspace.tsx` | Loads page data, blocks, preview state, governance, AI, modals, publish/save state | `ContentEditor` | Large local React state + multiple hooks | `ACTIVE` | Canonical editor brain and biggest structural hotspot. |
| Page editor shell | `app/(backoffice)/backoffice/content/_components/ContentWorkspacePageEditorShell.tsx` | Chooses entity workspace view and mount strategy | `ContentWorkspace` | Props from `ContentWorkspace` | `ACTIVE` | Central routing/composition inside the entity workspace. |
| Editor mount router | `app/(backoffice)/backoffice/content/_components/ContentWorkspaceEditorMountRouter.tsx` | Chooses Editor2 vs tri-pane mount | `ContentWorkspacePageEditorShell` | Props only | `TRANSITIONAL` | `Editor2` remains placeholder-only; tri-pane is the live path. |
| Tri-pane mount | `app/(backoffice)/backoffice/content/_components/ContentWorkspaceTriPaneMount.tsx` | Mounts chrome + auxiliary shell | Editor mount router | Props only | `ACTIVE` | Canonical live editor mount. |
| Editor chrome | `app/(backoffice)/backoffice/content/_components/ContentWorkspaceChrome.tsx` | Assembles topbar/publish bar/tri-pane section | Tri-pane mount | Props only | `ACTIVE` | Thin composition layer around live editor surfaces. |
| Header topbar row | `app/(backoffice)/backoffice/content/_components/ContentWorkspaceHeaderChrome.tsx` -> `ContentTopbar.tsx` | Status, route awareness, preview/history/support affordances | Editor chrome | Props from workspace | `ACTIVE` | Dense but real top-of-workspace chrome. |
| Save/publish row | `app/(backoffice)/backoffice/content/_components/ContentWorkspacePublishBar.tsx` -> `ContentSaveBar.tsx` | Save/publish controls and history summary | Editor chrome | Props from workspace + Bellissima model | `ACTIVE` | Real persistence controls. |
| Tri-pane content section | `app/(backoffice)/backoffice/content/_components/ContentWorkspaceTriPaneSection.tsx` | Left/editor/right column composition | Editor chrome | Props only | `ACTIVE` | Main editor visual skeleton. |
| Main canvas | `app/(backoffice)/backoffice/content/_components/ContentWorkspaceMainCanvas.tsx` | Block canvas, live preview pane, block toolbar, history preview wiring | Tri-pane section | Props from workspace | `ACTIVE` | Core authoring surface. |
| Right rail | `app/(backoffice)/backoffice/content/_components/RightPanel.tsx` | Inspector container for `workspaceSlot` tabs/sections | Tri-pane section | Props only | `ACTIVE` | Hosts properties/governance/AI/runtime context. |
| Properties rail | `app/(backoffice)/backoffice/content/_components/ContentWorkspacePropertiesRail.tsx` | Page/global/design/document-type controls | Tri-pane section through `RightPanel` | Props from workspace | `ACTIVE` | Real inspector, but still mixed-scope and noisy. |
| Modal shell | `app/(backoffice)/backoffice/content/_components/ContentWorkspaceModalShell.tsx` | Modal-stack + onboarding/pitch overlays | `ContentWorkspace` | Props only | `ACTIVE` | Canonical modal mount. |
| Modal stack | `app/(backoffice)/backoffice/content/_components/ContentWorkspaceModalStack.tsx` | Add/edit/picker/media/full-page-AI modal rendering | Modal shell | Props only | `ACTIVE` | Centralizes editor modals. |
| Dedicated draft preview route | `app/(backoffice)/backoffice/preview/[id]/page.tsx` | Full-page draft preview using public render pipeline | Backoffice router | Server route state | `ACTIVE` | Separate route, same renderer, preview-only variant. |

## Editor Open Dependencies
| Dependency type | Exact dependency | Why it is needed on open |
|---|---|---|
| Tree data | `GET /api/backoffice/content/tree` | Left navigation, virtual roots, degraded schema hints. |
| Page listing / create | `GET/POST /api/backoffice/content/pages` | Section landing, create flow, recent pages, parent/child validation. |
| Page detail / save | `GET/PATCH /api/backoffice/content/pages/[id]` | Loads selected entity and persists body/title/slug/document-type changes. |
| Published-body compare | `GET /api/backoffice/content/pages/[id]/published-body` | Preview diff and publish-state cues. |
| Audit/history | `GET /api/backoffice/content/audit-log` | History/runtime posture inside workspace. |
| Preview route | `/backoffice/preview/[id]` | Full-page draft review outside inline preview panel. |
| Governance usage | `GET /api/backoffice/content/governance-usage` | Settings/governance insight, legacy scanning, allowlist posture. |
| Governance registry | `GET /api/backoffice/content/governance-registry` | Read-only management registry export. |
| Releases | `/api/backoffice/releases/**` | Publish orchestration and release execution state. |
| Media | `/api/backoffice/media/**` | Asset selection in block/page editors. |
| AI capability/status | `/api/backoffice/ai/**` | Editor assistive flows, not primary schema truth. |

## Render Chain Judgment
The render chain is real, layered, and more Bellissima-like than the repo's older docs imply. The problem is not missing structure. The problem is that too much editor responsibility still collapses back into `ContentWorkspace.tsx` once the route reaches entity mode.
