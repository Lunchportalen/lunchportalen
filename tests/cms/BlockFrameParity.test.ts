/**
 * U78: Nøkkelblokker skal ha forskjellige ytre canvas-rammer (ikke samme boks med ulik tekst).
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { editorCanvasFrameKind } from "@/components/cms/blockCanvas/editorCanvasFrameKind";
import type { Block } from "@/app/(backoffice)/backoffice/content/_components/editorBlockTypes";

const root = process.cwd();

function readFrameSources(): string {
  const dir = path.join(root, "components", "cms", "blockCanvas", "frames");
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => fs.readFileSync(path.join(dir, f), "utf8"))
    .join("\n\n");
}

describe("BlockFrameParity (U78)", () => {
  it("eksporterer unike data-lp-canvas-frame markører per nøkkelvariant", () => {
    const joined = readFrameSources();
    const frames = [...joined.matchAll(/data-lp-canvas-frame="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(frames)).toEqual(new Set(["default", "hero", "cards", "steps", "pricing", "cta", "related", "grid"]));
  });

  it("editorCanvasFrameKind mapper blokker til forventede rammer", () => {
    const id = "t";
    const b = (t: Block["type"]): Block => ({ id, type: t } as Block);
    expect(editorCanvasFrameKind(b("hero"))).toBe("hero");
    expect(editorCanvasFrameKind(b("hero_full"))).toBe("hero");
    expect(editorCanvasFrameKind(b("hero_bleed"))).toBe("hero");
    expect(editorCanvasFrameKind(b("cards"))).toBe("cards");
    expect(editorCanvasFrameKind(b("zigzag"))).toBe("steps");
    expect(editorCanvasFrameKind(b("pricing"))).toBe("pricing");
    expect(editorCanvasFrameKind(b("cta"))).toBe("cta");
    expect(editorCanvasFrameKind(b("relatedLinks"))).toBe("related");
    expect(editorCanvasFrameKind(b("grid"))).toBe("grid");
    expect(editorCanvasFrameKind(b("richText"))).toBe("default");
  });

  it("WorkspaceBody bruker modulliste + preview (ikke én generisk canvas-frame-switch i denne filen)", () => {
    const body = fs.readFileSync(
      path.join(root, "app", "(backoffice)", "backoffice", "content", "_components", "WorkspaceBody.tsx"),
      "utf8",
    );
    expect(body).toContain("UmbracoBlockPropertyField");
    expect(body).toContain("PreviewCanvas");
    expect(body).toContain("ContentDetailDocumentEditor");
  });

  it("editorielle rammer har egen kropp-markør under chrome (preview utenfor identity-kolonnen)", () => {
    const joined = readFrameSources();
    expect(joined).toContain('data-lp-canvas-frame-body="hero"');
    expect(joined).toContain('data-lp-canvas-frame-body="cards"');
    expect(joined).toContain('data-lp-canvas-frame-body="steps"');
    expect(joined).toContain('data-lp-canvas-frame-body="pricing"');
    expect(joined).toContain('data-lp-canvas-frame-body="cta"');
    expect(joined).toContain('data-lp-canvas-frame-body="related"');
    expect(joined).toContain('data-lp-canvas-frame-body="grid"');
    expect(joined).not.toContain('data-lp-canvas-frame-body="default"');
  });
});
