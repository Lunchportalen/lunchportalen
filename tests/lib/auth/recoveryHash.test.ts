import { describe, expect, it, vi } from "vitest";

import {
  clearRecoveryHashFromUrl,
  isRecoveryHashExpired,
  isRecoveryHashValid,
  parseRecoveryHash,
  RECOVERY_EXPIRED_MESSAGE,
} from "@/lib/auth/recoveryHash";

describe("recoveryHash", () => {
  it("parses recovery hash tokens and type", () => {
    const parsed = parseRecoveryHash(
      "#access_token=abc123&refresh_token=def456&type=recovery&expires_in=3600",
    );
    expect(parsed.accessToken).toBe("abc123");
    expect(parsed.refreshToken).toBe("def456");
    expect(parsed.type).toBe("recovery");
    expect(parsed.error).toBeNull();
  });

  it("parses otp_expired error from hash", () => {
    const parsed = parseRecoveryHash(
      "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
    );
    expect(isRecoveryHashExpired(parsed)).toBe(true);
    expect(isRecoveryHashValid(parsed)).toBe(false);
  });

  it("validates recovery hash before session set", () => {
    const parsed = parseRecoveryHash("#access_token=a&refresh_token=b&type=recovery");
    expect(isRecoveryHashValid(parsed)).toBe(true);
  });

  it("rejects missing hash", () => {
    const parsed = parseRecoveryHash("");
    expect(isRecoveryHashValid(parsed)).toBe(false);
    expect(isRecoveryHashExpired(parsed)).toBe(false);
  });

  it("clears hash from URL without logging tokens", () => {
    const replaceState = vi.fn();
    vi.stubGlobal("window", {
      location: {
        pathname: "/reset-password",
        search: "",
        hash: "#access_token=secret&refresh_token=secret&type=recovery",
      },
      history: { replaceState },
      document: { title: "Reset" },
    });
    vi.stubGlobal("document", { title: "Reset" });

    clearRecoveryHashFromUrl();
    expect(replaceState).toHaveBeenCalledWith({}, "Reset", "/reset-password");
    expect(JSON.stringify(replaceState.mock.calls)).not.toContain("secret");
  });

  it("uses controlled expired copy constant", () => {
    expect(RECOVERY_EXPIRED_MESSAGE).toContain("utløpt");
    expect(RECOVERY_EXPIRED_MESSAGE).toContain("Be om ny lenke");
  });
});
