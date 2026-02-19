// @ts-nocheck
import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("RLS policy: kitchen/driver tenant-bound", () => {
  test("migration contains locked tenant-bound policy", () => {
    const p = path.join(process.cwd(), "supabase", "migrations", "20260216_kitchen_driver_scope_rls.sql");
    const sql = fs.readFileSync(p, "utf8");

    expect(sql).toContain("create policy orders_kitchen_driver_scope_read");
    expect(sql).toContain("p.role in ('kitchen', 'driver')");
    expect(sql).toContain("p.company_id = orders.company_id");
    expect(sql).toContain("p.location_id = orders.location_id");
  });
});
