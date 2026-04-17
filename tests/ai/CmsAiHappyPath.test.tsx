/** @vitest-environment jsdom */

import React, { act, useMemo, useState } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { ContentAiTools } from "@/app/(backoffice)/backoffice/content/_components/ContentAiTools";
import { useContentWorkspaceAi } from "@/app/(backoffice)/backoffice/content/_components/useContentWorkspaceAi";
import type { Block } from "@/app/(backoffice)/backoffice/content/_components/editorBlockTypes";
import { normalizeBlock } from "@/app/(backoffice)/backoffice/content/_components/contentWorkspace.blocks";

const mountedRoots: Root[] = [];

function buildFetchMock() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url === "/api/backoffice/ai/capability") {
      return new Response(JSON.stringify({ ok: true, data: { enabled: true } }), { status: 200 });
    }

    if (url === "/api/editor-ai/metrics") {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    if (url === "/api/backoffice/ai/suggest") {
      return new Response(
        JSON.stringify({
          ok: true,
          data: {
            suggestion: {
              summary: "Heroen ble oppdatert og sendt inn i workspace-state.",
              patch: {
                version: 1,
                ops: [
                  {
                    op: "updateBlockData",
                    id: "hero-1",
                    data: {
                      title: "Ny hero fra AI",
                      subtitle: "Oppdatert direkte i editoren.",
                    },
                  },
                ],
              },
            },
          },
        }),
        { status: 200 },
      );
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  });
}

async function flushUi() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function AiHappyPathHarness() {
  const initialBlocks = useMemo<Block[]>(() => {
    const hero = normalizeBlock({
      id: "hero-1",
      type: "hero",
      title: "Opprinnelig hero",
      subtitle: "Før AI",
      ctaLabel: "Kontakt",
      ctaHref: "/kontakt",
    });
    if (!hero) throw new Error("hero");
    return [hero];
  }, []);

  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [meta, setMeta] = useState<Record<string, unknown>>({
    seo: {
      title: "Eksisterende side",
      description: "Før AI",
    },
  });
  const [lastDiagnosticsMerge, setLastDiagnosticsMerge] = useState<Record<string, unknown> | null>(null);

  const ai = useContentWorkspaceAi({
    effectiveId: "page-1",
    selectedId: "page-1",
    blocks,
    meta,
    title: "Forside",
    slug: "forside",
    documentTypeAlias: "page",
    onApplySuggestPatch: (editorBlocks, mergedMeta) => {
      setBlocks(editorBlocks as unknown as Block[]);
      setMeta(mergedMeta);
    },
    onMergeDiagnostics: (contract) => {
      setLastDiagnosticsMerge(contract as Record<string, unknown>);
    },
  });

  return (
    <div>
      <ContentAiTools
        contextLabel="1. Hero"
        focusedBlockType="hero"
        focusedBlockLabel="Hero"
        disabled={ai.aiCapability !== "available"}
        aiCapabilityStatus={ai.aiCapability}
        busyToolId={ai.aiBusyToolId}
        errorMessage={ai.aiError}
        lastSummary={ai.aiSummary}
        lastAppliedTool={ai.aiLastAppliedTool}
        onImprovePage={ai.handleAiImprovePage}
        onSeoOptimize={ai.handleAiSeoOptimize}
        onRunDiagnostics={ai.runFullDiagnostics}
        diagnosticsResult={ai.diagnosticsResult}
        diagnosticsBusy={ai.diagnosticsBusy}
        aiHistory={ai.aiHistory}
        onClearError={() => ai.setAiError(null)}
      />
      <div data-testid="workspace-title">{String((blocks[0] as { title?: string } | undefined)?.title ?? "")}</div>
      <div data-testid="workspace-summary">{ai.aiSummary ?? ""}</div>
      <div data-testid="workspace-history">{ai.aiHistory[0]?.label ?? ""}</div>
      <div data-testid="workspace-seo-title">{String((meta.seo as { title?: string } | undefined)?.title ?? "")}</div>
      <div data-testid="workspace-diagnostics">{lastDiagnosticsMerge ? JSON.stringify(lastDiagnosticsMerge) : ""}</div>
    </div>
  );
}

async function renderHarness() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  mountedRoots.push(root);

  await act(async () => {
    root.render(<AiHappyPathHarness />);
  });

  await flushUi();
  return container;
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal("fetch", buildFetchMock());
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("React", React);
});

afterEach(async () => {
  await act(async () => {
    while (mountedRoots.length > 0) {
      mountedRoots.pop()?.unmount();
    }
    await Promise.resolve();
  });
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("CMS AI happy path", () => {
  test("triggers improve-page from the visible editor UI and lands in canonical workspace state without runtime errors", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const pageErrors: Event[] = [];
    const onPageError = (event: Event) => {
      pageErrors.push(event);
    };
    window.addEventListener("error", onPageError);

    try {
      const container = await renderHarness();

      const improveButton = Array.from(container.querySelectorAll("button")).find((button) =>
        button.textContent?.includes("Kjør forbedringsforslag"),
      );
      expect(improveButton).toBeTruthy();

      await act(async () => {
        improveButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      await flushUi();

      const workspaceTitle = container.querySelector('[data-testid="workspace-title"]');
      const workspaceSummary = container.querySelector('[data-testid="workspace-summary"]');
      const workspaceHistory = container.querySelector('[data-testid="workspace-history"]');
      const workspaceSeoTitle = container.querySelector('[data-testid="workspace-seo-title"]');

      expect(workspaceTitle?.textContent).toBe("Ny hero fra AI");
      expect(workspaceSummary?.textContent).toContain("Heroen ble oppdatert");
      expect(workspaceHistory?.textContent).toBe("Improve page");
      expect(workspaceSeoTitle?.textContent).toBe("Eksisterende side");
      expect(container.textContent).toContain("AI oppdaterte innholdet i editoren. Husk å lagre siden når du er fornøyd.");
      expect(consoleErrorSpy).not.toHaveBeenCalled();
      expect(pageErrors).toEqual([]);
    } finally {
      window.removeEventListener("error", onPageError);
      consoleErrorSpy.mockRestore();
    }
  });
});
