/**
 * CRON-001 / D2: every cron route must be fail-closed.
 *
 * Static invariants (source scan):
 * - every app/api/cron/** route file calls requireCronAuth (shared gate)
 * - no route re-implements its own x-vercel-cron check
 *
 * Runtime invariant (representative routes):
 * - request without secret headers is rejected even with x-vercel-cron: 1
 */
// @ts-nocheck
import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CRON_ROOT = path.join(ROOT, "app", "api", "cron");

function walkRouteFiles(dir: string, acc: string[] = []): string[] {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walkRouteFiles(full, acc);
    else if (ent.name === "route.ts") acc.push(full);
  }
  return acc;
}

describe("cron routes are fail-closed (CRON-001)", () => {
  const cronFiles = walkRouteFiles(CRON_ROOT);

  test("cron route inventory is non-empty", () => {
    expect(cronFiles.length).toBeGreaterThan(10);
  });

  test("every cron route calls requireCronAuth", () => {
    const missing: string[] = [];
    for (const file of cronFiles) {
      const src = fs.readFileSync(file, "utf8");
      if (!/requireCronAuth/.test(src)) missing.push(path.relative(ROOT, file));
    }
    expect(missing).toEqual([]);
  });

  test("no cron route implements its own x-vercel-cron trust", () => {
    const offenders: string[] = [];
    for (const file of cronFiles) {
      const src = fs.readFileSync(file, "utf8");
      if (/x-vercel-cron/.test(src)) offenders.push(path.relative(ROOT, file));
    }
    expect(offenders).toEqual([]);
  });

  test("shared gate rejects x-vercel-cron without secret (runtime)", async () => {
    const { requireCronAuth } = await import("@/lib/http/cronAuth");
    const orig = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;
    try {
      const req = new Request("http://x/api/cron/invoices/generate", {
        method: "GET",
        headers: { "x-vercel-cron": "1" },
      });
      expect(() => requireCronAuth(req)).toThrow();
    } finally {
      if (orig !== undefined) process.env.CRON_SECRET = orig;
    }
  });

  test("invoice generation route rejects unauthenticated cron call with error status", async () => {
    const orig = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "test-secret-for-cron-gate";
    try {
      const mod = await import("../../app/api/cron/invoices/generate/route");
      const res = await mod.GET(
        new Request("http://localhost/api/cron/invoices/generate?period=2026-06", {
          method: "GET",
          headers: { "x-vercel-cron": "1" },
        }),
      );
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.ok).toBe(false);
    } finally {
      if (orig !== undefined) process.env.CRON_SECRET = orig;
      else delete process.env.CRON_SECRET;
    }
  });

  test("invoice generation route returns 500 CRON_SECRET_MISSING when secret is absent", async () => {
    const orig = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;
    try {
      const mod = await import("../../app/api/cron/invoices/generate/route");
      const res = await mod.GET(
        new Request("http://localhost/api/cron/invoices/generate?period=2026-06", {
          method: "GET",
          headers: { authorization: "Bearer anything" },
        }),
      );
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.ok).toBe(false);
      expect(String(body.error)).toMatch(/CRON_SECRET_MISSING/i);
    } finally {
      if (orig !== undefined) process.env.CRON_SECRET = orig;
    }
  });
});
