import { describe, expect, it } from "vitest";

/** DECIDER throwaway — never merge. Intentional fail to prove build gate blocks PR. */
describe("false-green negative decider (#1)", () => {
  it("intentional FAIL — delete with PR close", () => {
    expect(1).toBe(2);
  });
});
