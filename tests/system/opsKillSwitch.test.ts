/**
 * Fase I: operational kill switches (server-side, superadmin-owned system_settings).
 * Verifies: default open, explicit-true blocks, global halt blocks everything,
 * 503 + retry-after for retryable callers, and route wiring for Stripe webhooks.
 */
// @ts-nocheck
import { describe, test, expect, vi, beforeEach } from "vitest";

let killswitchRow: Record<string, boolean> = {};

vi.mock("@/lib/system/settings", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getSystemSettings: vi.fn(async () => actual.withDefaults({ killswitch: killswitchRow })),
  };
});

vi.mock("@/lib/ops/log", () => ({ opsLog: vi.fn() }));

beforeEach(() => {
  killswitchRow = {};
  vi.resetModules();
});

async function loadHelper() {
  return import("@/lib/system/opsKillSwitch");
}

describe("checkOpsKillSwitch", () => {
  test("default settings: everything open", async () => {
    const { checkOpsKillSwitch } = await loadHelper();
    expect(await checkOpsKillSwitch("stripe_webhooks")).toEqual({ killed: false });
    expect(await checkOpsKillSwitch("billing", "cron", "invoice_generation")).toEqual({ killed: false });
  });

  test("explicit true blocks the matching key", async () => {
    killswitchRow = { stripe_webhooks: true };
    const { checkOpsKillSwitch } = await loadHelper();
    expect(await checkOpsKillSwitch("stripe_webhooks")).toEqual({ killed: true, key: "stripe_webhooks" });
    expect(await checkOpsKillSwitch("billing")).toEqual({ killed: false });
  });

  test("global halt blocks all keys", async () => {
    killswitchRow = { global: true };
    const { checkOpsKillSwitch } = await loadHelper();
    expect(await checkOpsKillSwitch("sanity_webhook")).toEqual({ killed: true, key: "global" });
    expect(await checkOpsKillSwitch()).toEqual({ killed: true, key: "global" });
  });

  test("opsKillSwitchResponse returns 503 with retry-after when killed", async () => {
    killswitchRow = { invoice_generation: true };
    const { opsKillSwitchResponse } = await loadHelper();
    const res = await opsKillSwitchResponse("rid_t", "cron", "invoice_generation");
    expect(res).not.toBeNull();
    expect(res.status).toBe(503);
    expect(res.headers.get("retry-after")).toBe("300");
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("KILL_SWITCH");
  });

  test("opsKillSwitchResponse returns null when open", async () => {
    const { opsKillSwitchResponse } = await loadHelper();
    expect(await opsKillSwitchResponse("rid_t", "cron")).toBeNull();
  });
});

describe("route wiring", () => {
  test("stripe payment webhook returns 503 when stripe_webhooks is killed", async () => {
    killswitchRow = { stripe_webhooks: true };
    const mod = await import("../../app/api/webhooks/stripe-billing-payments/route");
    const res = await mod.POST(
      new Request("http://localhost/api/webhooks/stripe-billing-payments", {
        method: "POST",
        headers: { "stripe-signature": "t=1,v1=x" },
        body: "{}",
      }),
    );
    expect(res.status).toBe(503);
  });

  test("invoice generation cron returns 503 when billing is killed (auth still required first)", async () => {
    killswitchRow = { billing: true };
    const orig = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "kill-test-secret";
    try {
      const mod = await import("../../app/api/cron/invoices/generate/route");
      const res = await mod.GET(
        new Request("http://localhost/api/cron/invoices/generate?period=2026-06", {
          method: "GET",
          headers: { authorization: "Bearer kill-test-secret" },
        }),
      );
      expect(res.status).toBe(503);
    } finally {
      if (orig !== undefined) process.env.CRON_SECRET = orig;
      else delete process.env.CRON_SECRET;
    }
  });

  test("sanity webhook returns 503 when sanity_webhook is killed", async () => {
    killswitchRow = { sanity_webhook: true };
    const mod = await import("../../app/api/webhooks/sanity/menu-day/route");
    const res = await mod.POST(
      new Request("http://localhost/api/webhooks/sanity/menu-day", {
        method: "POST",
        body: "{}",
      }),
    );
    expect(res.status).toBe(503);
  });
});
