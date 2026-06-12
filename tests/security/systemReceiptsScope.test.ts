// @ts-nocheck
// Tenant-scope for GET /api/system/receipts:
// - kitchen leser kun eget company_id + location_id (server truth fra profil)
// - superadmin leser eksplisitt globalt
// - klientstyrte company_id/provider_id query-params kan aldri endre scope
import { describe, test, expect, vi, beforeEach } from "vitest";

type ScopeShape = {
  user_id: string;
  email: string;
  role: string;
  company_id: string | null;
  location_id: string | null;
  is_active: boolean;
};

const COMPANY_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const LOCATION_A = "aaaaaaaa-aaaa-4aaa-8aaa-bbbbbbbbbbbb";
const LOCATION_A2 = "aaaaaaaa-aaaa-4aaa-8aaa-cccccccccccc";
const COMPANY_B = "bbbbbbbb-bbbb-4bbb-8bbb-aaaaaaaaaaaa";
const LOCATION_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const DATE = "2026-06-12";

let scopeState: ScopeShape = {
  user_id: "u1",
  email: "kitchen.receipts@test.lunchportalen.no",
  role: "kitchen",
  company_id: COMPANY_A,
  location_id: LOCATION_A,
  is_active: true,
};

const authBridge = vi.hoisted(() => ({
  supabaseUser: null as { id: string; email: string } | null,
}));

/** Registrerte eq-filtre fra siste query mot v_receipt_rows. */
const queryProbe = vi.hoisted(() => ({
  table: "" as string,
  filters: [] as Array<[string, unknown]>,
}));

const FIXTURE_ROWS = [
  {
    order_id: "o-a1",
    delivery_date: DATE,
    company_id: COMPANY_A,
    company_name: "Firma A",
    location_id: LOCATION_A,
    location_name: "A Lokasjon 1",
    employee_name: "Ansatt A1",
    status: "confirmed",
  },
  {
    order_id: "o-a2",
    delivery_date: DATE,
    company_id: COMPANY_A,
    company_name: "Firma A",
    location_id: LOCATION_A2,
    location_name: "A Lokasjon 2",
    employee_name: "Ansatt A2",
    status: "confirmed",
  },
  {
    order_id: "o-b1",
    delivery_date: DATE,
    company_id: COMPANY_B,
    company_name: "Firma B",
    location_id: LOCATION_B,
    location_name: "B Lokasjon 1",
    employee_name: "Ansatt B1",
    status: "confirmed",
  },
];

vi.mock("@/lib/auth/scope", () => ({
  getScope: vi.fn(async () => ({ ...scopeState })),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({
    auth: {
      getUser: async () => {
        const u = authBridge.supabaseUser;
        if (!u) return { data: { user: null }, error: { message: "Auth session missing" } };
        return { data: { user: { id: u.id, email: u.email } }, error: null };
      },
    },
  }),
}));

vi.mock("@/lib/supabase/admin", () => {
  function makeBuilder(table: string) {
    const filters: Array<[string, unknown]> = [];
    const builder: any = {
      select: () => builder,
      eq: (col: string, val: unknown) => {
        filters.push([col, val]);
        return builder;
      },
      order: () => builder,
      then: (resolve: any) => {
        queryProbe.table = table;
        queryProbe.filters = filters;
        const data = FIXTURE_ROWS.filter((row: any) =>
          filters.every(([col, val]) => row[col] === val)
        );
        return resolve({ data, error: null });
      },
    };
    return builder;
  }

  return {
    hasSupabaseAdminConfig: () => true,
    supabaseAdmin: () => ({
      from: (table: string) => makeBuilder(table),
    }),
  };
});

function mkReq(url: string) {
  return new Request(url) as any;
}

async function readJson(res: Response) {
  const txt = await res.text();
  try {
    return JSON.parse(txt);
  } catch {
    return { raw: txt };
  }
}

function filterCols() {
  return queryProbe.filters.map(([col]) => col);
}

