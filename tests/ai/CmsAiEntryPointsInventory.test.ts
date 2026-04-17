import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const repoRoot = process.cwd();

function readRepoFile(relativePath: string) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("CMS AI entrypoint inventory", () => {
  test("only the canonical visible editor AI entrypoints remain exposed in the right rail", () => {
    const rightRail = readRepoFile(
      "app/(backoffice)/backoffice/content/_components/ContentWorkspaceRightRail.tsx",
    );
    const aiTools = readRepoFile("app/(backoffice)/backoffice/content/_components/ContentAiTools.tsx");

    const visibleInventory = [
      { id: "improvePage", label: "Kjør forbedringsforslag", status: "WORKING" },
      { id: "seoOptimize", label: "Foreslå SEO-forbedringer", status: "WORKING" },
      { id: "diagnostics", label: "Kjør sidediagnostikk", status: "WORKING" },
    ] as const;

    expect(rightRail).toContain("Kun den kanoniske forbedringsflyten er synlig her.");
    expect(rightRail).toContain("onImprovePage={workspaceAi.handleAiImprovePage}");
    expect(rightRail).toContain("onSeoOptimize={workspaceAi.handleAiSeoOptimize}");
    expect(rightRail).toContain("onRunDiagnostics={workspaceAi.onRunDiagnostics}");

    for (const item of visibleInventory) {
      expect(item.status).toBe("WORKING");
      expect(aiTools).toContain(item.label);
    }
  });

  test("parallel and unproven editor AI surfaces are intentionally hidden behind the workspace adapter", () => {
    const rightRail = readRepoFile(
      "app/(backoffice)/backoffice/content/_components/ContentWorkspaceRightRail.tsx",
    );
    const aiHook = readRepoFile("app/(backoffice)/backoffice/content/_components/useContentWorkspaceAi.ts");

    const hiddenButStillWired = [
      {
        prop: "onGenerateSections={workspaceAi.handleAiGenerateSections}",
        hookSymbol: "handleAiGenerateSections",
      },
      {
        prop: "onStructuredIntent={workspaceAi.handleAiStructuredIntent}",
        hookSymbol: "handleAiStructuredIntent",
      },
      {
        prop: "onLayoutSuggestions={workspaceAi.handleLayoutSuggestions}",
        hookSymbol: "handleLayoutSuggestions",
      },
      {
        prop: "onBlockBuilder={workspaceAi.handleBlockBuilder}",
        hookSymbol: "handleBlockBuilder",
      },
      {
        prop: "onImageGenerate={workspaceAi.handleAiImageGenerate}",
        hookSymbol: "handleAiImageGenerate",
      },
      {
        prop: "onScreenshotBuilder={workspaceAi.handleScreenshotBuilder}",
        hookSymbol: "handleScreenshotBuilder",
      },
      {
        prop: "onImageImproveMetadata={workspaceAi.handleAiImageImproveMetadata}",
        hookSymbol: "handleAiImageImproveMetadata",
      },
      {
        prop: "onPageBuilder={workspaceAi.handlePageBuilder}",
        hookSymbol: "handlePageBuilder",
      },
    ] as const;

    for (const item of hiddenButStillWired) {
      expect(rightRail).not.toContain(item.prop);
      expect(aiHook).toContain(item.hookSymbol);
    }

    expect(rightRail).toContain("Utvidede AI-flater er skjult");
  });

  test("legacy leadership chrome is removed from the visible panel shell", () => {
    const rightPanel = readRepoFile("app/(backoffice)/backoffice/content/_components/RightPanel.tsx");
    const rightRail = readRepoFile(
      "app/(backoffice)/backoffice/content/_components/ContentWorkspaceRightRail.tsx",
    );

    expect(rightPanel).toContain("Kanonisk editor-AI");
    expect(rightPanel).not.toContain("Strategi og ledelse");
    expect(rightRail).toContain("const ceoSlot = null;");
    expect(rightRail).not.toContain("EditorCeoRecommendationsPanel");
    expect(rightRail).not.toContain("EditorEnterpriseInsightsPanel");
  });
});
