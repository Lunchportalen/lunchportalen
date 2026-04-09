# Phase 2A — AI in CMS (UI / IA only)

## Scope

- **No** new AI routes, orchestrators, or operational truth.
- **No** changes to employee Week or external AI surfaces.

## Current IA (unchanged structure)

- **Right rail** (`ContentWorkspaceRightRail`): builds `aiSlot` | `diagnoseSlot` | `ceoSlot` from existing panels (`EditorAiPanel`, `EditorCopilotRail`, growth/autonomy panels, etc.).
- Intro card **«AI i CMS»** already explains scope (layout, drafts, improvements for the current page).

## 2A / V3 change

- **`aiSlot` wrapper** (`buildContentWorkspaceRightRailSlots`):
  - `role="region"`
  - `aria-label="AI i CMS — generering og innsikt"`
- **V3 intro card:** glass (`bg-white/70`, `backdrop-blur-md`) + subtil rosa kant (`border-pink-500/15`) — skiller AI-hintflate fra øvrig workspace uten ny logikk.

This improves:

- Screen reader landmark for the AI stack.
- Clear boundary between AI tools and the rest of the workspace without moving buttons or changing copy.
- Visuell «command surface» i tråd med neon-regelen (accent, ikke base).

## Future (not 2A)

- Optional: visible subheadings between “quick generate” vs “intent / page builder” blocks — only if user testing shows confusion; would be copy/layout only.
