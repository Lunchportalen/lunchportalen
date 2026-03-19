// tests/api/contentTree.test.ts
// @ts-nocheck

import { describe, test, expect, vi, beforeEach } from "vitest";

function mkReq(url: string, init?: RequestInit & { headers?: Record<string, string> }) {
  const { headers = {}, ...rest } = init ?? {};
  return new Request(url, { ...rest, headers }) as any;
}

async function readJson(res: Response) {
  const t = await res.text();
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    return { _raw: t };
  }
}

/* =========================================================
   Mocks – tree guard + supabase admin
========================================================= */

const MOCK_RID = "rid_test_tree";

vi.mock("@/lib/http/routeGuard", () => ({
  scopeOr401: vi.fn(async () => ({
    ok: true,
    ctx: {
      rid: MOCK_RID,
      route: "/api/backoffice/content/tree",
      method: "GET",
      scope: { role: "superadmin" },
    },
  })),
  requireRoleOr403: vi.fn(() => null),
  readJson: vi.fn(async (req: any) => {
    try {
      return await req.json();
    } catch {
      try {
        const raw = await req.text();
        return raw ? JSON.parse(raw) : {};
      } catch {
        return {};
      }
    }
  }),
}));

let mockTreeRows: Array<any> = [];
let mockMoveUpdateResult: { data: any; error: any } = { data: null, error: null };
let mockParentLookup: Record<string, { id: string; tree_parent_id: string | null }> = {};

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: (table: string) => {
      if (table !== "content_pages") {
        throw new Error(`Unexpected table: ${table}`);
      }

      const state: { mode: "select" | "update"; id: string | null } = {
        mode: "select",
        id: null,
      };

      const q: any = {
        select(_cols?: string) {
          // remain in current mode; used for both select and update+select
          return q;
        },
        order(_col?: string, _opts?: any) {
          // used only in tree GET; chaining ends with await, handled by then()
          return q;
        },
        update(_updates: any) {
          state.mode = "update";
          return q;
        },
        eq(col: string, val: string) {
          if (col === "id") {
            state.id = val;
          }
          return q;
        },
        async single() {
          if (state.mode === "update") {
            return mockMoveUpdateResult;
          }
          const row = state.id ? mockParentLookup[state.id] ?? null : null;
          return { data: row, error: null };
        },
        async maybeSingle() {
          const row = state.id ? mockParentLookup[state.id] ?? null : null;
          return { data: row, error: null };
        },
        then(resolve: (value: { data: any; error: any }) => void) {
          // allow: const { data, error } = await from().select().order().order()
          resolve({ data: mockTreeRows, error: null });
        },
      };

      return q;
    },
  }),
}));

/* =========================================================
   Imports
========================================================= */

import { GET as TreeGET } from "../../app/api/backoffice/content/tree/route";
import { POST as TreeMovePOST } from "../../app/api/backoffice/content/tree/move/route";

/* =========================================================
   Tests
========================================================= */

