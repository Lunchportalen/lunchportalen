/**
 * contentWorkspace.helpers invariants:
 * - derivePageStatusDisplay preserves existing status labels and tones
 * - deriveSaveError matches current error-like save states
 * - deriveAiDisabled matches current disabled logic
 */

// @ts-nocheck

import { describe, test, expect } from "vitest";

import {
  derivePageStatusDisplay,
  deriveSaveError,
  deriveAiDisabled,
} from "@/app/(backoffice)/backoffice/content/_components/contentWorkspace.helpers";
import { statusTone } from "@/app/(backoffice)/backoffice/content/_components/useContentSaveStatus";

describe("contentWorkspace.helpers – derivePageStatusDisplay", () => {
  test("published status returns expected chip and info labels", () => {
    const result = derivePageStatusDisplay("published");
    expect(result.chipLabel).toBe("live");
    expect(result.infoLabel).toBe("Publisert");
    expect(result.chipToneClass).toBe(statusTone("published"));
  });

  test("draft status returns expected chip and info labels", () => {
    const result = derivePageStatusDisplay("draft");
    expect(result.chipLabel).toBe("draft");
    expect(result.infoLabel).toBe("Kladd");
    expect(result.chipToneClass).toBe(statusTone("draft"));
  });
});

describe("contentWorkspace.helpers – deriveSaveError", () => {
  const lastError = "Something went wrong";

  test('returns lastError for "error" state', () => {
    expect(deriveSaveError("error", lastError)).toBe(lastError);
  });

  test('returns lastError for "conflict" state', () => {
    expect(deriveSaveError("conflict", lastError)).toBe(lastError);
  });

  test('returns lastError for "offline" state', () => {
    expect(deriveSaveError("offline", lastError)).toBe(lastError);
  });

  test("returns null for non-error save states", () => {
    const nonErrorStates = ["idle", "dirty", "saving", "saved"] as const;
    for (const state of nonErrorStates) {
      expect(deriveSaveError(state, lastError)).toBeNull();
    }
  });
});

describe("contentWorkspace.helpers – deriveAiDisabled", () => {
  test("offline always disables", () => {
    expect(
      deriveAiDisabled({
        isOffline: true,
        effectiveId: "page-1",
        aiCapability: "available",
      }),
    ).toBe(true);
  });

  test("missing effectiveId disables", () => {
    expect(
      deriveAiDisabled({
        isOffline: false,
        effectiveId: null,
        aiCapability: "available",
      }),
    ).toBe(true);
  });

  test("non-available aiCapability disables", () => {
    expect(
      deriveAiDisabled({
        isOffline: false,
        effectiveId: "page-1",
        aiCapability: "loading",
      }),
    ).toBe(true);
    expect(
      deriveAiDisabled({
        isOffline: false,
        effectiveId: "page-1",
        aiCapability: "unavailable",
      }),
    ).toBe(true);
  });

  test("only available + online + id-present returns false", () => {
    expect(
      deriveAiDisabled({
        isOffline: false,
        effectiveId: "page-1",
        aiCapability: "available",
      }),
    ).toBe(false);
  });
});

