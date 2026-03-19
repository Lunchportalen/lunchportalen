/**
 * ContentWorkspace stability smoke: no double load, safe empty state, detail effect deps.
 * Ensures selectedId/refetchDetailKey drive detail load only (no loop from callbacks in deps).
 */
/** @vitest-environment jsdom */
// @ts-nocheck

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement, useRef, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { useContentWorkspacePageData } from "@/app/(backoffice)/backoffice/content/_components/useContentWorkspacePageData";
import type { PageLoadedData } from "@/app/(backoffice)/backoffice/content/_components/useContentWorkspacePageData";

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

describe("ContentWorkspace stability – useContentWorkspacePageData", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let setPageMock: ReturnType<typeof vi.fn>;
  let onPageLoadedMock: ReturnType<typeof vi.fn>;
  let onResetMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    setPageMock = vi.fn();
    onPageLoadedMock = vi.fn();
    onResetMock = vi.fn();
    (global as any).fetch = fetchMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("selectedId empty: no detail fetch (safe empty state)", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true, data: { items: [] } })));
    let result: ReturnType<typeof useContentWorkspacePageData> | null = null;

    function TestWrapper() {
      const pageLoadedRef = useRef(onPageLoadedMock);
      const resetRef = useRef(onResetMock);
      pageLoadedRef.current = onPageLoadedMock;
      resetRef.current = onResetMock;
      result = useContentWorkspacePageData({
        selectedId: "",
        query: "",
        setPage: setPageMock,
        onPageLoaded: (data: PageLoadedData) => pageLoadedRef.current(data),
        onReset: () => resetRef.current(),
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
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, data: { items: [] } })))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            data: { page: mkPage(pageId) },
          })
        )
      );

    let result: ReturnType<typeof useContentWorkspacePageData> | null = null;
    const pageLoadedRef = { current: vi.fn() };
    const resetRef = { current: vi.fn() };

    function TestWrapper({ selectedId }: { selectedId: string }) {
      result = useContentWorkspacePageData({
        selectedId,
        query: "",
        setPage: setPageMock,
        onPageLoaded: (data: PageLoadedData) => pageLoadedRef.current(data),
        onReset: () => resetRef.current(),
      });
      return null;
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    root.render(createElement(TestWrapper, { selectedId: pageId }));
    await new Promise((r) => setTimeout(r, 100));

    const pageFetches = fetchMock.mock.calls.filter(
      (call: any) => String(call[0]).includes(`/api/backoffice/content/pages/${pageId}`)
    );
    expect(pageFetches.length).toBe(1);
    root.unmount();
    document.body.removeChild(container);
  });

  test("reset path sets detailLoading false so empty state does not show loading", async () => {
    const pageId = "uuid-for-reset-test";
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, data: { items: [] } })))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, data: { page: mkPage(pageId) } }))
      );

    let result: ReturnType<typeof useContentWorkspacePageData> | null = null;
    const pageLoadedRef = { current: vi.fn() };
    const resetRef = { current: vi.fn() };

    function TestWrapper({ selectedId }: { selectedId: string }) {
      result = useContentWorkspacePageData({
        selectedId,
        query: "",
        setPage: setPageMock,
        onPageLoaded: (data: PageLoadedData) => pageLoadedRef.current(data),
        onReset: () => resetRef.current(),
      });
      return null;
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    root.render(createElement(TestWrapper, { selectedId: pageId }));
    await new Promise((r) => setTimeout(r, 120));
    expect(result?.detailLoading).toBe(false);
    expect(setPageMock).toHaveBeenCalledWith(expect.any(Object));

    root.render(createElement(TestWrapper, { selectedId: "" }));
    await new Promise((r) => setTimeout(r, 20));
    expect(result?.detailLoading).toBe(false);
    expect(setPageMock).toHaveBeenCalledWith(null);

    root.unmount();
    document.body.removeChild(container);
  });
});

describe("ContentWorkspace stability – detail effect deps", () => {
  test("detail effect deps documented to avoid fetch loop", async () => {
    const path = await import("path");
    const fs = await import("fs");
    const p = path.join(process.cwd(), "app", "(backoffice)", "backoffice", "content", "_components", "useContentWorkspacePageData.ts");
    const src = fs.readFileSync(p, "utf8");
    expect(src).toContain("[selectedId, refetchDetailKey]");
    expect(src).toMatch(/Intentionally omit|would retrigger|fetch loop/i);
  });

  test("detail run-id guard present to avoid stale response apply", async () => {
    const path = await import("path");
    const fs = await import("fs");
    const p = path.join(process.cwd(), "app", "(backoffice)", "backoffice", "content", "_components", "useContentWorkspacePageData.ts");
    const src = fs.readFileSync(p, "utf8");
    expect(src).toContain("detailRunIdRef");
    expect(src).toContain("runId !== detailRunIdRef.current");
  });
});
