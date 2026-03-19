/**
 * useContentWorkspaceSave invariants (pure helpers):
 * - nextSaveState enforces a one-way state machine
 * - shouldScheduleAutosave matches effect guard conditions
 */

// @ts-nocheck

import { describe, test, expect } from "vitest";

import {
  nextSaveState,
  shouldScheduleAutosave,
  type AutosaveDecisionParams,
} from "@/app/(backoffice)/backoffice/content/_components/useContentWorkspaceSave";

describe("useContentWorkspaceSave – nextSaveState", () => {
  const allStates = [
    "idle",
    "dirty",
    "saving",
    "saved",
    "offline",
    "conflict",
    "error",
  ] as const;

  test("idle only transitions to dirty or offline", () => {
    for (const next of allStates) {
      const out = nextSaveState("idle", next);
      if (next === "dirty" || next === "offline") {
        expect(out).toBe(next);
      } else {
        expect(out).toBe("idle");
      }
    }
  });

  test("saving can only become saved, conflict, error or offline", () => {
    for (const next of allStates) {
      const out = nextSaveState("saving", next);
      if (next === "saved" || next === "conflict" || next === "error" || next === "offline") {
        expect(out).toBe(next);
      } else {
        expect(out).toBe("saving");
      }
    }
  });

  test("saved can only go back to dirty or idle", () => {
    for (const next of allStates) {
      const out = nextSaveState("saved", next);
      if (next === "dirty" || next === "idle") {
        expect(out).toBe(next);
      } else {
        expect(out).toBe("saved");
      }
    }
  });

  test("conflict can only be cleared back to idle", () => {
    for (const next of allStates) {
      const out = nextSaveState("conflict", next);
      if (next === "idle") {
        expect(out).toBe("idle");
      } else {
        expect(out).toBe("conflict");
      }
    }
  });
});

describe("useContentWorkspaceSave – shouldScheduleAutosave", () => {
  function base(overrides: Partial<AutosaveDecisionParams> = {}): AutosaveDecisionParams {
    return {
      dirty: true,
      pageNotFound: false,
      selectedId: "page-1",
      detailLoading: false,
      hasConflict: false,
      isOffline: false,
      page: {
        id: "page-1",
        title: "T",
        slug: "t",
        body: {},
        status: "draft",
        created_at: null,
        updated_at: null,
        published_at: null,
      },
      detailError: null,
      saveState: "idle",
      skipNext: false,
      ...overrides,
    };
  }

  test("returns true only when all preconditions are met", () => {
    expect(shouldScheduleAutosave(base())).toBe(true);
  });

  test("returns false when not dirty", () => {
    expect(
      shouldScheduleAutosave(
        base({
          dirty: false,
        }),
      ),
    ).toBe(false);
  });

  test("returns false when page is missing or not found", () => {
    expect(
      shouldScheduleAutosave(
        base({
          pageNotFound: true,
        }),
      ),
    ).toBe(false);
    expect(
      shouldScheduleAutosave(
        base({
          page: null,
        }),
      ),
    ).toBe(false);
  });

  test("returns false when loading, in conflict, offline or on error", () => {
    expect(
      shouldScheduleAutosave(
        base({
          detailLoading: true,
        }),
      ),
    ).toBe(false);
    expect(
      shouldScheduleAutosave(
        base({
          hasConflict: true,
        }),
      ),
    ).toBe(false);
    expect(
      shouldScheduleAutosave(
        base({
          isOffline: true,
        }),
      ),
    ).toBe(false);
    expect(
      shouldScheduleAutosave(
        base({
          detailError: "fail",
        }),
      ),
    ).toBe(false);
  });

  test("returns false when saveState is not idle or saved", () => {
    expect(
      shouldScheduleAutosave(
        base({
          saveState: "saving",
        }),
      ),
    ).toBe(false);
    expect(
      shouldScheduleAutosave(
        base({
          saveState: "error",
        }),
      ),
    ).toBe(false);
  });

  test("returns false when skipNext flag is set", () => {
    expect(
      shouldScheduleAutosave(
        base({
          skipNext: true,
        }),
      ),
    ).toBe(false);
  });
});

