import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";

import { resolveCityFromPostal } from "@/lib/public/resolveCityFromPostal";

describe("resolveCityFromPostal", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({
            ok: true,
            data: {
              items: [{ subtitle: "0150 Oslo (Oslo)" }],
            },
          }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("returns poststed from address search subtitle", async () => {
    await expect(resolveCityFromPostal("0150")).resolves.toBe("Oslo");
  });

  test("returns null for invalid postal", async () => {
    await expect(resolveCityFromPostal("12")).resolves.toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});
