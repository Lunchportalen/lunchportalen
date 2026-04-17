import { describe, expect, test } from "vitest";

import { reorderBlocks } from "@/lib/cms/reorderBlocks";

describe("reorderBlocks", () => {
  test("moves item fromIndex to toIndex immutably", () => {
    const a = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const next = reorderBlocks(a, 0, 2);
    expect(next.map((x) => x.id)).toEqual(["b", "c", "a"]);
    expect(a.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });

  test("returns copy when indices invalid or equal", () => {
    expect(reorderBlocks(["x", "y"], -1, 1).join()).toBe("x,y");
    expect(reorderBlocks(["x", "y"], 0, 0).join()).toBe("x,y");
    expect(reorderBlocks(null, 0, 1).length).toBe(0);
  });
});
