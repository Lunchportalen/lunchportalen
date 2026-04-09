/**
 * ContentWorkspace stability smoke: no double load, safe empty state, detail effect deps.
 * Ensures selectedId/refetchDetailKey drive detail load only (no loop from callbacks in deps).
 * Canonical dataflow: useContentWorkspaceData (single hook — no parallel page-data hook).
 */
/** @vitest-environment jsdom */
// @ts-nocheck

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement, useRef } from "react";
import { createRoot } from "react-dom/client";
import { useContentWorkspaceData } from "@/app/(backoffice)/backoffice/content/_components/useContentWorkspaceData";

(global as any).React = require("react");

function mkPage(id: string) {
  return {
    id,
    title: "Test",
    slug: "test",
    body: { blocksBody: { blocks: [] } },
    status: "draft",
    created_at: null,
    updated_at: null,
    published_at: null,
  };
}

function createEditorSyncMocks() {
  const skipNextAutosaveScheduleRef = { current: false };
  return {
    setPage: vi.fn(),
    setTitle: vi.fn(),
    setSlug: vi.fn(),
    setSlugTouched: vi.fn(),
    setDocumentTypeAlias: vi.fn(),
    setInvariantEnvelopeFields: vi.fn(),
    setCultureEnvelopeFields: vi.fn(),
    applyParsedBody: vi.fn(),
    setLastServerUpdatedAt: vi.fn(),
    setSaveStateSafe: vi.fn(),
    setLastError: vi.fn(),
    setLastSavedAt: vi.fn(),
    setSavedSnapshot: vi.fn(),
    skipNextAutosaveScheduleRef,
    setOutboxData: vi.fn(),
    setRecoveryBannerVisible: vi.fn(),
    setBodyMode: vi.fn(),
    setBlocks: vi.fn(),
    setMeta: vi.fn(),
    setLegacyBodyText: vi.fn(),
    setInvalidBodyRaw: vi.fn(),
    setBodyParseError: vi.fn(),
    setSelectedBlockId: vi.fn(),
  };
}

function createNavigationMocks(overrides: Record<string, unknown> = {}) {
  return {
    router: { push: vi.fn() },
    routeSelectedId: "",
    loadedPage: null,
    dirty: false,
    isOffline: false,
    clearAutosaveTimer: vi.fn(),
    setPendingNavigationHref: vi.fn(),
    setMainView: vi.fn(),
    ...overrides,
  };
}

async function waitForCondition(
  predicate: () => boolean,
  timeoutMs = 400,
  intervalMs = 10,
): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

