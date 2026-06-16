import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION_PATH = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260714120000_lp_order_advance_status_provider_after_cutoff.sql",
);
const CUTOFF_TRIGGER_PATH = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260713120000_batch_order_status_sync.sql",
);
const ACTIONS_PATH = join(process.cwd(), "app", "leverandor", "ordrer", "actions.ts");
const ORDER_STATUS_PATH = join(process.cwd(), "lib", "admin", "orderStatus.ts");

describe("provider production after employee cutoff", () => {
  it("lp_order_advance_status uses batch_derived_advance GUC (not employee cutoff gate)", () => {
    const sql = readFileSync(MIGRATION_PATH, "utf-8");
    expect(sql).toContain("lp_order_advance_status");
    expect(sql).toContain("set_config('app.batch_derived_advance', '1', true)");
    expect(sql).toContain("lp_assert_provider_kitchen_access");
    expect(sql).not.toContain("lp_order_set");
  });

  it("employee cutoff trigger remains unchanged for normal mutations", () => {
    const sql = readFileSync(CUTOFF_TRIGGER_PATH, "utf-8");
    expect(sql).toContain("orders locked after 08:00 Oslo for today");
    expect(sql).toContain("tg_orders_cutoff_0800");
  });

  it("provider action still calls lp_order_advance_status RPC with provider guard", () => {
    const actions = readFileSync(ACTIONS_PATH, "utf-8");
    const orderStatus = readFileSync(ORDER_STATUS_PATH, "utf-8");
    expect(actions).toContain("hasProviderRole");
    expect(actions).toContain("provider_kitchen");
    expect(actions).toContain("advanceOrderStatus");
    expect(orderStatus).toContain('rpc("lp_order_advance_status"');
    expect(orderStatus).not.toContain("lp_order_set");
  });

  it("status label maps ACTIVE to Mottatt and PREPARED to I produksjon", async () => {
    const { kitchenStatusLabel } = await import("@/lib/providers/kitchenOrderStatus");
    expect(kitchenStatusLabel("ACTIVE")).toBe("Mottatt");
    expect(kitchenStatusLabel("PREPARED")).toBe("I produksjon");
  });
});
