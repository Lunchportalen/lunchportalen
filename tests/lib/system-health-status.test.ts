import { describe, expect, it } from "vitest";
import { deriveReasons, deriveSystemStatus, type HealthCheckItem } from "@/lib/system/healthStatus";

describe("system health status derivation", () => {
  it("all OK -> normal + empty reasons", () => {
    const items: HealthCheckItem[] = [
      { key: "runtime", status: "OK", message: "ok" },
      { key: "db", status: "OK", message: "ok" },
    ];

    expect(deriveSystemStatus(items)).toBe("normal");
    expect(deriveReasons(items)).toEqual([]);
  });

  it("WARN -> degraded + reason", () => {
    const items: HealthCheckItem[] = [
      { key: "runtime", status: "WARN", message: "Mangler env / runtime config." },
    ];

    expect(deriveSystemStatus(items)).toBe("degraded");
    expect(deriveReasons(items)).toEqual(["runtime: Mangler env / runtime config."]);
  });

  it("FAIL -> degraded + reason", () => {
    const items: HealthCheckItem[] = [
      { key: "db", status: "FAIL", message: "DB query feilet." },
    ];

    expect(deriveSystemStatus(items)).toBe("degraded");
    expect(deriveReasons(items)).toEqual(["db: DB query feilet."]);
  });
});
