/**
 * Cron auth gate: requireCronAuth throws or returns deterministically.
 * Critical for outbox/cron idempotency and auth denial.
 */
import { describe, test, expect, afterEach } from "vitest";
import { requireCronAuth } from "@/lib/http/cronAuth";

const origSecret = process.env.CRON_SECRET;
const origSystemMotor = process.env.SYSTEM_MOTOR_SECRET;

function mkReq(init?: { authorization?: string; "x-cron-secret"?: string; "x-vercel-cron"?: string }) {
  const headers = new Headers();
  if (init?.authorization) headers.set("authorization", init.authorization);
  if (init?.["x-cron-secret"] != null) headers.set("x-cron-secret", init["x-cron-secret"]);
  if (init?.["x-vercel-cron"] != null) headers.set("x-vercel-cron", init["x-vercel-cron"]);
  return new Request("http://x/api/cron/outbox", { method: "POST", headers });
}

afterEach(() => {
  if (origSecret !== undefined) process.env.CRON_SECRET = origSecret;
  else delete process.env.CRON_SECRET;
  if (origSystemMotor !== undefined) process.env.SYSTEM_MOTOR_SECRET = origSystemMotor;
  else delete process.env.SYSTEM_MOTOR_SECRET;
});

describe("requireCronAuth", () => {
  test("throws with code cron_secret_missing when CRON_SECRET is not set and not a Vercel cron request", () => {
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

  // CRON-001: x-vercel-cron alone is never proof. Fail closed without secret.
  test("rejects x-vercel-cron: 1 when CRON_SECRET is unset (fail-closed)", () => {
    delete process.env.CRON_SECRET;
    const req = mkReq({ "x-vercel-cron": "1" });
    expect(() => requireCronAuth(req)).toThrow();
    try {
      requireCronAuth(req);
    } catch (e: any) {
      expect(e?.code).toBe("cron_secret_missing");
    }
  });

  test("rejects x-vercel-cron with wrong Bearer even when secret is set", () => {
    process.env.CRON_SECRET = "correct-secret";
    const req = mkReq({ authorization: "Bearer wrong-secret", "x-vercel-cron": "1" });
    expect(() => requireCronAuth(req)).toThrow();
    try {
      requireCronAuth(req);
    } catch (e: any) {
      expect(e?.code).toBe("forbidden");
    }
  });

  test("rejects x-vercel-cron without any secret header even when secret is set", () => {
    process.env.CRON_SECRET = "correct-secret";
    const req = mkReq({ "x-vercel-cron": "1" });
    expect(() => requireCronAuth(req)).toThrow();
    try {
      requireCronAuth(req);
    } catch (e: any) {
      expect(e?.code).toBe("forbidden");
    }
  });

  test("tags mode vercel-cron when x-vercel-cron AND correct Bearer are present", () => {
    process.env.CRON_SECRET = "correct-secret";
    const req = mkReq({ authorization: "Bearer correct-secret", "x-vercel-cron": "1" });
    expect(requireCronAuth(req)).toEqual({ mode: "vercel-cron" });
  });

  test("SYSTEM_MOTOR routes: rejects x-vercel-cron without SYSTEM_MOTOR_SECRET (fail-closed)", () => {
    delete process.env.SYSTEM_MOTOR_SECRET;
    const req = mkReq({ "x-vercel-cron": "1" });
    expect(() =>
      requireCronAuth(req, { secretEnvVar: "SYSTEM_MOTOR_SECRET", missingCode: "system_motor_secret_missing" }),
    ).toThrow();
    try {
      requireCronAuth(req, { secretEnvVar: "SYSTEM_MOTOR_SECRET", missingCode: "system_motor_secret_missing" });
    } catch (e: any) {
      expect(e?.code).toBe("system_motor_secret_missing");
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
