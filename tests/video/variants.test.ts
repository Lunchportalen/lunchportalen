import { describe, expect, test } from "vitest";

import { createVideoVariants } from "@/lib/video/variants";

describe("createVideoVariants", () => {
  test("én rad per hook med stabile id-er", () => {
    const video = {
      conversionVideoId: "lpv_test",
      hooks: ["a", "b", "c"],
      extra: 1,
    };
    const v = createVideoVariants(video);
    expect(v).toHaveLength(3);
    expect(v[0]).toEqual({ id: "lpv_test_v0", hook: "a", base: video });
    expect(v[2]?.id).toBe("lpv_test_v2");
  });
});
