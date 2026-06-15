import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { roleHomePath } from "@/lib/auth/roleHome";

const PAGE_PATH = join(process.cwd(), "app", "avtale-ikke-aktiv", "page.tsx");
const CLIENT_PATH = join(process.cwd(), "app", "avtale-ikke-aktiv", "InactiveAgreementRecovery.client.tsx");
const SERVER_HELPER_PATH = join(process.cwd(), "lib", "auth", "inactiveAgreementGateRecovery.ts");

describe("InactiveAgreementPage copy", () => {
  it("uses clear blocked-state copy without dead-end login link", () => {
    const page = readFileSync(PAGE_PATH, "utf-8");
    const client = readFileSync(CLIENT_PATH, "utf-8");

    expect(page).toContain("Avtalen er ikke aktiv");
    expect(page).toContain("Logg ut og inn igjen");
    expect(page).not.toContain('href="/login"');
    expect(page).not.toContain("Gå til innlogging");
    expect(client).toContain("Logg ut og gå til innlogging");
    expect(client).toContain("Prøv igjen");
    expect(client).toContain("Til forsiden");
  });

  it("does not contain mojibake markers", () => {
    const page = readFileSync(PAGE_PATH, "utf-8");
    const client = readFileSync(CLIENT_PATH, "utf-8");
    expect(page).not.toMatch(/Â|Ã|Å‰|â/);
    expect(client).not.toMatch(/Â|Ã|Å‰|â/);
  });
});

describe("InactiveAgreementRecovery actions", () => {
  it("logout uses /api/auth/logout instead of plain /login link", () => {
    const client = readFileSync(CLIENT_PATH, "utf-8");
    expect(client).toContain('fetch("/api/auth/logout"');
    expect(client).not.toMatch(/href=["']\/login["']/);
  });

  it("retry routes through canonical post-login", () => {
    const client = readFileSync(CLIENT_PATH, "utf-8");
    expect(client).toContain('"/api/auth/post-login"');
    expect(client).toContain("Prøv igjen");
  });

  it("provider recovery uses post-login, not agreement gate", () => {
    const client = readFileSync(CLIENT_PATH, "utf-8");
    expect(client).toContain("Åpne leverandørportalen");
    expect(client).toContain("Denne siden gjelder bedriftsavtaler");
    expect(client).not.toContain("/avtale-ikke-aktiv");
  });
});

describe("inactiveAgreementGateRecovery server helper", () => {
  it("uses resolveRoleHomeForUser redirect safety", () => {
    const source = readFileSync(SERVER_HELPER_PATH, "utf-8");
    expect(source).toContain("resolveRoleHomeForUser");
    expect(source).toContain("getProviderMemberships");
    expect(source).not.toMatch(/Melhus|Pettersen|post@melhus/);
  });
});

describe("provider misroute safety", () => {
  it("provider_admin does not resolve to /avtale-ikke-aktiv", () => {
    const dest = roleHomePath({
      profileRole: "company_admin",
      providerRole: "provider_admin",
      hasActiveAgreement: false,
    });
    expect(dest).toBe("/leverandor");
    expect(dest).not.toBe("/avtale-ikke-aktiv");
  });
});

describe("post-reset tests still valid", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("postResetRedirect still targets post-login", async () => {
    const { buildPostLoginRedirectUrl } = await import("@/lib/auth/postResetRedirect");
    expect(buildPostLoginRedirectUrl()).toBe("/api/auth/post-login");
  });
});
