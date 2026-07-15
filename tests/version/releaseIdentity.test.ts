import { describe, expect, test } from "vitest";

import { releaseIdentityRequired, resolveReleaseIdentity } from "@/lib/version/releaseIdentity";

const SHA = "5cf96d7457292976faac4a6decc8763baf0aa48f";

describe("resolveReleaseIdentity", () => {
  test("prefers VERCEL_GIT_COMMIT_SHA when present", () => {
    const id = resolveReleaseIdentity({
      VERCEL_GIT_COMMIT_SHA: SHA,
      APP_VERSION: "other",
    });
    expect(id.ok).toBe(true);
    expect(id.version).toBe(SHA);
    expect(id.source).toBe("vercel_git_commit_sha");
    expect(id.gitSha).toBe(SHA);
  });

  test("falls back to APP_VERSION for controlled CLI staging builds", () => {
    const id = resolveReleaseIdentity({
      APP_VERSION: SHA,
    });
    expect(id.ok).toBe(true);
    expect(id.version).toBe(SHA);
    expect(id.source).toBe("app_version");
    expect(id.gitSha).toBe(SHA);
  });

  test("missing both is fail-closed", () => {
    const id = resolveReleaseIdentity({});
    expect(id.ok).toBe(false);
    expect(id.source).toBe("missing");
    expect(id.version).toBe("");
  });

  test("never treats literal unknown as valid APP_VERSION", () => {
    const id = resolveReleaseIdentity({ APP_VERSION: "unknown" });
    expect(id.ok).toBe(false);
  });

  test("releaseIdentityRequired in RC/staging modes", () => {
    expect(releaseIdentityRequired({ RC_MODE: "true" })).toBe(true);
    expect(releaseIdentityRequired({ VERCEL_ENV: "staging" })).toBe(true);
    expect(releaseIdentityRequired({ NODE_ENV: "test" })).toBe(false);
  });
});
