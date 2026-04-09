# U31R Editor UX Fix Scope

| Problem to fix now | Owning files | Measurable improvement after U31R |
| --- | --- | --- |
| Global topbar and section framing feel too tight and too flat. | `app/(backoffice)/backoffice/_shell/BackofficeShell.tsx`, `app/(backoffice)/backoffice/_shell/TopBar.tsx`, `app/(backoffice)/backoffice/_shell/SectionShell.tsx`, `lib/cms/backofficeExtensionRegistry.ts` | Sections read as first-class context, module row is calmer, and content/settings/runtime are not competing in the same visual layer. |
| Content tree is not strong enough as the primary navigation. | `app/(backoffice)/backoffice/content/_workspace/ContentWorkspaceLayout.tsx`, `app/(backoffice)/backoffice/content/_tree/ContentTree.tsx`, `app/(backoffice)/backoffice/_shell/SectionShell.tsx` | Tree column is visibly broader, degraded tree states are explicit, and the section overview/editor relationship is easier to understand. |
| Editor canvas has too much card-in-card noise. | `app/(backoffice)/backoffice/content/_components/ContentWorkspaceWorkspaceShell.tsx`, `app/(backoffice)/backoffice/content/_components/ContentWorkspaceMainCanvas.tsx`, `app/(backoffice)/backoffice/content/_components/ContentWorkspaceChrome.tsx` | Fewer nested surfaces, larger calm editing area, and one clearer content-work zone. |
| Preview is too small and too visually secondary. | `app/(backoffice)/backoffice/content/_components/ContentWorkspaceWorkspaceShell.tsx`, `app/(backoffice)/backoffice/content/_components/ContentWorkspaceMainCanvas.tsx`, `app/(backoffice)/backoffice/content/_components/ContentWorkspaceEditorModeStrip.tsx` | Preview column becomes materially larger, preview status is easier to see, and preview mode reads as a true secondary surface instead of a narrow sidecard. |
| Inspector is too dense and poorly grouped. | `app/(backoffice)/backoffice/content/_components/RightPanel.tsx`, `app/(backoffice)/backoffice/content/_components/ContentWorkspacePropertiesRail.tsx`, `app/(backoffice)/backoffice/content/_components/ContentWorkspaceAuditTimeline.tsx` | Inspector content is grouped into clearer sections, secondary text is reduced, and history/runtime signals stop competing with core content editing. |
| Publish, history, runtime info, and footer signals are too spread out. | `app/(backoffice)/backoffice/content/_components/ContentWorkspaceHeaderChrome.tsx`, `app/(backoffice)/backoffice/content/_components/ContentWorkspacePublishBar.tsx`, `app/(backoffice)/backoffice/content/_components/ContentWorkspaceHistoryView.tsx`, `components/backoffice/BackofficeWorkspaceFooterApps.tsx` | One clearer action/header zone at the top, one calmer status/footer zone at the bottom, and history/audit posture becomes easier to scan. |
| Settings does not feel like a true first-class section. | `app/(backoffice)/backoffice/settings/layout.tsx`, `app/(backoffice)/backoffice/settings/page.tsx`, `app/(backoffice)/backoffice/settings/_components/SettingsSectionChrome.tsx`, `components/backoffice/SettingsCollectionShell.tsx` | Settings becomes a clear collection -> workspace flow with stronger section framing and honest code-governed messaging. |

## Explicitly Out of Scope

- No new tree engine.
- No new editor engine.
- No fake CRUD in settings.
- No auth or middleware redesign.
- No new audit/history subsystem.
