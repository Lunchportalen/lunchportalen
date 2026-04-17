/** @vitest-environment jsdom */

import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { validateEditorBlockTypesForGovernedApply } from "@/lib/cms/legacyEnvelopeGovernance";
import { useContentWorkspaceAi, type EditorBlockForPatch } from "@/app/(backoffice)/backoffice/content/_components/useContentWorkspaceAi";
import type { Block } from "@/app/(backoffice)/backoffice/content/_components/editorBlockTypes";
import { normalizeBlock } from "@/app/(backoffice)/backoffice/content/_components/contentWorkspace.blocks";

type HookSnapshot = ReturnType<typeof useContentWorkspaceAi>;

const mountedRoots: Root[] = [];

function buildFetchMock() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
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
              summary: "Heroen ble skjerpet for beslutningstakere.",
              metaSuggestion: {
                title: "Bedriftslunsj uten administrasjonsstress",
                description: "En tydeligere hero med bedre SEO og handling.",
              },
              patch: {
                version: 1,
                ops: [
                  {
                    op: "updateBlockData",
                    id: "hero-1",
                    data: {
                      title: "Bedriftslunsj uten administrasjonsstress",
                      subtitle: "Ferdig forbedret for HR og ledelse.",
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

async function renderHookHarness(props: {
  blocks: Block[];
  meta: Record<string, unknown>;
  onApplySuggestPatch: (blocks: EditorBlockForPatch, meta: Record<string, unknown>) => void;
  onMergeDiagnostics: (contract: Record<string, unknown>) => void;
}) {
  let hookSnapshot: HookSnapshot | null = null;

  function Harness() {
    hookSnapshot = useContentWorkspaceAi({
      effectiveId: "page-1",
      selectedId: "page-1",
      blocks: props.blocks,
      meta: props.meta,
      title: "Forside",
      slug: "forside",
      documentTypeAlias: "page",
      onApplySuggestPatch: props.onApplySuggestPatch,
      onMergeDiagnostics: props.onMergeDiagnostics,
    });
    return null;
  }

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  mountedRoots.push(root);

  await act(async () => {
    root.render(React.createElement(Harness));
  });

  await flushUi();

  if (!hookSnapshot) {
    throw new Error("Hook snapshot was not created.");
  }

  return {
    get hook() {
      if (!hookSnapshot) throw new Error("Hook snapshot missing.");
      return hookSnapshot;
    },
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal("fetch", buildFetchMock());
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
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

describe("CMS AI seamless block flow", () => {
  test("improve-page uses canonical context, validates blocks, and lands in workspace apply state", async () => {
    const onApplySuggestPatch = vi.fn();
    const onMergeDiagnostics = vi.fn();

    const hero = normalizeBlock({
      id: "hero-1",
      type: "hero",
      title: "Gammel hero",
      subtitle: "Før AI",
      ctaLabel: "Kontakt oss",
      ctaHref: "/kontakt",
    });
    if (!hero) throw new Error("hero");
    const blocks: Block[] = [
      hero,
      {
        id: "body-1",
        type: "richText",
        heading: "Hvorfor",
        body: "Eksisterende brødtekst",
      },
    ];

    const meta = {
      seo: {
        title: "Eksisterende SEO-tittel",
        description: "Eksisterende SEO-beskrivelse",
      },
    };

    const harness = await renderHookHarness({
      blocks,
      meta,
      onApplySuggestPatch,
      onMergeDiagnostics,
    });

    await act(async () => {
      harness.hook.handleAiImprovePage({
        goal: "lead",
        audience: "HR og ledelse",
      });
    });

    await flushUi();

    const fetchMock = vi.mocked(global.fetch);
    const suggestCall = fetchMock.mock.calls.find(([url]) => String(url) === "/api/backoffice/ai/suggest");
    expect(suggestCall).toBeTruthy();

    const suggestBody = JSON.parse(String((suggestCall?.[1] as RequestInit | undefined)?.body ?? "{}"));
    expect(suggestBody).toMatchObject({
      tool: "content.maintain.page",
      pageId: "page-1",
      variantId: null,
      environment: "preview",
      locale: "nb",
      input: {
        goal: "lead",
        audience: "HR og ledelse",
        brand: "Lunchportalen",
        mode: "safe",
      },
      existingBlocks: [
        { id: "hero-1", type: "hero" },
        { id: "body-1", type: "richText" },
      ],
    });
    expect(suggestBody.blocks[0]).toMatchObject({
      id: "hero-1",
      type: "hero",
      data: {
        title: "Gammel hero",
        subtitle: "Før AI",
        ctaLabel: "Kontakt oss",
        ctaHref: "/kontakt",
      },
    });

    expect(onApplySuggestPatch).toHaveBeenCalledTimes(1);
    const [appliedBlocks, mergedMeta] = onApplySuggestPatch.mock.calls[0] as [
      EditorBlockForPatch,
      Record<string, unknown>,
    ];

    expect(validateEditorBlockTypesForGovernedApply("page", appliedBlocks)).toEqual({ ok: true });
    expect(appliedBlocks[0]).toMatchObject({
      id: "hero-1",
      type: "hero",
      title: "Bedriftslunsj uten administrasjonsstress",
      subtitle: "Ferdig forbedret for HR og ledelse.",
      ctaLabel: "Kontakt oss",
      ctaHref: "/kontakt",
    });
    expect(mergedMeta).toMatchObject({
      seo: {
        title: "Bedriftslunsj uten administrasjonsstress",
        description: "En tydeligere hero med bedre SEO og handling.",
      },
    });
    expect(harness.hook.aiError).toBeNull();
    expect(harness.hook.aiLastAppliedTool).toBe("content.maintain.page");
    expect(harness.hook.aiHistory[0]).toMatchObject({
      tool: "content.maintain.page",
      label: "Improve page",
      detail: "Brukt",
    });
  });
});
