import { describe, it, expect } from "vitest";

import { mineLunsjOrderTitleNb } from "@/lib/employee/mineLunsjEndringerNb";

describe("mineLunsjOrderTitleNb", () => {
  it("aktiv ordre", () => {
    expect(mineLunsjOrderTitleNb("ACTIVE")).toContain("registrert");
  });

  it("avbestilt", () => {
    expect(mineLunsjOrderTitleNb("CANCELLED")).toContain("avbestilt");
  });

  it("produksjon og levering mappes til norsk", () => {
    expect(mineLunsjOrderTitleNb("PREPARED")).toContain("produksjon");
    expect(mineLunsjOrderTitleNb("DELIVERED")).toContain("levert");
  });

  it("ukjent status lekker aldri rå DB-enum (fail-closed)", () => {
    expect(mineLunsjOrderTitleNb("HOLD")).not.toContain("HOLD");
    expect(mineLunsjOrderTitleNb("SOME_NEW_STATUS")).not.toContain("SOME_NEW_STATUS");
    expect(mineLunsjOrderTitleNb("HOLD")).toBe("Ordre registrert");
  });

  it("tom status", () => {
    expect(mineLunsjOrderTitleNb("")).toBe("Ordre uten status");
  });
});
