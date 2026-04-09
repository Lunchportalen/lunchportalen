# U32 - Preview and inspector runtime

- Title: U32 preview and inspector rebalance
- Scope: `app/(backoffice)/backoffice/content/_components/ContentWorkspaceWorkspaceShell.tsx`, `app/(backoffice)/backoffice/content/_components/ContentWorkspaceMainCanvas.tsx`, `app/(backoffice)/backoffice/content/_components/RightPanel.tsx`, and related content editor shell composition.
- Repro:
  1. Open a content detail workspace in edit mode.
  2. Compare preview width, right-rail grouping, and overall editor noise with the pre-U32 shell.
  3. Observe that preview/inspector posture is still vulnerable to feeling like one long wall of mixed concerns.
- Expected: preview is calmer and wider, while inspector/runtime surfaces are grouped intentionally.
- Actual: the shell was improved earlier, but the experience still needed clearer grouping and calmer proportions to match the new host/context model.
- Root cause: preview and inspector were still carrying legacy proportions and mixed labeling from before the canonical host/action model was in place.
- Fix: widen the canonical tri-pane shell, widen the preview split, clarify the inspector tabs, and explicitly group workspace concerns rather than leaving them as a diffuse wall.
- Verification:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build:enterprise`

## What changed

- `ContentWorkspaceWorkspaceShell.tsx`
  - increased the minimum workspace height
  - widened the left and right rails
  - preserved one canonical tri-pane shell instead of creating a new editor layout
- `ContentWorkspaceMainCanvas.tsx`
  - widened the preview split in edit mode
  - clarified that the editor column is the canonical content ordering surface
- `RightPanel.tsx`
  - clarified inspector/runtime language
  - added calmer grouping chips for Innhold, Design, SEO, and Governance
  - kept AI and runtime as deliberate alternate surfaces instead of mixed inline noise

## Measurable U32 outcome

- Preview is wider than before in split mode.
- Inspector posture is more clearly sectioned.
- Runtime/history noise is more deliberately isolated.
- The editor shell is calmer without losing existing capabilities.
