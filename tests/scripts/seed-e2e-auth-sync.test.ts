import { describe, expect, it } from "vitest";

import { shouldSkipAuthPasswordSync } from "../../scripts/e2e/seed-e2e-auth-sync.mjs";

describe("seed-e2e-auth-sync", () => {
  it("skips updateUserById when login works and email is confirmed", () => {
    expect(
      shouldSkipAuthPasswordSync({
        userExists: true,
        loginVerified: true,
        emailConfirmed: true,
      }),
    ).toBe(true);
  });

  it("syncs when password grant fails", () => {
    expect(
      shouldSkipAuthPasswordSync({
        userExists: true,
        loginVerified: false,
        emailConfirmed: true,
      }),
    ).toBe(false);
  });

  it("syncs when email is not confirmed", () => {
    expect(
      shouldSkipAuthPasswordSync({
        userExists: true,
        loginVerified: true,
        emailConfirmed: false,
      }),
    ).toBe(false);
  });

  it("syncs for new users (caller creates via createUser)", () => {
    expect(
      shouldSkipAuthPasswordSync({
        userExists: false,
        loginVerified: false,
        emailConfirmed: false,
      }),
    ).toBe(false);
  });
});
