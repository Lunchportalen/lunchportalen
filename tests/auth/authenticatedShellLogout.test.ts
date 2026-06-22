import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

const ROOT = process.cwd();

function readSource(relPath: string) {
  return readFileSync(join(ROOT, relPath), "utf8");
}

describe("Authenticated shell logout", () => {
  it("Superadmin ControlTowerNav renders visible Logg ut via account section", () => {
    const nav = readSource("app/superadmin/_components/ControlTowerNav.tsx");
    const layout = readSource("app/superadmin/layout.tsx");
    const account = readSource("components/auth/AuthenticatedShellAccount.tsx");

    expect(nav).toContain("AuthenticatedShellAccount");
    expect(nav).toContain('roleLabel = "Superadmin"');
    expect(layout).toContain("ControlTowerNav userEmail={userEmail}");
    expect(account).toContain("LogoutClientButton");
    expect(account).toContain('aria-label="Logg ut"');
    expect(account).toContain("min-h-[48px]");
  });

  it("LogoutClientButton is keyboard accessible and calls logout API", () => {
    const logout = readSource("components/auth/LogoutClient.tsx");
    expect(logout).toContain('type="button"');
    expect(logout).toContain('fetch("/api/auth/logout"');
    expect(logout).toContain("disabled={isPending}");
    expect(logout).toContain('aria-busy={isPending}');
    expect(logout).toContain('window.location.href = "/login"');
    expect(logout).toContain("LOGOUT_ERROR_MESSAGE");
    expect(logout).toContain("Kunne ikke logge ut. Prøv igjen.");
  });

  it("Logout failure shows safe error without silent redirect on failure", async () => {
    const { performLogoutRedirect, LOGOUT_ERROR_MESSAGE } = await import("@/components/auth/LogoutClient");

    const fetchMock = vi.fn(async () => ({ ok: false, redirected: false, url: "" }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await performLogoutRedirect();
    expect(result).toEqual({ ok: false });
    expect(LOGOUT_ERROR_MESSAGE).toBe("Kunne ikke logge ut. Prøv igjen.");

    vi.unstubAllGlobals();
  });

  it("Provider shell has logout in navigation", () => {
    const nav = readSource("components/providers/ProviderNav.tsx");
    expect(nav).toContain("LogoutClientButton");
    expect(nav).toContain('labelKey: "logout"');
    expect(nav).toContain('action: "logout"');
  });

  it("Company admin shell has logout in topbar user menu", () => {
    const menu = readSource("app/admin/AdminTopbarUserMenu.client.tsx");
    expect(menu).toContain("LogoutClientButton");
  });

  it("Employee shell has logout in profile menu", () => {
    const profile = readSource("components/nav/ProfileMenu.tsx");
    expect(profile).toContain("LogoutClientButton");
  });

  it("does not touch auth model, order write-path, or Golden Path imports", () => {
    for (const rel of [
      "app/superadmin/layout.tsx",
      "app/superadmin/_components/ControlTowerNav.tsx",
      "components/auth/AuthenticatedShellAccount.tsx",
      "components/auth/LogoutClient.tsx",
      "components/auth/LogoutButton.tsx",
    ]) {
      const src = readSource(rel);
      expect(src).not.toContain("lp_order_set");
      expect(src).not.toContain("lp_order_advance_status");
      expect(src).not.toContain(".from(\"orders\")");
      expect(src).not.toMatch(/signInWithPassword|alter table/i);
    }
  });
});
