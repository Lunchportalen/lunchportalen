/**
 * View-model-typer for høyre-rail (AI / diagnose / CEO) — én flat bindingflate til `buildContentWorkspaceRightRailSlots`.
 * Ingen hooks, ingen domene-logikk.
 */

import type { ContentWorkspaceRightRailSlotsProps } from "./ContentWorkspaceRightRail";

/** Alle felt som trengs for å bygge `ContentWorkspaceRightRailSlotsProps` (flat pass-through fra ContentWorkspace). */
export type RightRailSlotsWorkspaceParams =
  ContentWorkspaceRightRailSlotsProps["shell"] &
  ContentWorkspaceRightRailSlotsProps["blockNav"] &
  ContentWorkspaceRightRailSlotsProps["cmsAi"] &
  ContentWorkspaceRightRailSlotsProps["pageIntent"] &
  ContentWorkspaceRightRailSlotsProps["editorCmsMenu"] &
  ContentWorkspaceRightRailSlotsProps["panelAi"] &
  ContentWorkspaceRightRailSlotsProps["workspaceAi"] &
  ContentWorkspaceRightRailSlotsProps["diagnose"];
