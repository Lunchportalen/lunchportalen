/**
 * Editor-AI contract parsing: malformed AI results fail safely (null); valid inputs yield expected shape.
 * Proves request/result contracts and reject path (no patch → no apply).
 */

// @ts-nocheck

import { describe, test, expect } from "vitest";
import {
  parseBackofficeAiJson,
  parseSuggestPayload,
  parseBlockBuilderResponse,
  parseScreenshotBuilderResponse,
  parsePageBuilderResponse,
  parseLayoutSuggestionsResponse,
  parseImageGeneratorResponse,
  parseCapabilityResponse,
  normalizeAiErrorMessage,
} from "@/app/(backoffice)/backoffice/content/_components/editorAiContracts";
import { isAIPatchV1 } from "@/lib/cms/model/aiPatch";

describe("editorAiContracts – parseBackofficeAiJson", () => {
  test("returns null for non-object input", () => {
    expect(parseBackofficeAiJson(null)).toBe(null);
    expect(parseBackofficeAiJson(undefined)).toBe(null);
    expect(parseBackofficeAiJson("")).toBe(null);
    expect(parseBackofficeAiJson([])).toBe(null);
  });

  test("returns ok:true with data for valid success shape", () => {
    const out = parseBackofficeAiJson({ ok: true, data: { summary: "Done" } });
    expect(out).not.toBe(null);
    expect(out?.ok).toBe(true);
    expect((out as any).data).toEqual({ summary: "Done" });
  });

  test("returns ok:false with message for valid error shape", () => {
    const out = parseBackofficeAiJson({ ok: false, error: "RATE_LIMIT", message: "Too many requests" });
    expect(out).not.toBe(null);
    expect(out?.ok).toBe(false);
    expect((out as any).message).toBe("Too many requests");
  });

  test("returns null when ok is neither true nor false", () => {
    expect(parseBackofficeAiJson({ ok: 1 })).toBe(null);
    expect(parseBackofficeAiJson({})).toBe(null);
  });
});

describe("editorAiContracts – parseSuggestPayload", () => {
  test("returns null for non-object or null", () => {
    expect(parseSuggestPayload(null)).toBe(null);
    expect(parseSuggestPayload(undefined)).toBe(null);
    expect(parseSuggestPayload([])).toBe(null);
  });

  test("returns payload with summary only when patch is invalid (no apply)", () => {
    const out = parseSuggestPayload({ summary: "Ferdig.", patch: null });
    expect(out).not.toBe(null);
    expect((out as any).summary).toBe("Ferdig.");
    expect((out as any).patch).toBeUndefined();
  });

  test("returns null patch for malformed patch (fail safe)", () => {
    const out = parseSuggestPayload({ summary: "Ok", patch: { version: 2, ops: [] } });
    expect(out).not.toBe(null);
    expect((out as any).patch).toBeUndefined();
  });

  test("includes valid AIPatchV1 when present", () => {
    const validPatch = { version: 1, ops: [{ op: "updateBlockData", id: "b1", data: { body: "x" } }] };
    const out = parseSuggestPayload({ suggestion: { summary: "Done", patch: validPatch } });
    expect(out).not.toBe(null);
    expect(isAIPatchV1((out as any).patch)).toBe(true);
  });

  test("extracts from data.suggestion when present", () => {
    const out = parseSuggestPayload({ suggestion: { summary: "From suggestion" } });
    expect(out).not.toBe(null);
    expect((out as any).summary).toBe("From suggestion");
  });
});

describe("editorAiContracts – parseBlockBuilderResponse", () => {
  test("returns null for non-object or missing block", () => {
    expect(parseBlockBuilderResponse(null)).toBe(null);
    expect(parseBlockBuilderResponse({})).toBe(null);
    expect(parseBlockBuilderResponse({ block: null })).toBe(null);
    expect(parseBlockBuilderResponse({ block: [] })).toBe(null);
  });

  test("returns block and message for valid shape", () => {
    const out = parseBlockBuilderResponse({ block: { id: "x", type: "hero", data: {} }, message: "Created." });
    expect(out).not.toBe(null);
    expect((out as any).block).toEqual({ id: "x", type: "hero", data: {} });
    expect((out as any).message).toBe("Created.");
  });
});

describe("editorAiContracts – parseScreenshotBuilderResponse", () => {
  test("returns null when blocks missing or empty array", () => {
    expect(parseScreenshotBuilderResponse(null)).toBe(null);
    expect(parseScreenshotBuilderResponse({})).toBe(null);
    expect(parseScreenshotBuilderResponse({ blocks: [] })).toBe(null);
  });

  test("returns blocks and message for valid shape", () => {
    const out = parseScreenshotBuilderResponse({
      blocks: [{ id: "a", type: "hero" }],
      message: "Done",
      warnings: ["One warning"],
    });
    expect(out).not.toBe(null);
    expect((out as any).blocks).toHaveLength(1);
    expect((out as any).message).toBe("Done");
    expect((out as any).warnings).toEqual(["One warning"]);
  });
});

