// @ts-nocheck
import { beforeEach, describe, expect, test, vi } from "vitest";

function mkReq(body: unknown) {
  return new Request("http://localhost/api/orders", {
    method: "POST",
    headers: { "content-type": "application/json", "x-rid": "rid_test" },
    body: JSON.stringify(body),
  }) as any;
}

async function readJson(res: Response) {
  return JSON.parse(await res.text());
}

let dayTiers: any;
let rpcStatus: "ACTIVE" | "CANCELLED";
/** Last params passed to `lp_order_set` (DB owns day_choices — HTTP upsert removed). */
let lastLpOrderSetParams: Record<string, unknown> | null;

const resolveOrderDayItemPersist = vi.hoisted(() =>
  vi.fn(async () => ({ ok: true, item_key: null, item_title_snapshot: null })),
);

vi.mock("@/lib/orders/resolveOrderDayItemPersist", () => ({
  resolveOrderDayItemPersist,
}));

vi.mock("@/lib/http/routeGuard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/http/routeGuard")>();
  return {
    ...actual,
    scopeOr401: async () => ({
      ok: true,
      ctx: {
        rid: "rid_test",
        route: "/api/orders",
        method: "POST",
        scope: { userId: "u1", companyId: "c1", locationId: "l1", role: "employee", email: "emp@test.no" },
      },
    }),
    requireRoleOr403: () => null,
    readJson: async (req: Request) => req.json(),
  };
});

vi.mock("@/lib/system/enforcement", () => ({
  enforceSystemGate: async () => {},
}));

vi.mock("@/lib/orders/companyOrderEligibility", () => ({
  assertCompanyOrderWriteAllowed: async () => ({ ok: true }),
}));

vi.mock("@/lib/orders/orderWriteGuard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/orders/orderWriteGuard")>();
  return {
    ...actual,
    assertOrderWithinAgreementPreflight: async () => ({ ok: true }),
  };
});

vi.mock("@/lib/auth/agreementStatus", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/agreementStatus")>();
  return {
    ...actual,
    getAgreementStatus: async () => ({
      agreementId: "ag_1",
      tier: "BASIS",
      dayTiers,
      status: "ACTIVE",
      isActive: true,
      billingHold: false,
    }),
  };
});

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({
    rpc: async (fn: string, params?: Record<string, unknown>) => {
      if (fn === "lp_order_set") lastLpOrderSetParams = params ?? null;
      return {
        data: [{ order_id: "ord_1", status: rpcStatus, date: rpcStatus === "CANCELLED" ? "2026-05-20" : "2026-05-18" }],
        error: null,
      };
    },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: (_table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { line_total: 0 }, error: null }),
        }),
      }),
      insert: async () => ({ error: null }),
      upsert: async () => ({ error: null }),
    }),
  }),
}));

import { POST } from "@/app/api/orders/route";

beforeEach(() => {
  dayTiers = { mon: "BASIS", tue: "BASIS", wed: "LUXUS", thu: "BASIS", fri: "ENTERPRISE" };
  rpcStatus = "ACTIVE";
  lastLpOrderSetParams = null;
  resolveOrderDayItemPersist.mockResolvedValue({ ok: true, item_key: null, item_title_snapshot: null });
});

