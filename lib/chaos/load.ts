import "server-only";

import { chaosInject } from "@/lib/chaos/inject";

export type LoadSimResult = {
  requested: number;
  completed: number;
  httpOk: number;
  fetchErrors: number;
  chaosSkips: number;
};

const MAX_CONCURRENT = 80;

/**
 * Simulerer parallell last mot /api/health (server-side). Bruk request-origin som base.
 */
export async function simulateLoad(n: number, origin: string, rid: string): Promise<LoadSimResult> {
  const raw = typeof n === "number" && Number.isFinite(n) ? Math.floor(n) : 100;
  const requested = Math.min(300, Math.max(1, raw));
  const base = String(origin ?? "").replace(/\/$/, "");
  const url = `${base}/api/health`;

  let httpOk = 0;
  let fetchErrors = 0;
  let chaosSkips = 0;

  const runOne = async (i: number): Promise<"chaos" | "ok" | "err"> => {
    try {
      chaosInject(0.05, `${rid}:load:${i}`);
    } catch {
      return "chaos";
    }
    try {
      const res = await fetch(url, {
        method: "GET",
        cache: "no-store",
        headers: { "x-rid": `${rid}_load_${i}` },
      });
      return res.ok ? "ok" : "err";
    } catch (e) {
      console.error("[CHAOS_LOAD_FETCH]", { rid, i, err: e });
      return "err";
    }
  };

  for (let offset = 0; offset < requested; offset += MAX_CONCURRENT) {
    const end = Math.min(offset + MAX_CONCURRENT, requested);
    const batch: Promise<"chaos" | "ok" | "err">[] = [];
    for (let i = offset; i < end; i += 1) {
      batch.push(runOne(i));
    }
    const results = await Promise.all(batch);
    for (const r of results) {
      if (r === "chaos") chaosSkips += 1;
      else if (r === "ok") httpOk += 1;
      else fetchErrors += 1;
    }
  }

  return {
    requested,
    completed: requested,
    httpOk,
    fetchErrors,
    chaosSkips,
  };
}