describe("editorAiContracts – parsePageBuilderResponse", () => {
  test("returns null for non-object", () => {
    expect(parsePageBuilderResponse(null)).toBe(null);
    expect(parsePageBuilderResponse(undefined)).toBe(null);
  });

  test("returns result with empty blocks when blocks missing or empty (no invalid apply)", () => {
    const empty = parsePageBuilderResponse({});
    expect(empty).not.toBe(null);
    expect((empty as any).blocks).toEqual([]);
    const emptyArr = parsePageBuilderResponse({ blocks: [] });
    expect(emptyArr).not.toBe(null);
    expect((emptyArr as any).blocks).toEqual([]);
  });

  test("returns blocks with id/type/data for valid items", () => {
    const out = parsePageBuilderResponse({
      blocks: [{ id: "b1", type: "richText", data: { body: "Hi" } }],
      title: "Page",
      summary: "Generated",
    });
    expect(out).not.toBe(null);
    expect((out as any).blocks).toHaveLength(1);
    expect((out as any).blocks[0]).toEqual({ id: "b1", type: "richText", data: { body: "Hi" } });
    expect((out as any).title).toBe("Page");
  });

  test("drops invalid block items and records droppedBlocks", () => {
    const out = parsePageBuilderResponse({
      blocks: [null, { id: "ok", type: "hero", data: {} }],
    });
    expect(out).not.toBe(null);
    expect((out as any).blocks).toHaveLength(1);
    expect((out as any).droppedBlocks).toBeDefined();
    expect((out as any).droppedBlocks.length).toBe(1);
  });
});

describe("editorAiContracts – parseLayoutSuggestionsResponse", () => {
  test("returns null when suggestions missing or empty", () => {
    expect(parseLayoutSuggestionsResponse(null)).toBe(null);
    expect(parseLayoutSuggestionsResponse({})).toBe(null);
    expect(parseLayoutSuggestionsResponse({ suggestions: [] })).toBe(null);
  });

  test("returns suggestions with kind/title/reason for valid shape", () => {
    const out = parseLayoutSuggestionsResponse({
      suggestions: [{ kind: "reorder", title: "Bytt rekkefølge", reason: "Bedre flyt", priority: "high" }],
      message: "Ok",
    });
    expect(out).not.toBe(null);
    expect((out as any).suggestions).toHaveLength(1);
    expect((out as any).suggestions[0].kind).toBe("reorder");
    expect((out as any).suggestions[0].title).toBe("Bytt rekkefølge");
  });
});

describe("editorAiContracts – parseImageGeneratorResponse", () => {
  test("returns null when no prompts or revisedPrompt", () => {
    expect(parseImageGeneratorResponse(null)).toBe(null);
    expect(parseImageGeneratorResponse({})).toBe(null);
    expect(parseImageGeneratorResponse({ prompt: "x" })).toBe(null);
  });

  test("returns prompts from payload or data.prompts", () => {
    const out = parseImageGeneratorResponse({
      prompts: [{ prompt: "Brand-safe hero.", alt: "hero" }],
      revisedPrompt: "Brand-safe hero.",
    });
    expect(out).not.toBe(null);
    expect((out as any).prompts).toHaveLength(1);
    expect((out as any).prompts[0].prompt).toBe("Brand-safe hero.");
    expect((out as any).prompts[0].alt).toBe("hero");
    expect((out as any).revisedPrompt).toBe("Brand-safe hero.");
  });

  test("extracts prompts from envelope data.data", () => {
    const out = parseImageGeneratorResponse({
      ok: true,
      rid: "r1",
      data: { prompts: [{ prompt: "P", alt: "A" }], revisedPrompt: "R" },
    });
    expect(out).not.toBe(null);
    expect((out as any).prompts[0].prompt).toBe("P");
    expect((out as any).revisedPrompt).toBe("R");
  });
});

describe("editorAiContracts – parseCapabilityResponse", () => {
  test("returns null for non-object or missing enabled", () => {
    expect(parseCapabilityResponse(null)).toBe(null);
    expect(parseCapabilityResponse({})).toBe(null);
    expect(parseCapabilityResponse({ enabled: "yes" })).toBe(null);
  });

  test("returns enabled from top-level or data.enabled", () => {
    expect(parseCapabilityResponse({ enabled: true })).toEqual({ enabled: true });
    expect(parseCapabilityResponse({ data: { enabled: false } })).toEqual({ enabled: false });
  });
});

describe("editorAiContracts – normalizeAiErrorMessage", () => {
  test("uses parsed message when present", () => {
    const msg = normalizeAiErrorMessage(500, { ok: false, message: "Server error" }, "Fallback");
    expect(msg).toBe("Server error");
  });

  test("returns fallback when parsed is null or has no message", () => {
    expect(normalizeAiErrorMessage(500, null, "No response")).toBe("No response");
    expect(normalizeAiErrorMessage(500, { ok: false } as any, "Default")).toBe("Default");
  });
});
