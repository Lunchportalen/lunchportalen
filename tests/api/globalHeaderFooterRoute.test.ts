// @ts-nocheck
import fs from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { isApiAuthAllowlisted } from "@/lib/server/auth/apiAllowlist";

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
  denyResponse: (s: { res?: Response; response?: Response }) => s?.res ?? s?.response ?? new Response(null, { status: 401 }),
}));

import { POST as HeaderPOST, GET as HeaderGET } from "../../app/api/content/global/header/route";
import { POST as FooterPOST } from "../../app/api/content/global/footer/route";

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

const SAVE_BODY = { action: "save", data: { nav: [{ label: "Test", href: "/" }] } };

describe("apiAllowlist GET-only for global chrome", () => {
  it("allows anonymous GET bypass; blocks POST at middleware layer", () => {
    expect(isApiAuthAllowlisted("/api/content/global/header", "GET")).toBe(true);
    expect(isApiAuthAllowlisted("/api/content/global/header", "POST")).toBe(false);
    expect(isApiAuthAllowlisted("/api/content/global/footer", "GET")).toBe(true);
    expect(isApiAuthAllowlisted("/api/content/global/footer", "POST")).toBe(false);
  });
});

describe.each([
  ["header", HeaderPOST, "header"],
  ["footer", FooterPOST, "footer"],
])("POST /api/content/global/%s — superadmin gate", (label, handler, key) => {
  beforeEach(() => {
    vi.clearAllMocks();
    publishGlobalMock.mockResolvedValue({ ok: true, version: 2, data: {} });
    saveGlobalDraftMock.mockResolvedValue({ ok: true, version: 1, draft: {} });
  });

  it("prove-fire: scopeOr401 runs before saveGlobalDraft in POST handler", () => {
    const file = path.join(process.cwd(), "app", "api", "content", "global", label, "route.ts");
    const src = fs.readFileSync(file, "utf8");
    const postBlock = src.slice(src.indexOf("export async function POST"));
    const scopeIdx = postBlock.indexOf("scopeOr401");
    const saveIdx = postBlock.indexOf("saveGlobalDraft");
    expect(scopeIdx).toBeGreaterThan(-1);
    expect(saveIdx).toBeGreaterThan(scopeIdx);
  });

  it("anon → 401, no persistence (guard fires)", async () => {
    scopeOr401Mock.mockResolvedValue({
      ok: false,
      ctx: { rid: "rid_anon" },
      res: new Response(JSON.stringify({ ok: false, status: 401, error: "UNAUTHORIZED" }), { status: 401 }),
      response: new Response(JSON.stringify({ ok: false, status: 401, error: "UNAUTHORIZED" }), { status: 401 }),
    });

    const res = await handler(
      mkReq(`http://localhost/api/content/global/${label}`, { method: "POST", body: SAVE_BODY }),
    );

    expect(res.status).toBe(401);
    expect(saveGlobalDraftMock).not.toHaveBeenCalled();
    expect(publishGlobalMock).not.toHaveBeenCalled();
  });

  it("innlogget ikke-superadmin → 403, no persistence", async () => {
    scopeOr401Mock.mockResolvedValue({
      ok: true,
      ctx: { rid: "rid_ca", scope: { role: "company_admin" } },
    });
    requireRoleOr403Mock.mockReturnValue(
      new Response(JSON.stringify({ ok: false, status: 403, error: "FORBIDDEN" }), { status: 403 }),
    );

    const res = await handler(
      mkReq(`http://localhost/api/content/global/${label}`, { method: "POST", body: SAVE_BODY }),
    );

    expect(res.status).toBe(403);
    expect(saveGlobalDraftMock).not.toHaveBeenCalled();
  });

  it("superadmin → 200 save draft", async () => {
    scopeOr401Mock.mockResolvedValue({
      ok: true,
      ctx: { rid: "rid_sa", scope: { role: "superadmin" } },
    });
    requireRoleOr403Mock.mockReturnValue(null);

    const res = await handler(
      mkReq(`http://localhost/api/content/global/${label}`, { method: "POST", body: SAVE_BODY }),
    );

    expect(res.status).toBe(200);
    expect(saveGlobalDraftMock).toHaveBeenCalledWith(key, SAVE_BODY.data);
  });

  it("prove-fire negative control: without role gate save would run", async () => {
    scopeOr401Mock.mockResolvedValue({
      ok: true,
      ctx: { rid: "rid_open", scope: { role: "employee" } },
    });
    requireRoleOr403Mock.mockReturnValue(null);

    await handler(mkReq(`http://localhost/api/content/global/${label}`, { method: "POST", body: SAVE_BODY }));

    expect(saveGlobalDraftMock).toHaveBeenCalled();
  });
});

describe("GET /api/content/global/header — public read", () => {
  it("remains reachable without auth gate in handler", async () => {
    const file = path.join(process.cwd(), "app", "api", "content", "global", "header", "route.ts");
    const src = fs.readFileSync(file, "utf8");
    const getBlock = src.slice(src.indexOf("export async function GET"), src.indexOf("export async function POST"));
    expect(getBlock).not.toContain("scopeOr401");
    expect(HeaderGET).toBeTypeOf("function");
  });
});
