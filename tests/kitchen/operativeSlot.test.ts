import { describe, expect, test } from "vitest";

import { normOperativeSlot } from "@/lib/kitchen/operativeSlot";

describe("normOperativeSlot", () => {
  test("maps empty and lunch to default", () => {
    expect(normOperativeSlot("")).toBe("default");
    expect(normOperativeSlot("lunch")).toBe("default");
    expect(normOperativeSlot("Lunch")).toBe("default");
  });

  test("preserves default and custom slots", () => {
    expect(normOperativeSlot("default")).toBe("default");
    expect(normOperativeSlot("am")).toBe("am");
  });
});
