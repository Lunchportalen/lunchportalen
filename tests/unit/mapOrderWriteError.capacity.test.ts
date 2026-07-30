import { describe, expect, it } from "vitest";

import { mapOrderWriteError } from "@/lib/orders/mapOrderWriteError";

describe("mapOrderWriteError capacity codes", () => {
  it("maps CAPACITY_EXCEEDED to 409 Norwegian message", () => {
    const mapped = mapOrderWriteError({ message: "CAPACITY_EXCEEDED" });
    expect(mapped.status).toBe(409);
    expect(mapped.code).toBe("CAPACITY_EXCEEDED");
    expect(mapped.message).toMatch(/Kapasiteten/i);
  });

  it("maps CAPACITY_CLOSED to 409", () => {
    const mapped = mapOrderWriteError({ message: "CAPACITY_CLOSED" });
    expect(mapped.status).toBe(409);
    expect(mapped.code).toBe("CAPACITY_CLOSED");
  });

  it("maps CAPACITY_QTY_INVALID to 400", () => {
    const mapped = mapOrderWriteError({ message: "CAPACITY_QTY_INVALID" });
    expect(mapped.status).toBe(400);
    expect(mapped.code).toBe("CAPACITY_QTY_INVALID");
  });
});
