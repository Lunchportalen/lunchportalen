/**
 * PHASE 6 — weekly ordering + cancellation contract suite (fast, no DB).
 *
 * Locks the Golden Path law for the new weekly flow:
 *  - the bulk route contains ZERO order logic and ZERO table writes — it only
 *    delegates to the canonical POST /api/orders (lp_order_set per day)
 *  - deprecated split-brain day_choices routes stay 410 (never revived)
 *  - per-day idempotency keys derive deterministically from the bulk key
 *  - post-write side effects (audit, employee confirmation, provider cancel
 *    notification, commission correction) are best-effort and wired AFTER the
 *    canonical write — lp_order_set semantics unchanged
 *  - week UI bulk card is canonical-only and gated by canAct
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..", "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

describe("bulk route — canonical engine only", () => {
  const src = read("app/api/orders/week-bulk/route.ts");

  it("delegates every day to the canonical POST /api/orders handler", () => {
    expect(src).toContain('import { POST as canonicalOrderPOST } from "@/app/api/orders/route"');
    expect(src).toContain("await canonicalOrderPOST(delegated)");
  });

  it("has zero direct table writes and zero own RPC calls (no split-brain)", () => {
    // Code-only view (comments stripped): the header comment references the
    // deprecated day_choices routes by name, which is documentation, not code.
    const code = src
      .split("\n")
      .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
      .join("\n");
    expect(code).not.toContain(".from(");
    expect(code).not.toContain('.rpc("');
    expect(code).not.toContain("day_choices");
    expect(code).not.toContain("supabaseAdmin");
  });

  it("derives per-day idempotency keys from a stable bulk key (retry-safe)", () => {
    expect(src).toContain("`${bulkKey}:${day.date}:${day.action}`");
    expect(src).toContain('h.set("Idempotency-Key", idemKey)');
  });

  it("is atomic per selected action: failures are reported per day, never abort the loop", () => {
    expect(src).toContain("continue");
    expect(src).toContain("results.push");
    expect(src).toContain("summary: { requested: results.length, succeeded, failed: results.length - succeeded }");
  });

  it("validates 1–7 unique ISO weekday dates and set|cancel actions", () => {
    expect(src).toContain("MAX_DAYS = 7");
    expect(src).toContain("Duplisert dato");
    expect(src).toContain("BULK_VALIDATION_FAILED");
  });

  it("requires employee/company_admin role", () => {
    expect(src).toContain('["employee", "company_admin"]');
  });
});

describe("deprecated split-brain routes stay dead", () => {
  for (const p of [
    "app/api/order/bulk-set/route.ts",
    "app/api/order/cancel/route.ts",
    "app/api/order/set-choice/route.ts",
    "app/api/order/set-day/route.ts",
  ]) {
    it(`${p} still returns 410`, () => {
      const src = read(p);
      expect(src).toMatch(/410/);
      expect(src).not.toMatch(/from\("day_choices"\)\s*\.\s*(insert|upsert|update)/);
    });
  }
});

describe("canonical route — side effects wired after successful write", () => {
  const src = read("app/api/orders/route.ts");

  it("runs best-effort side effects AFTER lp_order_set success and outbox fanout", () => {
    const rpcIdx = src.indexOf('rpc("lp_order_set"');
    const fanoutIdx = src.indexOf("fanoutLpOrderSetOutboxBestEffort({");
    const sideIdx = src.indexOf("runOrderWriteSideEffects");
    expect(rpcIdx).toBeGreaterThan(0);
    expect(fanoutIdx).toBeGreaterThan(rpcIdx);
    expect(sideIdx).toBeGreaterThan(fanoutIdx);
    // Never blocking: wrapped in try/catch with explicit no-block comment.
    expect(src).toContain("side effects must never block the order response");
  });

  it("lp_order_set call signature is unchanged (Golden Path)", () => {
    expect(src).toContain("p_date: date");
    expect(src).toContain("p_action: action");
    expect(src).toContain("p_slot: tableSlot");
    expect(src).toContain('p_item_key: persistedItemKey ?? "default"');
  });
});

describe("side effects module — economic correction + notifications", () => {
  const src = read("lib/orders/orderWriteSideEffects.ts");

  it("audits SET and CANCEL", () => {
    expect(src).toContain('"ORDER_CANCELLED" : "ORDER_SET"');
  });

  it("sends employee confirmation via idempotent outbox upsert (locale-correct date)", () => {
    expect(src).toContain("order.email:");
    expect(src).toContain("Lunsj bestilt");
    expect(src).toContain("Lunsj avbestilt");
    expect(src).toContain("isoToDDMMYYYY");
  });

  it("notifies provider on cancel via the provider-routed outbox helper", () => {
    expect(src).toContain("persistDayChoiceOrderCancelOutbox");
    expect(src).toContain("order.cancel.notify:");
  });

  it("posts idempotent commission-basis correction on cancel", () => {
    expect(src).toContain("lp_billing_post_negative_commission_for_order");
    expect(src).toContain('"ORDER_CANCELLED"');
  });

  it("never throws (all effects wrapped, fire-and-forget)", () => {
    const tryCount = (src.match(/try \{/g) ?? []).length;
    expect(tryCount).toBeGreaterThanOrEqual(4);
    expect(src).not.toMatch(/^\s*throw /m);
  });
});

describe("week UI — bulk card is canonical-only and gated", () => {
  it("client renders WeekBulkOrderCard only when canAct and not preview", () => {
    const src = read("app/(app)/week/EmployeeWeekClient.tsx");
    expect(src).toContain("!readOnlyPreview && canAct && activeDay ? (");
    expect(src).toContain("WeekBulkOrderCard");
  });

  it("bulk card posts to /api/orders/week-bulk with a stable Idempotency-Key", () => {
    const src = read("components/week/WeekBulkOrderCard.tsx");
    expect(src).toContain('fetch("/api/orders/week-bulk"');
    expect(src).toContain('"Idempotency-Key": idemKey');
    // Fail-closed shared choice: only categories present on ALL orderable days.
    expect(src).toContain("orderableDays.every((d) => d.categories.some((x) => x.key === c.key))");
    expect(src).not.toContain("day_choices");
  });
});
