import { describe, it, expect } from "vitest";

import { mineLunsjOrderTitleNb } from "@/lib/employee/mineLunsjEndringerNb";

describe("mineLunsjOrderTitleNb", () => {
  it("aktiv ordre", () => {
    expect(mineLunsjOrderTitleNb("ACTIVE")).toContain("registrert");
  });

  it("avbestilt", () => {
    expect(mineLunsjOrderTitleNb("CANCELLED")).toContain("avbestilt");
  });

  it("annen status", () => {
    expect(mineLunsjOrderTitleNb("HOLD")).toContain("HOLD");
  });
});
