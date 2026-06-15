import { describe, expect, it } from "vitest";

import {
  CANONICAL_PASSWORD_RESET_REDIRECT,
  describeRedirectTo,
  extractRedirectToFromActionLink,
  normalizeRecoveryActionLink,
} from "@/lib/auth/recoveryActionLink";

const VERIFY_BASE =
  "https://hkpokyapzarefrgqzkos.supabase.co/auth/v1/verify?token=REDACTED&type=recovery";

describe("recoveryActionLink", () => {
  it("extracts redirect_to without exposing token", () => {
    const link = `${VERIFY_BASE}&redirect_to=${encodeURIComponent(CANONICAL_PASSWORD_RESET_REDIRECT)}`;
    expect(extractRedirectToFromActionLink(link)).toBe(CANONICAL_PASSWORD_RESET_REDIRECT);
  });

  it("describeRedirectTo flags localhost", () => {
    const link = `${VERIFY_BASE}&redirect_to=${encodeURIComponent("http://localhost:3000")}`;
    const diag = describeRedirectTo(link);
    expect(diag.isLocalhost).toBe(true);
    expect(diag.redirectTo).toBe("http://localhost:3000");
  });

  it("rewrites localhost redirect_to to intended production target", () => {
    const link = `${VERIFY_BASE}&redirect_to=${encodeURIComponent("http://localhost:3000")}`;
    const normalized = normalizeRecoveryActionLink(link, CANONICAL_PASSWORD_RESET_REDIRECT);
    const diag = describeRedirectTo(normalized);
    expect(diag.isLocalhost).toBe(false);
    expect(diag.redirectTo).toBe(CANONICAL_PASSWORD_RESET_REDIRECT);
  });

  it("leaves production redirect_to unchanged", () => {
    const link = `${VERIFY_BASE}&redirect_to=${encodeURIComponent(CANONICAL_PASSWORD_RESET_REDIRECT)}`;
    expect(normalizeRecoveryActionLink(link, CANONICAL_PASSWORD_RESET_REDIRECT)).toBe(link);
  });
});
