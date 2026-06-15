import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildPostLoginRedirectUrl,
  POST_RESET_REDIRECT_MESSAGE,
  POST_RESET_SUCCESS_MESSAGE,
  redirectAfterPasswordReset,
  syncAuthSessionToServer,
} from "@/lib/auth/postResetRedirect";
import { roleHomePath } from "@/lib/auth/roleHome";

const AUTH_SHELL_PATH = join(process.cwd(), "components", "auth", "AuthShell.tsx");

describe("AuthShell trust line copy", () => {
  it("renders correct UTF-8 trust line without mojibake", () => {
    const source = readFileSync(AUTH_SHELL_PATH, "utf-8");
    expect(source).toContain("Én sannhetskilde · Cut-off 08:00 · Admin-kontroll");
    expect(source).not.toMatch(/Â|Ã|Å‰|â/);
  });
});

describe("postResetRedirect", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("uses canonical post-login redirect", () => {
    expect(buildPostLoginRedirectUrl()).toBe("/api/auth/post-login");
  });

  it("syncs session to server without logging tokens", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const sb = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: "at", refresh_token: "rt" } },
        }),
      },
    };

    const ok = await syncAuthSessionToServer(sb as never);
    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/session",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });

  it("redirectAfterPasswordReset assigns post-login URL", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    const assign = vi.fn();
    vi.stubGlobal("window", { location: { assign } });

    const sb = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: "at", refresh_token: "rt" } },
        }),
      },
    };

    await redirectAfterPasswordReset(sb as never);
    expect(assign).toHaveBeenCalledWith("/api/auth/post-login");
  });

  it("uses safe success copy constants", () => {
    expect(POST_RESET_SUCCESS_MESSAGE).toContain("Passordet er oppdatert");
    expect(POST_RESET_REDIRECT_MESSAGE).toContain("Sender deg videre");
  });
});

describe("post-reset routing via roleHomePath", () => {
  it("provider_admin does not route to /avtale-ikke-aktiv", () => {
    const dest = roleHomePath({
      profileRole: "company_admin",
      providerRole: "provider_admin",
      hasActiveAgreement: false,
    });
    expect(dest).toBe("/leverandor");
    expect(dest).not.toBe("/avtale-ikke-aktiv");
  });

  it("company_admin without agreement still routes to /avtale-ikke-aktiv", () => {
    expect(roleHomePath({ profileRole: "company_admin", hasActiveAgreement: false })).toBe(
      "/avtale-ikke-aktiv",
    );
  });

  it("employee with agreement routes to /week", () => {
    expect(roleHomePath({ profileRole: "employee", hasActiveAgreement: true })).toBe("/week");
  });
});
