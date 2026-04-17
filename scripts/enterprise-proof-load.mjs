/**
 * Enterprise proof — enkel lasttest (fetch, ingen ny plattform).
 * Bruk: BASE_URL=http://127.0.0.1:3000 node scripts/enterprise-proof-load.mjs
 */
const BASE = String(process.env.BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const CONCURRENCY = Number(process.env.LOAD_CONCURRENCY || 50);
const DURATION_MS = Number(process.env.LOAD_DURATION_MS || 120_000);
const MIX = String(process.env.LOAD_MIX || "uptime:0.5,health:0.5");

function pickPath() {
  const parts = MIX.split(",").map((x) => x.trim().split(":"));
  const r = Math.random();
  let acc = 0;
  for (const [p, w] of parts) {
    acc += Number(w);
    if (r <= acc) {
      if (p === "health") return "/api/health";
      if (p === "uptime") return "/api/sre/uptime";
    }
  }
  return "/api/sre/uptime";
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

async function main() {
  const latencies = [];
  let ok = 0;
  let fail = 0;
  const errors = [];
  const t0 = Date.now();
  const deadline = t0 + DURATION_MS;

  async function worker() {
    while (Date.now() < deadline) {
      const path = pickPath();
      const url = `${BASE}${path}`;
      const s = performance.now();
      try {
        const res = await fetch(url, { cache: "no-store" });
        const ms = performance.now() - s;
        latencies.push(ms);
        if (res.ok) ok++;
        else {
          fail++;
          if (errors.length < 20) errors.push({ path, status: res.status });
        }
      } catch (e) {
        fail++;
        latencies.push(performance.now() - s);
        if (errors.length < 20) errors.push({ path, error: String(e?.message || e) });
      }
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);

  const total = ok + fail;
  const sorted = [...latencies].sort((a, b) => a - b);
  const avg = sorted.length ? sorted.reduce((a, b) => a + b, 0) / sorted.length : 0;
  const p95 = percentile(sorted, 95);
  const p99 = percentile(sorted, 99);
  const errRate = total ? (fail / total) * 100 : 0;

  const out = {
    base: BASE,
    concurrency: CONCURRENCY,
    durationMs: DURATION_MS,
    mix: MIX,
    totalRequests: total,
    ok,
    fail,
    errorRatePct: Number(errRate.toFixed(4)),
    avgLatencyMs: Number(avg.toFixed(2)),
    p95LatencyMs: Number(p95.toFixed(2)),
    p99LatencyMs: Number(p99.toFixed(2)),
    wallClockMs: Date.now() - t0,
    sampleErrors: errors,
  };
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
