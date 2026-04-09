# Phase 2 — AI CMS consolidation (map)

**Goal:** AI is **embedded in the CMS workflow** (editor, SEO, CRO, media), not a scattered set of experiments. **No** new operational truth for employee Week.

## 1. Existing AI surface (inventory — representative)

| Area | Files / entry points | Role |
|------|----------------------|------|
| Editor rails | `ContentWorkspaceRightRail.tsx`, `ContentSidePanel.tsx` | Slots for AI tools |
| Core panels | `EditorAiPanel.tsx`, `EditorAiShell.tsx`, `EditorAiAssistant.tsx`, `EditorAiControlTowerPanel.tsx`, `EditorAiDesignSuggestionsPanel.tsx`, `EditorGrowthAiPanel.tsx`, `EditorDesignAiPanel.tsx`, `EditorAiUnifiedSuggestions.tsx` | Generation, suggestions, growth, design |
| Workspace integration | `ContentWorkspace.tsx`, `useContentWorkspaceAi.ts`, `contentWorkspace.ai.ts`, `contentWorkspace.aiRequests.ts` | Wiring save/patch flows |
| Block-level | `InsertAiBlockModal.tsx`, block inspector AI hooks | Insert / optimize blocks |
| Metrics | `domain/backoffice/ai/metrics/*`, `logEditorAiEvent` | Telemetry |

## 2. API / backend (representative)

- `app/api/ai/**` — multiple routes (audit, block, generate, image, etc.) — **must** stay behind `jsonOk`/`jsonErr` contract per AGENTS.md C3.
- `lib/ai/**` — prompts, design tokens for AI (`lib/ai/designTokens.ts`), generators.

## 3. Consolidation principles (decisions)

1. **Single mental model:** “AI assists the **current page/block** and **saves through the same persistence** as manual edits.”
2. **Persistence proof (future implementation):** After AI apply → user save → reload → same structured content (document in `AI_PERSISTENCE_PROOF_PLAN.md` when implementing).
3. **No new orchestrator** until consolidation map shows one is strictly simpler than N panels (aligns with `PHASE2_DECISIONS.md` D4).
4. **Employee Week:** AI must not become a hidden source for menus or order windows.

## 4. Proposed grouping (UX)

| User-facing bundle | Includes | Notes |
|--------------------|----------|--------|
| **Editor** | Page build, block insert, text, design suggestions | Primary rail / tab |
| **SEO / CRO** | SEO panel, experiments hooks if present | Same chrome, different tab |
| **Growth / social** | Growth panel, ties to `lib/social/*` | Calendar is editorial, not ops |
| **Media** | Image AI landing in media library (Phase 2 stream C) | Same asset store as manual uploads |

## 5. Risks

- **Duplication:** Multiple panels may call similar endpoints — consolidate to shared hooks (`useContentWorkspaceAi` family) before adding features.
- **Cost / latency:** Batch and debounce already partially used (`debounce` in workspace); must stay for RC performance.

## 6. Deliverables (later Phase 2 batches)

- `AI_PERSISTENCE_PROOF_PLAN.md` — test matrix for save/reload parity.
- `AI_EDITOR_EXPERIENCE_PLAN.md` — rail order, empty states, loading, errors.

## 7. Files to treat as high-churn

- `ContentWorkspace.tsx` (large)
- `app/api/ai/**` (contract-sensitive)
- Any middleware or auth — **out of scope** for AI consolidation unless security review

This document is the **map**; implementation waits for `PHASE2_IMPLEMENTATION_SEQUENCE.md` Phase 2A/2B gates.
