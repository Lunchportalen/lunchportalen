import { describe, expect, test } from "vitest";

import { generateVariant } from "@/lib/ai/generateVariant";

describe("generateVariant", () => {
  test("produces distinct B meta and keeps block count", () => {
    const base = {
      version: 1 as const,
      blocks: [
        { id: "h1", type: "hero", data: { title: "Hello" } },
        { id: "c1", type: "cta", data: { buttonLabel: "Go" } },
        { id: "r1", type: "richText", data: { heading: "X" } },
        { id: "r2", type: "richText", data: { heading: "Y" } },
      ],
    };
    const out = generateVariant(base);
    expect(out.blocks.length).toBe(base.blocks.length);
    expect(String((out.meta as { croVariant?: string })?.croVariant)).toBe("B");
    const hero = out.blocks.find((b) => b.type === "hero");
    expect(String(hero?.data?.title ?? "")).toContain("Variant B");
    const cta = out.blocks.find((b) => b.type === "cta");
    expect(String(cta?.data?.buttonLabel ?? "")).toContain("→");
  });
});
