// @ts-nocheck
// Fail-closed guard for /api/cron/meal-learning:
// - cron-auth beholdes uendret (401 uten secret, 500 ved manglende env)
// - med gyldig auth: kontrollert disabled-respons, ingen side effects
// - ingen Supabase order-lesing, ingen Sanity menuDay-lesing, ingen sanity.patch
// - ruten er ikke planlagt i vercel.json
import fs from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const createSupabaseClientMock = vi.hoisted(() => vi.fn());
const createSanityClientMock = vi.hoisted(() => vi.fn());

vi.mock("@supabase/supabase-js", () => ({
  createClient: createSupabaseClientMock,
}));

vi.mock("@sanity/client", () => ({
  createClient: createSanityClientMock,
}));

import { GET } from "@/app/api/cron/meal-learning/route";

function mkReq(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/cron/meal-learning", { headers }) as any;
}

async function readJson(res: Response) {
  return JSON.parse(await res.text());
}

const ORIGINAL_CRON_SECRET = process.env.CRON_SECRET;

beforeEach(() => {
  createSupabaseClientMock.mockReset();
  createSanityClientMock.mockReset();
  process.env.CRON_SECRET = "test-secret";
});

afterEach(() => {
  if (ORIGINAL_CRON_SECRET === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = ORIGINAL_CRON_SECRET;
});

describe("GET /api/cron/meal-learning fail-closed guard", () => {
  test("uten cron-auth: 401 som før", async () => {
    const res = await GET(mkReq());
    expect(res.status).toBe(401);

    const json = await readJson(res);
    expect(json.ok).toBe(false);
  });

  test("feil secret: 401 som før", async () => {
    const res = await GET(mkReq({ authorization: "Bearer feil-secret" }));
    expect(res.status).toBe(401);
  });

  test("manglende CRON_SECRET i env: 500 som før", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(mkReq({ authorization: "Bearer noe" }));
    expect(res.status).toBe(500);
  });

  test("gyldig auth: disabled/fail-closed med reason provider_safe_learning_model_missing", async () => {
    const res = await GET(mkReq({ authorization: "Bearer test-secret" }));
    expect(res.status).toBe(503);

    const json = await readJson(res);
    expect(json.ok).toBe(false);
    expect(json.disabled).toBe(true);
    expect(json.reason).toBe("provider_safe_learning_model_missing");
    expect(json.rid).toMatch(/^meal_learning_/);
    expect(Array.isArray(json.requirements)).toBe(true);
    expect(json.requirements.length).toBeGreaterThan(0);
  });

  test("ingen side effects: verken Supabase- eller Sanity-klient opprettes (ingen order-read, menuDay-read eller patch)", async () => {
    await GET(mkReq({ authorization: "Bearer test-secret" }));
    await GET(mkReq());

    expect(createSupabaseClientMock).not.toHaveBeenCalled();
    expect(createSanityClientMock).not.toHaveBeenCalled();
  });

  test("ruten er ikke planlagt i vercel.json", () => {
    const vercelJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), "vercel.json"), "utf8"));
    const cronPaths = (vercelJson.crons ?? []).map((c: { path: string }) => c.path);
    expect(cronPaths).not.toContain("/api/cron/meal-learning");
  });
});
