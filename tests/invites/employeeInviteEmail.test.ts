import { describe, expect, it } from "vitest";

import { isInviteEmail, normInviteEmail } from "@/lib/invites/createEmployeeSingleInvite";

describe("employee invite email helpers", () => {
  it("normalizes email", () => {
    expect(normInviteEmail("  Test@Firma.NO ")).toBe("test@firma.no");
  });

  it("validates email shape", () => {
    expect(isInviteEmail("a@b.co")).toBe(true);
    expect(isInviteEmail("invalid")).toBe(false);
    expect(isInviteEmail("")).toBe(false);
  });
});
