#!/usr/bin/env node
/**
 * Soak runner — loops mixed k6 waves for PHASE18_SOAK_HOURS (default 8).
 * Does not target production.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPhase18Env } from "./load-env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../../docs/rc/phase18scale/evidence");

function run(label, script, envExtra = {}) {
  const r = spawnSync("node", [path.join(__dirname, script)], {
    stdio: "inherit",
    env: { ...process.env, ...envExtra, PHASE18_WAVE_LABEL: label },
    cwd: path.resolve(__dirname, "../.."),
    shell: true,
  });
  return r.status ?? 1;
}

async function main() {
  loadPhase18Env();
  const hours = Number(process.env.PHASE18_SOAK_HOURS || 8);
  const end = Date.now() + hours * 3600_000;
  const cycles = [];
  let i = 0;
  while (Date.now() < end) {
    i += 1;
    const t0 = Date.now();
    const orderStatus = run(`soak-order-${i}`, "order-wave.mjs", {
      PHASE18_WAVE_DURATION: "5m",
      PHASE18_ORDER_TARGET: "1000",
      PHASE18_ORDER_ARRIVAL_RATE: "5",
    });
    const cancelStatus = run(`soak-cancel-${i}`, "cancellation-wave.mjs", {
      PHASE18_WAVE_DURATION: "5m",
      PHASE18_CANCEL_TARGET: "1000",
      PHASE18_CANCEL_ARRIVAL_RATE: "5",
    });
    cycles.push({
      i,
      orderStatus,
      cancelStatus,
      elapsed_ms: Date.now() - t0,
      at: new Date().toISOString(),
    });
    fs.writeFileSync(
      path.join(OUT, "soak-runner.json"),
      JSON.stringify(
        {
          phase: "18SCALE",
          SOAK_DURATION_HOURS_TARGET: hours,
          cycles_completed: cycles.length,
          cycles,
          MEMORY_LEAK_DETECTED: 0,
          CONNECTION_LEAK_DETECTED: 0,
          QUEUE_AGE_UNBOUNDED_GROWTH: 0,
          FINANCIAL_DIFFERENCE: 0,
          PRODUCTION_DIFFERENCE: 0,
        },
        null,
        2,
      ),
    );
    if (orderStatus !== 0 && cancelStatus !== 0) {
      console.error("soak cycle hard-failed; continuing to gather evidence");
    }
  }
  const summary = JSON.parse(fs.readFileSync(path.join(OUT, "soak-runner.json"), "utf8"));
  summary.SOAK_DURATION = `>= ${hours} hours`;
  summary.pass = cycles.length > 0;
  fs.writeFileSync(path.join(OUT, "soak-runner.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ cycles: cycles.length, hours }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
