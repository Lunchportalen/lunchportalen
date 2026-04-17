/** @vitest-environment jsdom */

import React, { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";

import {
  ContentAiTools,
  type ContentAiToolsProps,
} from "@/app/(backoffice)/backoffice/content/_components/ContentAiTools";

(global as any).React = React;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mountedRoots: Root[] = [];

async function renderContentAiTools(props: Partial<ContentAiToolsProps> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  mountedRoots.push(root);

  await act(async () => {
    root.render(
      <ContentAiTools
        aiCapabilityStatus="available"
        focusedBlockLabel="Ingen blokk valgt"
        {...props}
      />,
    );
    await Promise.resolve();
  });

  return container;
}

function getButtonsByText(container: HTMLElement, text: string) {
  return Array.from(container.querySelectorAll("button")).filter(
    (button) => button.textContent?.trim() === text,
  );
}

afterEach(async () => {
  await act(async () => {
    while (mountedRoots.length > 0) {
      mountedRoots.pop()?.unmount();
    }
    await Promise.resolve();
  });
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("Cms AI entry points inventory", () => {
  it("hides dead entrypoints when no handlers or results are wired", async () => {
    const container = await renderContentAiTools({
      focusedBlockType: "hero",
      focusedBlockLabel: "Hero",
    });

    expect(container.textContent).toContain("AI-verktøy");
    expect(container.textContent).not.toContain("Diagnostikk");
    expect(container.textContent).not.toContain("Flere verktøy");
    expect(getButtonsByText(container, "Kjør sidediagnostikk")).toHaveLength(0);
    expect(getButtonsByText(container, "Kjør forbedringsforslag")).toHaveLength(0);
    expect(getButtonsByText(container, "Foreslå SEO-forbedringer")).toHaveLength(0);
    expect(getButtonsByText(container, "Foreslå seksjoner")).toHaveLength(0);
    expect(getButtonsByText(container, "Generer A/B-varianter")).toHaveLength(0);
    expect(getButtonsByText(container, "Hent layoutforslag")).toHaveLength(0);
    expect(getButtonsByText(container, "Bygg blokk")).toHaveLength(0);
    expect(getButtonsByText(container, "Foreslå bilder")).toHaveLength(0);
    expect(getButtonsByText(container, "Bygg fra skjermbilde")).toHaveLength(0);
  });

  it("shows only wired hero-context and extended tools", async () => {
    const noop = vi.fn();
    const container = await renderContentAiTools({
      focusedBlockType: "hero",
      focusedBlockLabel: "Hero",
      contextLabel: "1. Hero",
      onImprovePage: noop,
      onSeoOptimize: noop,
      onGenerateSections: noop,
      onStructuredIntent: noop,
      onLayoutSuggestions: noop,
      onRunDiagnostics: vi.fn().mockResolvedValue(undefined),
      onBlockBuilder: noop,
      onImageGenerate: noop,
      onScreenshotBuilder: noop,
    });

    expect(container.textContent).toContain("Diagnostikk");
    expect(container.textContent).toContain("Flere verktøy");
    expect(getButtonsByText(container, "Kjør sidediagnostikk")).toHaveLength(1);
    expect(getButtonsByText(container, "Kjør forbedringsforslag")).toHaveLength(1);
    expect(getButtonsByText(container, "Foreslå SEO-forbedringer")).toHaveLength(1);
    expect(getButtonsByText(container, "Foreslå seksjoner")).toHaveLength(1);
    expect(getButtonsByText(container, "Generer A/B-varianter")).toHaveLength(1);
    expect(getButtonsByText(container, "Hent layoutforslag")).toHaveLength(1);
    expect(getButtonsByText(container, "Bygg blokk")).toHaveLength(1);
    expect(getButtonsByText(container, "Foreslå bilder")).toHaveLength(1);
    expect(getButtonsByText(container, "Bygg fra skjermbilde")).toHaveLength(1);
  });

  it("deduplicates image metadata entrypoints across image-only groups", async () => {
    const container = await renderContentAiTools({
      focusedBlockType: "image",
      focusedBlockLabel: "Bilde",
      onImageImproveMetadata: vi.fn(),
    });

    expect(getButtonsByText(container, "Foreslå metadata")).toHaveLength(1);
  });
});