describe("ContentWorkspace stability – useContentWorkspaceData", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let setPageMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    setPageMock = vi.fn();
    (global as any).fetch = fetchMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("selectedId empty: no detail fetch (safe empty state)", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true, data: { items: [] } })));
    let result: ReturnType<typeof useContentWorkspaceData> | null = null;

    function TestWrapper() {
      const invariantEnvelopeMirrorRef = useRef<Record<string, unknown>>({});
      const lastLoadedDetailPageIdRef = useRef<string | null>(null);
      const editorSync = createEditorSyncMocks();
      editorSync.setPage = setPageMock;
      result = useContentWorkspaceData({
        query: "",
        selectedId: "",
        setPage: setPageMock,
        navigation: createNavigationMocks(),
        editorSync,
        editorLocale: "nb",
        mergedDocumentTypeDefinitions: null,
        invariantEnvelopeMirrorRef,
        lastLoadedDetailPageIdRef,
      });
      return null;
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    root.render(createElement(TestWrapper));
    await new Promise((r) => setTimeout(r, 50));

    const pageFetches = fetchMock.mock.calls.filter(
      (call: any) =>
        String(call[0]).includes("/api/backoffice/content/pages/") &&
        !String(call[0]).includes("?")
    );
    expect(pageFetches.length).toBe(0);
    expect(result?.detailLoading).toBe(false);
    root.unmount();
    document.body.removeChild(container);
  });

  test("selectedId set: one detail fetch per selectedId (no double load)", async () => {
    const pageId = "test-uuid-1234";
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            data: {
              items: [
                {
                  id: "front-row",
                  title: "Lunchportalen – firmalunsj",
                  slug: "front",
                  status: "draft",
                  updated_at: null,
                },
              ],
            },
          })
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            data: { page: mkPage(pageId) },
          })
        )
      );

    let result: ReturnType<typeof useContentWorkspaceData> | null = null;

    function TestWrapper({ selectedId }: { selectedId: string }) {
      const invariantEnvelopeMirrorRef = useRef<Record<string, unknown>>({});
      const lastLoadedDetailPageIdRef = useRef<string | null>(null);
      const editorSync = createEditorSyncMocks();
      editorSync.setPage = setPageMock;
      result = useContentWorkspaceData({
        query: "",
        selectedId,
        setPage: setPageMock,
        navigation: createNavigationMocks({ routeSelectedId: selectedId }),
        editorSync,
        editorLocale: "nb",
        mergedDocumentTypeDefinitions: null,
        invariantEnvelopeMirrorRef,
        lastLoadedDetailPageIdRef,
      });
      return null;
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    root.render(createElement(TestWrapper, { selectedId: pageId }));
    await new Promise((r) => setTimeout(r, 100));

    const pageFetches = fetchMock.mock.calls.filter(
      (call: any) =>
        String(call[0]).includes(`/api/backoffice/content/pages/${pageId}`) &&
        String(call[0]).includes("environment=preview")
    );
    expect(pageFetches.length).toBe(1);
    root.unmount();
    document.body.removeChild(container);
  });

  test("reset path sets detailLoading false so empty state does not show loading", async () => {
    const pageId = "uuid-for-reset-test";
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            data: {
              items: [
                {
                  id: "front-row",
                  title: "Lunchportalen – firmalunsj",
                  slug: "front",
                  status: "draft",
                  updated_at: null,
                },
              ],
            },
          })
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, data: { page: mkPage(pageId) } }))
      );

    let result: ReturnType<typeof useContentWorkspaceData> | null = null;

    function TestWrapper({ selectedId }: { selectedId: string }) {
      const invariantEnvelopeMirrorRef = useRef<Record<string, unknown>>({});
      const lastLoadedDetailPageIdRef = useRef<string | null>(null);
      const editorSync = createEditorSyncMocks();
      editorSync.setPage = setPageMock;
      result = useContentWorkspaceData({
        query: "",
        selectedId,
        setPage: setPageMock,
        navigation: createNavigationMocks({ routeSelectedId: selectedId }),
        editorSync,
        editorLocale: "nb",
        mergedDocumentTypeDefinitions: null,
        invariantEnvelopeMirrorRef,
        lastLoadedDetailPageIdRef,
      });
      return null;
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    root.render(createElement(TestWrapper, { selectedId: pageId }));
    await waitForCondition(
      () => result?.detailLoading === false && setPageMock.mock.calls.length > 0,
      1000,
    );
    expect(result?.detailLoading).toBe(false);
    expect(setPageMock).toHaveBeenCalledWith(expect.any(Object));

    root.render(createElement(TestWrapper, { selectedId: "" }));
    await waitForCondition(
      () => result?.detailLoading === false && setPageMock.mock.calls.some((call) => call[0] === null),
    );
    expect(result?.detailLoading).toBe(false);
    expect(setPageMock.mock.calls.some((call) => call[0] === null)).toBe(true);

    root.unmount();
    document.body.removeChild(container);
  });
});

describe("ContentWorkspace stability – detail effect deps", () => {
  test("detail effect deps documented to avoid fetch loop", async () => {
    const path = await import("path");
    const fs = await import("fs");
    const p = path.join(process.cwd(), "app", "(backoffice)", "backoffice", "content", "_components", "useContentWorkspaceData.ts");
    const src = fs.readFileSync(p, "utf8");
    expect(src).toContain("[selectedId, refetchDetailKey");
    expect(src).toMatch(/Intentionally omit|would retrigger|fetch loop/i);
  });

  test("detail run-id guard present to avoid stale response apply", async () => {
    const path = await import("path");
    const fs = await import("fs");
    const p = path.join(process.cwd(), "app", "(backoffice)", "backoffice", "content", "_components", "useContentWorkspaceData.ts");
    const src = fs.readFileSync(p, "utf8");
    expect(src).toContain("detailRunIdRef");
    expect(src).toContain("runId !== detailRunIdRef.current");
  });
});