describe("POST /api/orders tier-per-day validation", () => {
  test("SET med tier=null returnerer 422 NO_TIER_FOR_DAY", async () => {
    dayTiers.wed = null;

    const res = await POST(mkReq({ date: "2026-05-20", action: "set", choice_key: "varmmat" }));
    const json = await readJson(res);

    expect(res.status).toBe(422);
    expect(json.error).toBe("NO_TIER_FOR_DAY");
    expect(json.date).toBe("2026-05-20");
  });

  test("SET uten choice_key for BASIS-dag returnerer 422 CHOICE_REQUIRED", async () => {
    const res = await POST(mkReq({ date: "2026-05-18", action: "set" }));
    const json = await readJson(res);

    expect(res.status).toBe(422);
    expect(json.error).toBe("CHOICE_REQUIRED");
    expect(json.available_choices).toEqual(["paasmurt", "salatboks", "varmmat"]);
  });

  test("SET med ugyldig choice_key returnerer 422 INVALID_CHOICE", async () => {
    const res = await POST(mkReq({ date: "2026-05-18", action: "set", choice_key: "ikke-en-kategori" }));
    const json = await readJson(res);

    expect(res.status).toBe(422);
    expect(json.error).toBe("INVALID_CHOICE");
  });

  test("SET med gyldig choice_key for BASIS returnerer 200", async () => {
    const res = await POST(mkReq({ date: "2026-05-18", action: "set", choice_key: "varmmat" }));
    const json = await readJson(res);

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.tier).toBe("BASIS");
    expect(lastLpOrderSetParams?.p_choice_key).toBe("varmmat");
    expect(lastLpOrderSetParams?.p_item_key).toBe("default");
  });

  test("SET persist item_key/item_title_snapshot når resolver bekrefter valg", async () => {
    resolveOrderDayItemPersist.mockResolvedValueOnce({
      ok: true,
      item_key: "kylling",
      item_title_snapshot: "Kylling OG grønn salat",
    });

    const res = await POST(
      mkReq({ date: "2026-05-18", action: "set", choice_key: "salatboks", itemKey: "kylling" }),
    );
    const json = await readJson(res);

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(lastLpOrderSetParams?.p_choice_key).toBe("salatboks");
    expect(lastLpOrderSetParams?.p_item_key).toBe("kylling");
  });

  test("SET sender server-resolvet menuScope til resolveOrderDayItemPersist", async () => {
    // supabaseAdmin-mocken har ingen provider_id på company → legacy-unscoped.
    const res = await POST(mkReq({ date: "2026-05-18", action: "set", choice_key: "salatboks", itemKey: "kylling" }));

    expect(res.status).toBe(200);
    expect(resolveOrderDayItemPersist).toHaveBeenCalledWith(
      expect.objectContaining({ menuScope: { mode: "legacy-unscoped" } }),
    );
  });

  test("SET returnerer 400 ITEM_CHOICE_REQUIRED når resolver sier manglende variant", async () => {
    resolveOrderDayItemPersist.mockResolvedValueOnce({
      ok: false,
      status: 400,
      code: "ITEM_CHOICE_REQUIRED",
      message: "Item-valg påkrevd for denne kategorien.",
    });

    const res = await POST(mkReq({ date: "2026-05-18", action: "set", choice_key: "salatboks" }));
    const json = await readJson(res);

    expect(res.status).toBe(400);
    expect(json.error).toBe("ITEM_CHOICE_REQUIRED");
  });

  test("SET returnerer 400 INVALID_ITEM_CHOICE ved gal itemKey", async () => {
    resolveOrderDayItemPersist.mockResolvedValueOnce({
      ok: false,
      status: 400,
      code: "INVALID_ITEM_CHOICE",
      message: "Ugyldig item-valg for kategorien.",
    });

    const res = await POST(
      mkReq({ date: "2026-05-18", action: "set", choice_key: "salatboks", itemKey: "finnes-ikke" }),
    );
    const json = await readJson(res);

    expect(res.status).toBe(400);
    expect(json.error).toBe("INVALID_ITEM_CHOICE");
  });

  test("SET med gyldig choice_key for LUXUS returnerer 200", async () => {
    const res = await POST(mkReq({ date: "2026-05-20", action: "set", choice_key: "sushi" }));
    const json = await readJson(res);

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.tier).toBe("LUXUS");
    expect(lastLpOrderSetParams?.p_choice_key).toBe("sushi");
  });

  test("SET med gyldig choice_key for ENTERPRISE returnerer 200", async () => {
    const res = await POST(mkReq({ date: "2026-05-22", action: "set", choice_key: "pokebowl" }));
    const json = await readJson(res);

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.tier).toBe("ENTERPRISE");
  });

  test("CANCEL tillates selv om tier er null", async () => {
    dayTiers.wed = null;
    rpcStatus = "CANCELLED";

    const res = await POST(mkReq({ date: "2026-05-20", action: "cancel" }));
    const json = await readJson(res);

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(lastLpOrderSetParams?.p_action).toBe("CANCEL");
    expect(lastLpOrderSetParams?.p_date).toBe("2026-05-20");
  });

  test("weekend-dato returnerer 422 INVALID_DAY", async () => {
    const res = await POST(mkReq({ date: "2026-05-23", action: "set", choice_key: "varmmat" }));
    const json = await readJson(res);

    expect(res.status).toBe(422);
    expect(json.error).toBe("INVALID_DAY");
  });
});
