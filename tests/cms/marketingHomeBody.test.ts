import { describe, test, expect } from "vitest";
import { buildMarketingHomeBody } from "@/lib/cms/seed/marketingHomeBody";
import { parseBody } from "@/lib/cms/public/parseBody";
import { normalizeBlockForRender } from "@/lib/cms/public/normalizeBlockForRender";
import { renderBlock } from "@/lib/public/blocks/renderBlock";

describe("marketingHomeBody — public pipeline safe", () => {
  test("valid envelope, blocks array, each block renders in prod without throw", () => {
    const body = buildMarketingHomeBody();
    expect(body.version).toBe(1);
    expect(Array.isArray(body.blocks)).toBe(true);
    const blocks = parseBody(body);
    expect(blocks.length).toBe(body.blocks.length);
    for (let i = 0; i < blocks.length; i++) {
      const node = normalizeBlockForRender(blocks[i] ?? null, i);
      expect(() => renderBlock(node, "prod", "nb")).not.toThrow();
      expect(renderBlock(node, "prod", "nb")).not.toBeNull();
    }
  });
});
