/**
 * U84: Riktig blokktype → riktig property editor (switch kun i router).
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const routerPath = path.join(
  root,
  "app",
  "(backoffice)",
  "backoffice",
  "content",
  "_components",
  "blockPropertyEditors",
  "BlockPropertyEditorRouter.tsx",
);

describe("BlockInspectorComponentRoutingParity (U84)", () => {
  it("router switch dekker alle Block-union med én case per type", () => {
    const src = fs.readFileSync(routerPath, "utf8");
    const types = [
      "hero",
      "hero_full",
      "hero_bleed",
      "richText",
      "image",
      "cta",
      "divider",
      "banner",
      "form",
      "relatedLinks",
      "pricing",
      "cards",
      "zigzag",
      "grid",
    ] as const;
    for (const t of types) {
      expect(src).toContain(`case "${t}":`);
    }
  });
});
