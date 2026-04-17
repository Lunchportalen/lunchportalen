import { describe, expect, test } from "vitest";

import { improveBlocks } from "@/lib/ai/autoImprove";

describe("improveBlocks", () => {
  test("hero gains deterministic headline suffix once", () => {
    const out = improveBlocks([
      { id: "h1", type: "hero", data: { title: "Hello" } },
    ]);
    expect(out.blocks[0]?.type).toBe("hero");
    const title = String((out.blocks[0]?.data as { title?: string })?.title ?? "");
    expect(title).toContain("Hello");
    expect(title).toContain("Sterkere budskap");
  });

  test("cta gains default action when missing", () => {
    const out = improveBlocks([{ id: "c1", type: "cta", data: { title: "T" } }]);
    const d = out.blocks[0]?.data as { buttonLabel?: string; href?: string };
    expect(d.buttonLabel?.length).toBeGreaterThan(0);
    expect(d.href?.length).toBeGreaterThan(0);
  });

  test("cards padded to three items", () => {
    const out = improveBlocks([
      { id: "k1", type: "cards", data: { title: "K", items: [{ title: "a", text: "1" }] } },
    ]);
    const items = (out.blocks[0]?.data as { items?: unknown[] })?.items ?? [];
    expect(items.length).toBeGreaterThanOrEqual(3);
  });

  test("preserves slot count for non-object entries", () => {
    const out = improveBlocks([null, { id: "x", type: "richText", data: {} }] as unknown[]);
    expect(out.blocks.length).toBe(2);
  });
});
