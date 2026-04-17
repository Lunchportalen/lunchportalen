/**
 * U83: Samlet gate — workspace-first, én fokus-sannhet, én inspector-bane, én dataset-modell,
 * død legacy BlockCanvas, katalog som støtter nøkkelblokker uten overlapp-forvirring.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { CORE_CMS_BLOCK_DEFINITIONS, CORE_RENDER_BLOCK_TYPES } from "@/lib/cms/blocks/registry";

const root = process.cwd();
const p = (...segs: string[]) => path.join(root, ...segs);

describe("U83UmbracoEditorModelGate", () => {
  const keyTypes = [
    "hero",
    "hero_full",
    "hero_bleed",
    "cards",
    "zigzag",
    "pricing",
    "grid",
    "cta",
    "relatedLinks",
  ] as const;

  it("nøkkelblokker finnes i render- og katalog-liste med tydelig identitet", () => {
    for (const t of keyTypes) {
      expect(CORE_RENDER_BLOCK_TYPES).toContain(t);
      const def = CORE_CMS_BLOCK_DEFINITIONS.find((d) => d.type === t);
      expect(def, `definition for ${t}`).toBeTruthy();
      expect(def!.description.trim().length).toBeGreaterThan(40);
      expect(def!.description.trim().toLowerCase()).not.toBe(def!.label.trim().toLowerCase());
    }
  });

  it("zigzag er eksplisitt bundet til steg/FAQ-modellen (ingen ghost «steps»-type)", () => {
    const z = CORE_CMS_BLOCK_DEFINITIONS.find((d) => d.type === "zigzag")!;
    expect(z.description.toLowerCase()).toContain("zigzag");
    expect(z.description.toLowerCase()).toMatch(/steps|«steps»/);
  });

  it("kort vs rutenett vs relaterte sider er ikke synonyme i katalogtekst", () => {
    const cards = CORE_CMS_BLOCK_DEFINITIONS.find((d) => d.type === "cards")!.description.toLowerCase();
    const grid = CORE_CMS_BLOCK_DEFINITIONS.find((d) => d.type === "grid")!.description.toLowerCase();
    const rel = CORE_CMS_BLOCK_DEFINITIONS.find((d) => d.type === "relatedLinks")!.description.toLowerCase();
    expect(cards).toMatch(/kort|verdi/);
    expect(grid).toMatch(/rutenett|lokasjon/);
    expect(rel).toMatch(/lenk|relatert|kuratert/);
    expect(new Set([cards, grid, rel]).size).toBe(3);
  });

  it("dataset- og fokus-markører finnes i repo (én pipeline / én inspector)", () => {
    const canon = fs.readFileSync(p("lib", "cms", "workspaceBlockDatasetCanon.ts"), "utf8");
    expect(canon).toContain("bodyForSave");
    expect(canon).toContain("displayBlocks");

    const blocksHook = fs.readFileSync(
      p("app", "(backoffice)", "backoffice", "content", "_components", "useContentWorkspaceBlocks.ts"),
      "utf8",
    );
    expect(blocksHook).not.toContain("expandedBlockId");

    const shell = fs.readFileSync(
      p("app", "(backoffice)", "backoffice", "content", "_components", "BlockInspectorShell.tsx"),
      "utf8",
    );
    expect(shell).toContain('data-lp-block-inspector-shell="navigator-only"');

    const legacyCanvas = p("app", "(backoffice)", "backoffice", "content", "_components", "BlockCanvas.tsx");
    expect(fs.existsSync(legacyCanvas)).toBe(false);
  });
});
