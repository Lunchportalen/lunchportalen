// tests/cms/ContentWorkspaceLoader.test.ts
// @ts-nocheck

import { describe, test, expect, vi, beforeEach } from "vitest";

import {
  createOnPageLoaded,
  createOnReset,
  createOnPageError,
  createDetailLoadStart,
} from "@/app/(backoffice)/backoffice/content/_components/ContentWorkspaceLoader";

import type {
  PageLoadedData,
  PageErrorPayload,
} from "@/app/(backoffice)/backoffice/content/_components/ContentWorkspaceState";

vi.mock("@/domain/backoffice/ai/metrics/logEditorAiEvent", () => ({
  logEditorAiEvent: vi.fn(),
}));

const { logEditorAiEvent } = await import(
  "@/domain/backoffice/ai/metrics/logEditorAiEvent"
);

describe("ContentWorkspaceLoader – createOnPageLoaded", () => {
  test("applies envelope/title/slug/body to editor and calls applyLoadSuccess with canonical payload", () => {
    const calls: Record<string, unknown>[] = [];

    const setDocumentTypeAlias = vi.fn();
    const setInvariantEnvelopeFields = vi.fn();
    const setCultureEnvelopeFields = vi.fn();
    const setTitle = vi.fn();
    const setSlug = vi.fn();
    const setSlugTouched = vi.fn();
    const applyParsedBody = vi.fn();
    const applyLoadSuccess = vi.fn((payload) => {
      calls.push(payload);
    });

    const onPageLoaded = createOnPageLoaded({
      setDocumentTypeAlias,
      setInvariantEnvelopeFields,
      setCultureEnvelopeFields,
      setTitle,
      setSlug,
      setSlugTouched,
      applyParsedBody,
      applyLoadSuccess,
    });

    const data: PageLoadedData = {
      page: {
        id: "page-1",
        title: "Tittel",
        slug: "slug",
        body: { blocksBody: { blocks: [] } },
        status: "draft",
        created_at: "2026-03-10T10:00:00Z",
        updated_at: "2026-03-11T11:00:00Z",
        published_at: null,
      },
      nextTitle: "Neste tittel",
      nextSlug: "neste-slug",
      envelope: {
        documentType: "page",
        fields: { sk: "inv", intro: "en-intro" },
        invariantFields: { sk: "inv" },
        cultureFields: { intro: "en-intro" },
        blocksBody: { blocks: [{ id: "b1", type: "richText" }] },
      },
      parsedBody: {
        mode: "blocks",
        blocks: [{ id: "b1", type: "richText" } as any],
        meta: { layout: "full" },
        legacyText: "",
        rawBody: '{"blocks":[]}',
        error: null,
      },
      snapshotBody: '{"blocks":[],"meta":{"layout":"full"}}',
      updated_at: "2026-03-11T11:00:00Z",
    };

    onPageLoaded(data);

    expect(setDocumentTypeAlias).toHaveBeenCalledWith("page");
    expect(setInvariantEnvelopeFields).toHaveBeenCalledWith({ sk: "inv" });
    expect(setCultureEnvelopeFields).toHaveBeenCalledWith({ intro: "en-intro" });
    expect(setTitle).toHaveBeenCalledWith("Neste tittel");
    expect(setSlug).toHaveBeenCalledWith("neste-slug");
    expect(setSlugTouched).toHaveBeenCalledWith(false);
    expect(applyParsedBody).toHaveBeenCalledWith(data.parsedBody);

    expect(applyLoadSuccess).toHaveBeenCalledTimes(1);
    const payload = calls[0] as any;
    expect(payload.page.id).toBe("page-1");
    expect(payload.nextTitle).toBe("Neste tittel");
    expect(payload.nextSlug).toBe("neste-slug");
    expect(payload.snapshotBody).toBe(data.snapshotBody);
    expect(payload.updated_at).toBe("2026-03-11T11:00:00Z");
  });
});

describe("ContentWorkspaceLoader – createOnReset", () => {
  test("clears editor fields and save state on reset", () => {
    const setTitle = vi.fn();
    const setSlug = vi.fn();
    const setSlugTouched = vi.fn();
    const setBodyMode = vi.fn();
    const setBlocks = vi.fn();
    const setMeta = vi.fn();
    const setLegacyBodyText = vi.fn();
    const setInvalidBodyRaw = vi.fn();
    const setBodyParseError = vi.fn();
    const setSelectedBlockId = vi.fn();
    const clearSaveStateForReset = vi.fn();

    const reset = createOnReset({
      setTitle,
      setSlug,
      setSlugTouched,
      setBodyMode,
      setBlocks,
      setMeta,
      setLegacyBodyText,
      setInvalidBodyRaw,
      setBodyParseError,
      setSelectedBlockId,
      clearSaveStateForReset,
    });

    reset();

    expect(setTitle).toHaveBeenCalledWith("");
    expect(setSlug).toHaveBeenCalledWith("");
    expect(setSlugTouched).toHaveBeenCalledWith(false);
    expect(setBodyMode).toHaveBeenCalledWith("blocks");
    expect(setBlocks).toHaveBeenCalledWith([]);
    expect(setMeta).toHaveBeenCalledWith({});
    expect(setLegacyBodyText).toHaveBeenCalledWith("");
    expect(setInvalidBodyRaw).toHaveBeenCalledWith("");
    expect(setBodyParseError).toHaveBeenCalledWith(null);
    expect(setSelectedBlockId).toHaveBeenCalledWith(null);
    expect(clearSaveStateForReset).toHaveBeenCalledTimes(1);
  });
});

describe("ContentWorkspaceLoader – createOnPageError", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("clears save state and logs AI event when message present", () => {
    const clearSaveStateOnLoadError = vi.fn();
    const selectedId = "page-1";

    const onPageError = createOnPageError({
      clearSaveStateOnLoadError,
      selectedId,
    });

    const payload: PageErrorPayload = {
      message: "Kunne ikke hente side.",
      isParseLike: false,
    };

    onPageError(payload);

    expect(clearSaveStateOnLoadError).toHaveBeenCalledTimes(1);
    expect(logEditorAiEvent).toHaveBeenCalledTimes(1);
    const args = (logEditorAiEvent as any).mock.calls[0][0];
    expect(args.type).toBe("content_error");
    expect(args.pageId).toBe("page-1");
    expect(args.message).toBe("Kunne ikke hente side.");
    expect(args.kind).toBe("load");
  });

  test("does not log AI event when message is missing", () => {
    const clearSaveStateOnLoadError = vi.fn();
    const selectedId = "page-1";

    const onPageError = createOnPageError({
      clearSaveStateOnLoadError,
      selectedId,
    });

    onPageError({});

    expect(clearSaveStateOnLoadError).toHaveBeenCalledTimes(1);
    expect(logEditorAiEvent).not.toHaveBeenCalled();
  });
});

describe("ContentWorkspaceLoader – createDetailLoadStart", () => {
  test("returns the clearSaveStateOnLoadStart callback as-is", () => {
    const spy = vi.fn();
    const detailLoadStart = createDetailLoadStart(spy);
    detailLoadStart();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