describe("Backoffice content tree API", () => {
  beforeEach(() => {
    mockTreeRows = [];
    mockMoveUpdateResult = { data: null, error: null };
    mockParentLookup = {};
    vi.clearAllMocks();
  });

  test("GET /api/backoffice/content/tree builds roots with children in sort order", async () => {
    mockTreeRows = [
      {
        id: "p1",
        title: "Hjem-siden",
        slug: "home",
        status: "draft",
        page_key: "home",
        tree_parent_id: null,
        tree_root_key: "home",
        tree_sort_order: 0,
      },
      {
        id: "p2",
        title: "Dashboard",
        slug: "dashboard",
        status: "published",
        page_key: "overlay_dashboard",
        tree_parent_id: null,
        tree_root_key: "overlays",
        tree_sort_order: 1,
      },
      {
        id: "p3",
        title: "Week",
        slug: "week",
        status: "draft",
        page_key: "employee_week",
        tree_parent_id: null,
        tree_root_key: "overlays",
        tree_sort_order: 0,
      },
    ];

    const req = mkReq("http://localhost/api/backoffice/content/tree", { method: "GET" });
    const res = await TreeGET(req);
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.ok).toBe(true);
    const roots = json.data?.roots ?? json.data ?? [];
    const homeRoot = roots.find((r: any) => r.id === "home");
    const overlaysRoot = roots.find((r: any) => r.id === "overlays");
    // Hjem is a virtual root: should have targetPageId bound to Forside (p1) and fixed app pages as children.
    expect(homeRoot.targetPageId).toBe("p1");
    // Fixed app page "Week" (employee_week) should appear under Hjem, not under overlays.
    expect(homeRoot.children.map((c: any) => c.id)).toEqual(["p3"]);
    // Overlays root should only contain remaining overlay pages (here: Dashboard).
    expect(overlaysRoot.children.map((c: any) => c.id)).toEqual(["p2"]);
    // Exactly one "Hjem" in the tree: one root with id "home".
    const homeNodes = roots.filter((r: any) => r.id === "home");
    expect(homeNodes.length).toBe(1);
    expect(homeNodes[0].name).toBe("Hjem");
  });

  test("GET /api/backoffice/content/tree returns exactly one Hjem root (no duplicate)", async () => {
    mockTreeRows = [
      {
        id: "p1",
        title: "Hjem",
        slug: "home",
        status: "draft",
        page_key: "home",
        tree_parent_id: null,
        tree_root_key: "home",
        tree_sort_order: 0,
      },
    ];
    const req = mkReq("http://localhost/api/backoffice/content/tree", { method: "GET" });
    const res = await TreeGET(req);
    expect(res.status).toBe(200);
    const json = await readJson(res);
    const roots = json.data?.roots ?? [];
    const withIdHome = roots.filter((r: any) => r.id === "home");
    expect(withIdHome.length).toBe(1);
    expect(withIdHome[0].name).toBe("Hjem");
    expect(withIdHome[0].targetPageId).toBe("p1");
    // Real page with slug "home" is not rendered as a second tree node; only as targetPageId.
    const allIds = roots.flatMap((r: any) => [r.id, ...(r.children ?? []).map((c: any) => c.id)]);
    expect(allIds.filter((id: string) => id === "p1").length).toBe(0);
  });

  test("selecting home root: when selectedId is targetPageId, home row is considered selected", () => {
    const homeNode = { id: "home", nodeType: "root" as const, targetPageId: "p1-forside-uuid" };
    const selectedId = "p1-forside-uuid";
    const isSelected =
      selectedId === homeNode.id ||
      (homeNode.nodeType === "root" && homeNode.targetPageId != null && selectedId === homeNode.targetPageId);
    expect(isSelected).toBe(true);
  });

  test("POST /api/backoffice/content/tree/move rejects cycles (parent is page itself)", async () => {
    mockMoveUpdateResult = { data: { id: "p1", tree_parent_id: null, tree_root_key: "home", tree_sort_order: 0 }, error: null };
    const req = mkReq("http://localhost/api/backoffice/content/tree/move", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ page_id: "p1", parent_page_id: "p1" }),
    });
    const res = await TreeMovePOST(req);
    expect(res.status).toBe(400);
    const json = await readJson(res);
    expect(json.error).toBe("CYCLE_FORBIDDEN");
  });

  test("POST /api/backoffice/content/tree/move rejects cycles when parent is descendant", async () => {
    mockParentLookup = {
      p2: { id: "p2", tree_parent_id: "p1" },
      p1: { id: "p1", tree_parent_id: null },
    };
    mockMoveUpdateResult = { data: { id: "p1", tree_parent_id: "p2", tree_root_key: null, tree_sort_order: 0 }, error: null };
    const req = mkReq("http://localhost/api/backoffice/content/tree/move", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ page_id: "p1", parent_page_id: "p2" }),
    });
    const res = await TreeMovePOST(req);
    expect(res.status).toBe(400);
    const json = await readJson(res);
    expect(json.error).toBe("CYCLE_FORBIDDEN");
  });

  test("POST /api/backoffice/content/tree/move accepts valid move to root", async () => {
    mockMoveUpdateResult = {
      data: { id: "p1", tree_parent_id: null, tree_root_key: "global", tree_sort_order: 10 },
      error: null,
    };
    const req = mkReq("http://localhost/api/backoffice/content/tree/move", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ page_id: "p1", parent_page_id: null, root_key: "global", sort_order: 10 }),
    });
    const res = await TreeMovePOST(req);
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.ok).toBe(true);
    expect(json.data?.page?.tree_root_key ?? json.page?.tree_root_key).toBe("global");
  });
});

