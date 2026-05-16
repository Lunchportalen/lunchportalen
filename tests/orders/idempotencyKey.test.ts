import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { generateIdempotencyKey } from "@/lib/orders/idempotencyKey";

describe("generateIdempotencyKey", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "crypto",
      Object.assign(globalThis.crypto ?? {}, {
        randomUUID: () => "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === "x" ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("length >= 8", () => {
    const k = generateIdempotencyKey();
    expect(typeof k).toBe("string");
    expect(k.length).toBeGreaterThanOrEqual(8);
  });

  test("distinct keys per invocation", () => {
    let i = 0;
    vi.stubGlobal("crypto", {
      randomUUID: () => `aaaaaaaa-aaaa-4aaa-${(1000 + i++).toString(16)}-aaaaaaaaaaaa`,
    });
    const a = generateIdempotencyKey();
    const b = generateIdempotencyKey();
    expect(a).not.toBe(b);
  });

  test("fallback uten crypto.randomUUID", () => {
    vi.stubGlobal("crypto", { randomUUID: undefined });
    const k = generateIdempotencyKey();
    expect(k.startsWith("idem-")).toBe(true);
    expect(k.length).toBeGreaterThanOrEqual(8);
  });
});
