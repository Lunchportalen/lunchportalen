/**
 * useContentWorkspaceAi helpers:
 * - shouldStartAiAction enforces simple "one action at a time" rule.
 */

// @ts-nocheck

import { describe, test, expect } from "vitest";

import { shouldStartAiAction } from "@/app/(backoffice)/backoffice/content/_components/useContentWorkspaceAi";

describe("useContentWorkspaceAi – shouldStartAiAction", () => {
  test("allows action when no tool is busy", () => {
    expect(shouldStartAiAction(null, "content.maintain.page")).toBe(true);
    expect(shouldStartAiAction(undefined as any, "seo.optimize.page")).toBe(true);
  });

  test("blocks any new action while another is busy", () => {
    expect(shouldStartAiAction("content.maintain.page", "seo.optimize.page")).toBe(
      false,
    );
    expect(shouldStartAiAction("landing.generate.sections", "landing.generate.sections")).toBe(
      false,
    );
  });
});

