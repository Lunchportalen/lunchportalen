/** @vitest-environment jsdom */

import React, { act, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";

import { ContentBellissimaWorkspaceProvider } from "@/components/backoffice/ContentBellissimaWorkspaceContext";
import { useContentWorkspaceBellissima } from "@/app/(backoffice)/backoffice/content/_components/useContentWorkspaceBellissima";
import type { ContentPage } from "@/app/(backoffice)/backoffice/content/_components/ContentWorkspaceState";

(global as any).React = React;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const TEST_PAGE: ContentPage = {
  id: "00000000-0000-4000-8000-00000000c001",
  title: "Hjem (lokal reserve)",
  slug: "home",
  body: { blocks: [] },
  status: "draft",
  created_at: "2026-04-01T00:00:00.000Z",
  updated_at: "2026-04-01T00:00:00.000Z",
  published_at: null,
};

function StableBellissimaHarness({ statusCalls }: { statusCalls: string[] }) {
  const [tick, setTick] = useState(0);
  const onSave = useCallback(async () => undefined, [tick]);
  const onSetStatus = useCallback(
    async (status: "draft" | "published") => {
      statusCalls.push(`${status}:${tick}`);
    },
    [statusCalls, tick],
  );
  const bellissimaActionsRef = useRef({
    onSave,
    onSetStatus,
  });

  useEffect(() => {
    bellissimaActionsRef.current = {
      onSave,
      onSetStatus,
    };
  }, [onSave, onSetStatus]);

  const actionHandlers = useMemo(
    () => ({
      save: () => void bellissimaActionsRef.current.onSave(),
      publish: () => void bellissimaActionsRef.current.onSetStatus("published"),
      unpublish: () => void bellissimaActionsRef.current.onSetStatus("draft"),
    }),
    [],
  );

  const snapshot = useContentWorkspaceBellissima({
    effectiveId: TEST_PAGE.id,
    page: TEST_PAGE,
    pageNotFound: false,
    detailError: null,
    detailLoading: false,
    title: TEST_PAGE.title,
    slug: TEST_PAGE.slug,
    documentTypeAlias: "page",
    statusLabel: "draft",
    canvasMode: "edit",
    saveState: "idle",
    dirty: false,
    canSave: true,
    canPublish: true,
    canUnpublish: true,
    canOpenPublic: true,
    activeWorkspaceView: "content",
    actionHandlers,
  });

  useEffect(() => {
    if (tick < 3) {
      setTick((current) => current + 1);
    }
  }, [tick]);

  useEffect(() => {
    if (tick === 3) {
      actionHandlers.publish();
    }
  }, [actionHandlers, tick]);

  return <div data-testid="snapshot">{`${snapshot?.title ?? "none"}:${tick}`}</div>;
}

async function flushEffects() {
  for (let i = 0; i < 6; i += 1) {
    await act(async () => {
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("Content overlay regression", () => {
  it("keeps Bellissima publishing stable when status handlers change across renders", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: { degraded: false } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const statusCalls: string[] = [];
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <ContentBellissimaWorkspaceProvider>
          <StableBellissimaHarness statusCalls={statusCalls} />
        </ContentBellissimaWorkspaceProvider>,
      );
      await Promise.resolve();
    });

    await flushEffects();

    expect(container.querySelector('[data-testid="snapshot"]')?.textContent).toBe("Hjem (lokal reserve):3");
    expect(statusCalls).toEqual(["published:3"]);
    expect(
      consoleError.mock.calls.some(([message]) =>
        typeof message === "string" && message.includes("Maximum update depth exceeded"),
      ),
    ).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backoffice/content/audit-log?limit=1",
      expect.objectContaining({
        cache: "no-store",
        credentials: "include",
      }),
    );

    root.unmount();
  });
});
