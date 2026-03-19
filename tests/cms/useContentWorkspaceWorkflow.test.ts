/**
 * useContentWorkspaceWorkflow helpers:
 * - nextWorkflowSaveState keeps save state consistent after status changes.
 */

// @ts-nocheck

import { describe, test, expect } from "vitest";

import {
  nextWorkflowSaveState,
} from "@/app/(backoffice)/backoffice/content/_components/useContentWorkspaceWorkflow";

describe("useContentWorkspaceWorkflow – nextWorkflowSaveState", () => {
  const states = ["idle", "dirty", "saving", "saved", "offline", "conflict", "error"] as const;

  test("returns dirty when editor has unsaved changes regardless of current saveState", () => {
    for (const s of states) {
      const out = nextWorkflowSaveState(s, true);
      expect(out).toBe("dirty");
    }
  });

  test("returns idle when editor is clean regardless of current saveState", () => {
    for (const s of states) {
      const out = nextWorkflowSaveState(s, false);
      expect(out).toBe("idle");
    }
  });
});