describe("GET /api/system/receipts — tenant scope", () => {
  beforeEach(() => {
    scopeState = {
      user_id: "u1",
      email: "kitchen.receipts@test.lunchportalen.no",
      role: "kitchen",
      company_id: COMPANY_A,
      location_id: LOCATION_A,
      is_active: true,
    };
    authBridge.supabaseUser = { id: "u1", email: scopeState.email };
    queryProbe.table = "";
    queryProbe.filters = [];
    vi.resetModules();
  });

  test("kitchen (company A, location A1) får kun egne rader — aldri company B", async () => {
    const mod = await import("../../app/api/system/receipts/route");
    const res = await mod.GET(mkReq(`http://localhost/api/system/receipts?date=${DATE}`));
    const body = await readJson(res);

    expect(res.status).toBe(200);
    expect(body?.ok).toBe(true);
    expect(Array.isArray(body?.data?.rows)).toBe(true);
    expect(body.data.rows).toHaveLength(1);
    expect(body.data.rows[0].order_id).toBe("o-a1");
    for (const row of body.data.rows) {
      expect(row.company_id).toBe(COMPANY_A);
      expect(row.location_id).toBe(LOCATION_A);
      expect(row.company_id).not.toBe(COMPANY_B);
    }

    // Server-side filter må være satt på service-role-queryen.
    expect(queryProbe.table).toBe("v_receipt_rows");
    expect(queryProbe.filters).toContainEqual(["delivery_date", DATE]);
    expect(queryProbe.filters).toContainEqual(["company_id", COMPANY_A]);
    expect(queryProbe.filters).toContainEqual(["location_id", LOCATION_A]);
  });

  test("kitchen ser ikke rader fra annen lokasjon i eget firma (location-scope)", async () => {
    scopeState.location_id = LOCATION_A2;

    const mod = await import("../../app/api/system/receipts/route");
    const res = await mod.GET(mkReq(`http://localhost/api/system/receipts?date=${DATE}`));
    const body = await readJson(res);

    expect(res.status).toBe(200);
    expect(body.data.rows).toHaveLength(1);
    expect(body.data.rows[0].order_id).toBe("o-a2");
    expect(body.data.rows[0].location_id).toBe(LOCATION_A2);
  });

  test("kitchen uten company/location-scope -> 403 fail-closed, ingen query", async () => {
    scopeState.company_id = null;
    scopeState.location_id = null;

    const mod = await import("../../app/api/system/receipts/route");
    const res = await mod.GET(mkReq(`http://localhost/api/system/receipts?date=${DATE}`));
    const body = await readJson(res);

    expect(res.status).toBe(403);
    expect(body?.ok).toBe(false);
    expect(body?.error).toBe("SCOPE_NOT_ASSIGNED");
    // Fail-closed: ingen global data skal være hentet.
    expect(queryProbe.table).toBe("");
  });

  test("superadmin leser globalt (eksplisitt) — kun datofilter", async () => {
    scopeState.role = "superadmin";
    scopeState.email = "superadmin.receipts@test.lunchportalen.no";
    scopeState.company_id = null;
    scopeState.location_id = null;
    authBridge.supabaseUser = { id: "u1", email: scopeState.email };

    const mod = await import("../../app/api/system/receipts/route");
    const res = await mod.GET(mkReq(`http://localhost/api/system/receipts?date=${DATE}`));
    const body = await readJson(res);

    expect(res.status).toBe(200);
    expect(body?.ok).toBe(true);
    expect(body.data.rows).toHaveLength(3);
    expect(filterCols()).toEqual(["delivery_date"]);
  });

  test("employee -> 403 FORBIDDEN", async () => {
    scopeState.role = "employee";
    scopeState.email = "employee.receipts@test.lunchportalen.no";
    authBridge.supabaseUser = { id: "u1", email: scopeState.email };

    const mod = await import("../../app/api/system/receipts/route");
    const res = await mod.GET(mkReq(`http://localhost/api/system/receipts?date=${DATE}`));
    const body = await readJson(res);

    expect(res.status).toBe(403);
    expect(body?.error).toBe("FORBIDDEN");
    expect(queryProbe.table).toBe("");
  });

  test("company_admin -> 403 FORBIDDEN", async () => {
    scopeState.role = "company_admin";
    scopeState.email = "admin.receipts@test.lunchportalen.no";
    authBridge.supabaseUser = { id: "u1", email: scopeState.email };

    const mod = await import("../../app/api/system/receipts/route");
    const res = await mod.GET(mkReq(`http://localhost/api/system/receipts?date=${DATE}`));
    const body = await readJson(res);

    expect(res.status).toBe(403);
    expect(body?.error).toBe("FORBIDDEN");
  });

  test("driver -> 403 FORBIDDEN", async () => {
    scopeState.role = "driver";
    scopeState.email = "driver.receipts@test.lunchportalen.no";
    authBridge.supabaseUser = { id: "u1", email: scopeState.email };

    const mod = await import("../../app/api/system/receipts/route");
    const res = await mod.GET(mkReq(`http://localhost/api/system/receipts?date=${DATE}`));
    const body = await readJson(res);

    expect(res.status).toBe(403);
    expect(body?.error).toBe("FORBIDDEN");
  });

  test("klientstyrt company_id/provider_id query-param kan ikke endre scope (bypass-forsøk)", async () => {
    const mod = await import("../../app/api/system/receipts/route");
    const res = await mod.GET(
      mkReq(
        `http://localhost/api/system/receipts?date=${DATE}&company_id=${COMPANY_B}&provider_id=${COMPANY_B}&location_id=${LOCATION_B}`
      )
    );
    const body = await readJson(res);

    expect(res.status).toBe(200);
    expect(body.data.rows).toHaveLength(1);
    expect(body.data.rows[0].company_id).toBe(COMPANY_A);
    // Filtrene kommer fra server-scope, ikke fra query params.
    expect(queryProbe.filters).toContainEqual(["company_id", COMPANY_A]);
    expect(queryProbe.filters).toContainEqual(["location_id", LOCATION_A]);
    expect(queryProbe.filters).not.toContainEqual(["company_id", COMPANY_B]);
    expect(queryProbe.filters).not.toContainEqual(["location_id", LOCATION_B]);
  });

  test("response-kontrakt { ok, rid, data } beholdes", async () => {
    const mod = await import("../../app/api/system/receipts/route");
    const res = await mod.GET(mkReq(`http://localhost/api/system/receipts?date=${DATE}`));
    const body = await readJson(res);

    expect(body?.ok).toBe(true);
    expect(typeof body?.rid).toBe("string");
    expect(body.rid.length).toBeGreaterThan(0);
    expect(body?.data).toBeTruthy();
    expect(body.data.date).toBe(DATE);
    expect(Array.isArray(body.data.rows)).toBe(true);
  });

  test("ugyldig dato -> 400 (uendret kontrakt)", async () => {
    const mod = await import("../../app/api/system/receipts/route");
    const res = await mod.GET(mkReq(`http://localhost/api/system/receipts?date=12-06-2026`));
    const body = await readJson(res);

    expect(res.status).toBe(400);
    expect(body?.ok).toBe(false);
  });
});
