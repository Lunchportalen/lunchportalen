/**
 * Cron auth gate: requireCronAuth throws or returns deterministically.
 * Critical for outbox/cron idempotency and auth denial.
 */
import { describe, test, expect, afterEach } from "vitest";
import { requireCronAuth } from "@/lib/http/cronAuth";

const origSecret = process.env.CRON_SECRET;

function mkReq(init?: { authorization?: string; "x-cron-secret"?: string }) {
  const headers = new Headers();
  if (init?.authorization) headers.set("authorization", init.authorization);
  if (init?.["x-cron-secret"] != null) headers.set("x-cron-secret", init["x-cron-secret"]);
  return new Request("http://x/api/cron/outbox", { method: "POST", headers });
}

afterEach(() => {
  if (origSecret !== undefined) process.env.CRON_SECRET = origSecret;
  else delete process.env.CRON_SECRET;
});

describe("requireCronAuth", () => {
  test("throws with code cron_secret_missing when CRON_SECRET is not set", () => {
    delete process.env.CRON_SECRET;
    const req = mkReq({ authorization: "Bearer any" });
    expect(() => requireCronAuth(req)).toThrow();
    try {
      requireCronAuth(req);
    } catch (e: any) {
      expect(e?.code).toBe("cron_secret_missing");
      expect(String(e?.message)).toMatch(/missing|secret/i);
    }
  });

  test("throws forbidden when secret is set but no header", () => {
    process.env.CRON_SECRET = "correct-secret";
    const req = mkReq();
    expect(() => requireCronAuth(req)).toThrow();
    try {
      requireCronAuth(req);
    } catch (e: any) {
      expect(e?.code).toBe("forbidden");
      expect(e?.message).toBe("forbidden");
    }
  });

  test("throws forbidden when Authorization Bearer is wrong", () => {
    process.env.CRON_SECRET = "correct-secret";
    const req = mkReq({ authorization: "Bearer wrong-secret" });
    try {
      requireCronAuth(req);
      expect.fail("should throw");
    } catch (e: any) {
      expect(e?.code).toBe("forbidden");
    }
  });

  test("returns { mode: 'authorization' } when Bearer matches CRON_SECRET", () => {
    process.env.CRON_SECRET = "correct-secret";
    const req = mkReq({ authorization: "Bearer correct-secret" });
    const out = requireCronAuth(req);
    expect(out).toEqual({ mode: "authorization" });
  });

  test("returns { mode: 'x-cron-secret' } when x-cron-secret header matches", () => {
    process.env.CRON_SECRET = "correct-secret";
    const req = mkReq({ "x-cron-secret": "correct-secret" });
    const out = requireCronAuth(req);
    expect(out).toEqual({ mode: "x-cron-secret" });
  });

  test("throws forbidden when x-cron-secret is wrong", () => {
    process.env.CRON_SECRET = "correct-secret";
    const req = mkReq({ "x-cron-secret": "wrong" });
    try {
      requireCronAuth(req);
      expect.fail("should throw");
    } catch (e: any) {
      expect(e?.code).toBe("forbidden");
    }
  });
});
