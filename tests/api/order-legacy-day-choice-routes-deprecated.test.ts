/**
 * Fase G P0: legacy day_choices-only write routes must stay deprecated (410).
 *
 * /api/order/cancel and /api/order/bulk-set wrote day_choices with the service role
 * without going through lp_order_set, risking split-brain vs. orders/production.
 * Canonical write path: POST /api/orders → lp_order_set.
 */
import { describe, test, expect } from "vitest";

describe("legacy day_choices routes are deprecated (fail-closed)", () => {
  test("POST /api/order/cancel returns 410 DEPRECATED", async () => {
    const mod = await import("../../app/api/order/cancel/route");
    const res = await mod.POST();
    expect(res.status).toBe(410);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ok).toBe(false);
    expect(String(body.error)).toBe("DEPRECATED");
    expect(String(body.message)).toContain("/api/orders");
  });

  test("POST /api/order/bulk-set returns 410 DEPRECATED", async () => {
    const mod = await import("../../app/api/order/bulk-set/route");
    const res = await mod.POST();
    expect(res.status).toBe(410);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ok).toBe(false);
    expect(String(body.error)).toBe("DEPRECATED");
    expect(String(body.message)).toContain("/api/orders");
  });

  test("route files do not import supabaseAdmin (no service-role writes left)", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    for (const rel of ["app/api/order/cancel/route.ts", "app/api/order/bulk-set/route.ts"]) {
      const raw = fs.readFileSync(path.join(process.cwd(), rel), "utf8");
      const code = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      expect(code.includes("supabaseAdmin"), `${rel} must not use service role`).toBe(false);
      expect(code.includes("day_choices"), `${rel} must not write day_choices`).toBe(false);
    }
  });
});
