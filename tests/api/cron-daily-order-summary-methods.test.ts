// Cron entrypoint-fix: Vercel cron kaller cron-paths med GET.
// Verifiserer at daily-order-summary eksporterer GET og POST med samme handler,
// og at cron-secret-kontrakten (403 uten gyldig secret) gjelder begge metoder.

import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { NextRequest } from "next/server";

import { GET, POST } from "@/app/api/cron/daily-order-summary/route";

const URL = "https://app.lunchportalen.no/api/cron/daily-order-summary";

describe("cron daily-order-summary — HTTP-metoder (GET unblock)", () => {
  let prevSecret: string | undefined;

  beforeEach(() => {
    prevSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "test-secret";
  });

  afterEach(() => {
    if (prevSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prevSecret;
  });

  test("GET og POST deler samme handler (identisk logic path)", () => {
    expect(typeof GET).toBe("function");
    expect(typeof POST).toBe("function");
    expect(GET).toBe(POST);
  });

  test("GET uten secret returnerer 403 med låst feilkontrakt", async () => {
    const res = await GET(new NextRequest(URL, { method: "GET" }));
    expect(res.status).toBe(403);

    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("forbidden");
    expect(String(body.rid ?? "")).toContain("cron_daily_order_summary");
  });

  test("POST uten secret returnerer 403 med samme kontrakt som før", async () => {
    const res = await POST(new NextRequest(URL, { method: "POST" }));
    expect(res.status).toBe(403);

    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("forbidden");
  });
});
