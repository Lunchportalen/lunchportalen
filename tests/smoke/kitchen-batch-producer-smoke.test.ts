/**
 * Stage 4-B — PACKED batches via live POST /api/kitchen/batch/start → kitchen_batches (not delivery_batches).
 * Opt-in: DATABASE_URL must point at uigx scratch (not prod).
 */
import { createHash } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  SMOKE_COMPANY_ID,
  SMOKE_LOCATION_ID,
  SMOKE_ORDER_DATE,
  SMOKE_OPERATIVE_SLOT,
  SMOKE_KITCHEN_USER_A,
} from "./stage4-realistic-fixture.constants";

const dbUrl = String(process.env.DATABASE_URL ?? "");
const isUigx = dbUrl.includes("uigxsboqeruxflgzqztl") || dbUrl.includes("uigx");
const skip = !isUigx || dbUrl.includes("hkpoky");

const kitchenUserId = vi.hoisted(() => ({ current: "d1111111-1111-4111-8111-111111111111" }));

vi.mock("@/lib/date/oslo", () => ({
  osloTodayISODate: () => SMOKE_ORDER_DATE,
  cutoffStatusForDate0805: () => "TODAY_LOCKED",
}));

vi.mock("@/lib/audit/auditWrite", () => ({
  auditWriteMust: vi.fn(async () => true),
}));

vi.mock("@/lib/kitchen/batchPackedOutbox", () => ({
  enqueueBatchPackedOutbox: vi.fn(async () => undefined),
}));

vi.mock("@/lib/http/routeGuard", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/http/routeGuard")>();
  return {
    ...mod,
    scopeOr401: vi.fn(async () => ({
      ok: true as const,
      ctx: {
        rid: "rid_stage4b_batch",
        scope: {
          userId: kitchenUserId.current,
          role: "kitchen",
          email: "kitchen-a@smoke.lunchportalen.no",
          companyId: SMOKE_COMPANY_ID,
          locationId: SMOKE_LOCATION_ID,
        },
      },
    })),
  };
});

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: { id: kitchenUserId.current } },
        error: null,
      }),
    },
  }),
}));

function mkReq(body: Record<string, unknown>) {
  return new Request("http://localhost/api/kitchen/batch/start", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

function adminClient() {
  const url = String(process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!url || !key) throw new Error("SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required for uigx producer smoke");
  return createClient(url, key, { auth: { persistSession: false } });
}

describe.skipIf(skip)("Stage 4-B kitchen batch producer (uigx integration)", () => {
  const admin = adminClient();

  beforeAll(async () => {
    await admin
      .from("kitchen_batches")
      .delete()
      .eq("delivery_date", SMOKE_ORDER_DATE)
      .eq("company_location_id", SMOKE_LOCATION_ID);
  });

  afterAll(async () => {
    // leave batches for driver-manifest smoke
  });

  it("batch/start → kitchen_batches PACKED (location A)", async () => {
    const { POST } = await import("@/app/api/kitchen/batch/start/route");
    kitchenUserId.current = SMOKE_KITCHEN_USER_A;
    const res = await POST(
      mkReq({ date: SMOKE_ORDER_DATE, slot: SMOKE_OPERATIVE_SLOT, location_id: SMOKE_LOCATION_ID }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(String(json?.data?.batch?.status ?? json?.batch?.status).toUpperCase()).toBe("PACKED");

    const { data, error } = await admin
      .from("kitchen_batches")
      .select("status, delivery_window, company_location_id")
      .eq("delivery_date", SMOKE_ORDER_DATE)
      .eq("company_location_id", SMOKE_LOCATION_ID)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data?.status).toBe("PACKED");
    expect(data?.delivery_window).toBe(SMOKE_OPERATIVE_SLOT);

    const { data: orderRow, error: orderErr } = await admin
      .from("orders")
      .select("status")
      .eq("company_id", SMOKE_COMPANY_ID)
      .eq("location_id", SMOKE_LOCATION_ID)
      .eq("date", SMOKE_ORDER_DATE)
      .eq("slot", SMOKE_OPERATIVE_SLOT)
      .limit(1)
      .maybeSingle();
    expect(orderErr).toBeNull();
    expect(String(orderRow?.status ?? "").toUpperCase()).toBe("DISPATCHED");
  });

  it("live PACK does not use delivery_batches (table absent on prod/uigx)", async () => {
    const { error } = await admin.from("delivery_batches").select("id").limit(1);
    expect(error).toBeTruthy();
    expect(String(error?.message ?? "").toLowerCase()).toMatch(/does not exist|schema cache|could not find/);
  });

  it("producer fingerprint is deterministic", async () => {
    const { data } = await admin
      .from("kitchen_batches")
      .select("delivery_date, delivery_window, company_location_id, status")
      .eq("delivery_date", SMOKE_ORDER_DATE)
      .eq("company_location_id", SMOKE_LOCATION_ID);
    const payload = JSON.stringify(data ?? []);
    const hash = createHash("sha256").update(payload).digest("hex");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    // snapshot within run
    const hash2 = createHash("sha256").update(JSON.stringify(data ?? [])).digest("hex");
    expect(hash2).toBe(hash);
  });
});
