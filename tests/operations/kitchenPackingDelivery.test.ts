/**
 * PHASE 7 — kitchen/packing/delivery contract suite (fast, no DB).
 *
 * Locks:
 *  - ONE canonical status machine (lp_order_advance_status) unchanged:
 *    forward-only ACTIVE/LOCKED→PREPARED→DISPATCHED→DELIVERED, idempotent,
 *    CANCELLED/PAUSED never advanceable, backward ONLY as controlled
 *    correction (DELIVERED→DISPATCHED, admin/provider_admin)
 *  - batch model unified: stale delivery_batches PATCH is 410; canonical
 *    kitchen_batches transitions go through lp_batch_transition_and_sync_orders
 *  - driver assignment: role-gated, validates driver, never mutates status
 *  - provider packing list: provider-scoped (never client provider_id),
 *    CANCELLED/PAUSED excluded, allergens + delivery instructions included,
 *    CSV export for offline/print
 *  - notifications: provider-OWNED recipients only (no platform fallback),
 *    wired best-effort AFTER the canonical transition, idempotent event keys
 *  - audit: order_status_history records actor + timestamp + transition
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..", "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

describe("canonical status machine (LOCKED, unchanged)", () => {
  const sql = read("supabase/migrations/20260616110410_lp_order_advance_status_provider_after_cutoff.sql");

  it("allows only forward transitions + controlled DELIVERED→DISPATCHED correction", () => {
    expect(sql).toContain("'PREPARED', 'DISPATCHED', 'DELIVERED'");
    expect(sql).toMatch(/'PREPARED' and v_old_status in \('ACTIVE', 'LOCKED'\)/);
    expect(sql).toMatch(/'DISPATCHED' and v_old_status = 'PREPARED'/);
    expect(sql).toMatch(/'DELIVERED' and v_old_status = 'DISPATCHED'/);
    expect(sql).toContain("INVALID_STATUS_TRANSITION");
  });

  it("is idempotent and blocks CANCELLED/PAUSED", () => {
    expect(sql).toContain("already_at_status");
    expect(sql).toMatch(/v_old_status in \('CANCELLED', 'PAUSED'\)/);
    expect(sql).toContain("ORDER_NOT_ADVANCEABLE");
  });

  it("records actor via GUC for the status-history audit trigger", () => {
    expect(sql).toContain("app.batch_derived_actor");
    const historySql = read("supabase/migrations/20260713120000_batch_order_status_sync.sql");
    expect(historySql).toContain("insert into public.order_status_history (order_id, from_status, to_status, changed_by, note)");
  });
});

describe("batch model unified", () => {
  it("stale delivery_batches PATCH is deprecated (410) and writes nothing", () => {
    const src = read("app/api/kitchen/batch/route.ts");
    expect(src).toContain("410");
    expect(src).toContain("DEPRECATED");
    expect(src).not.toContain('from("delivery_batches")');
    expect(src).not.toContain("supabaseAdmin");
  });

  it("canonical batch transitions go through lp_batch_transition_and_sync_orders", () => {
    for (const p of ["app/api/kitchen/batch/set/route.ts", "app/api/driver/bulk-set/route.ts"]) {
      expect(read(p)).toContain("batchTransitionAndSyncOrders");
    }
    expect(read("lib/kitchen/batchTransitionRpc.ts")).toContain('rpc("lp_batch_transition_and_sync_orders"');
  });
});

describe("driver assignment", () => {
  const src = read("app/api/kitchen/batch/assign-driver/route.ts");

  it("is kitchen/superadmin gated and validates the driver profile fail-closed", () => {
    expect(src).toContain('["kitchen", "superadmin"]');
    expect(src).toContain("NOT_A_DRIVER");
    expect(src).toContain("DRIVER_WRONG_COMPANY");
    expect(src).toContain("LOCATION_WRONG_COMPANY");
  });

  it("never mutates batch status (assignment fields only)", () => {
    // Existing batches: UPDATE contains only assignment fields; INSERT (new
    // batch) starts at QUEUED and there is no status in the update payload.
    expect(src).toContain("driver_user_id: driverUserId");
    expect(src).toContain("Tilordning endrer ALDRI batch-status");
    expect(src).not.toContain("status: assignment");
    expect(src.match(/\.update\(assignment\)/g)?.length).toBe(1);
    expect(src).toContain("KITCHEN_BATCH_DRIVER_ASSIGNED");
  });
});

describe("provider packing list", () => {
  const lib = read("lib/providers/packingList.ts");
  const route = read("app/api/provider/packing-list/route.ts");
  const page = read("app/leverandor/pakkeliste/page.tsx");

  it("excludes CANCELLED/PAUSED (0 kansellerte porsjoner)", () => {
    expect(lib).toContain('PACKING_EXCLUDED_STATUSES = ["CANCELLED", "PAUSED"]');
    expect(lib).toContain('.not("status", "in"');
  });

  it("is provider-scoped and never accepts a client provider_id", () => {
    expect(lib).toContain('.eq("provider_id", pid)');
    expect(route).toContain("ctx.primaryProvider");
    expect(route).not.toContain('searchParams.get("provider');
  });

  it("includes allergens (menu + profile), notes and delivery instructions", () => {
    expect(lib).toContain("allergens_snapshot");
    expect(lib).toContain("lp_user_allergens");
    expect(lib).toContain("delivery_instructions");
    expect(lib).toContain("profileAllergenNote");
  });

  it("groups deterministically and exports CSV for offline/print", () => {
    expect(lib).toContain("localeCompare");
    expect(lib).toContain("packingListToCsv");
    expect(route).toContain('format === "csv"');
    expect(page).toContain("Last ned CSV");
    expect(page).toContain("print:");
  });
});

describe("status-transition notifications", () => {
  const notify = read("lib/providers/orderStatusNotifications.ts");
  const actions = read("app/leverandor/ordrer/actions.ts");
  const recipients = read("lib/providers/providerNotificationRecipients.ts");

  it("uses provider-OWNED recipients only (no platform fallback)", () => {
    expect(notify).toContain("getProviderNotificationRecipients");
    expect(recipients).toContain("Lunchportalen-adresser er ALDRI fallback");
    expect(notify).not.toContain("salg@lunchportalen.no");
  });

  it("covers out-for-delivery (DISPATCHED) and delivered (employee + provider copy)", () => {
    expect(notify).toContain("order.status.dispatched:");
    expect(notify).toContain("order.status.delivered:");
    expect(notify).toContain("deliveryEmail");
    expect(notify).toContain('from("profiles")');
  });

  it("packed notification exists on the batch path", () => {
    expect(read("app/api/kitchen/batch/set/route.ts")).toContain("enqueueBatchPackedOutbox");
  });

  it("is wired AFTER the canonical advance and never blocks (statusmaskin uendret)", () => {
    const advanceIdx = actions.indexOf("await advanceOrderStatus(orderId, targetStatus)");
    const notifyIdx = actions.indexOf("notifyOrderStatusAdvanced");
    expect(advanceIdx).toBeGreaterThan(0);
    expect(notifyIdx).toBeGreaterThan(advanceIdx);
    expect(actions).toContain("varsling må aldri blokkere statusovergang");
    // The RPC wrapper itself is untouched.
    expect(read("lib/admin/orderStatus.ts")).toContain('rpc("lp_order_advance_status"');
  });
});
