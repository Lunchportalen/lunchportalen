// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from "vitest";

const saveGlobalDraftMock = vi.hoisted(() => vi.fn());
const publishGlobalMock = vi.hoisted(() => vi.fn());
const scopeOr401Mock = vi.hoisted(() => vi.fn());
const requireRoleOr403Mock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/cms/writeGlobal", () => ({
  saveGlobalDraft: (...args: unknown[]) => saveGlobalDraftMock(...args),
}));

vi.mock("@/lib/cms/publishGlobal", () => ({
  publishGlobal: (...args: unknown[]) => publishGlobalMock(...args),
}));

vi.mock("@/lib/http/routeGuard", () => ({
  scopeOr401: (...args: unknown[]) => scopeOr401Mock(...args),
  requireRoleOr403: (...args: unknown[]) => requireRoleOr403Mock(...args),
}));

import { POST as GlobalSettingsPOST } from "../../app/api/content/global/settings/route";
import { globalPublicGetResponse } from "@/lib/cms/readGlobal";

function mkReq(url: string, init?: RequestInit & { body?: unknown }) {
  const opts: RequestInit = { ...(init ?? {}) };
  if (init?.body !== undefined) {
    opts.body = typeof init.body === "string" ? init.body : JSON.stringify(init.body);
    opts.headers = {
      ...((init?.headers as Record<string, string> | undefined) ?? {}),
      "content-type": "application/json",
    };
  }
  return new Request(url, opts) as any;
}

describe("POST /api/content/global/settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    publishGlobalMock.mockResolvedValue({ ok: true, version: 2, data: { siteName: "Lunchportalen" } });
    saveGlobalDraftMock.mockResolvedValue({ ok: true, version: 1, draft: { siteName: "Lunchportalen" } });
  });

  it("fails closed for anonymous POST", async () => {
    scopeOr401Mock.mockResolvedValue({
      ok: false,
      ctx: { rid: "rid_auth" },
      res: new Response(JSON.stringify({ ok: false }), { status: 401 }),
    });

    const res = await GlobalSettingsPOST(
      mkReq("http://localhost/api/content/global/settings", {
        method: "POST",
        body: { action: "save", data: { siteName: "Lunchportalen" } },
      }),
    );

    expect(res.status).toBe(401);
    expect(saveGlobalDraftMock).not.toHaveBeenCalled();
    expect(publishGlobalMock).not.toHaveBeenCalled();
  });

  it("requires superadmin and persists save requests", async () => {
    scopeOr401Mock.mockResolvedValue({
      ok: true,
      ctx: { rid: "rid_superadmin", scope: { role: "superadmin" } },
    });
    requireRoleOr403Mock.mockReturnValue(null);

    const res = await GlobalSettingsPOST(
      mkReq("http://localhost/api/content/global/settings", {
        method: "POST",
        body: { action: "save", data: { siteName: "Lunchportalen" } },
      }),
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data?.status).toBe("draft");
    expect(saveGlobalDraftMock).toHaveBeenCalledWith("settings", { siteName: "Lunchportalen" });
    expect(publishGlobalMock).not.toHaveBeenCalled();
  });
});

describe("globalPublicGetResponse", () => {
  it("returns matching rid in body and x-rid header", async () => {
    const res = await globalPublicGetResponse("settings");
    const json = await res.json();

    expect(res.headers.get("x-rid")).toBeTruthy();
    expect(res.headers.get("x-rid")).toBe(json.rid);
    expect(json.ok).toBe(true);
  });
});
