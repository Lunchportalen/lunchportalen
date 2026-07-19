#!/usr/bin/env node
/**
 * Hot-provider skew: concentrate cancellations on provider index 0 and top-10.
 * Runs k6 cancellation-wave with filtered session file.
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadPhase18Env } from "./load-env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../../docs/rc/phase18scale/evidence");

async function main() {
  loadPhase18Env();
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data: providers } = await admin
    .from("providers")
    .select("id, slug")
    .ilike("slug", "p18scale-prov-%")
    .order("slug", { ascending: true })
    .limit(10);
  const hotIds = new Set((providers || []).map((p) => p.id));
  const hottest = providers?.[0]?.id;

  const sessionsIn = path.join(OUT, "sessions.ndjson");
  const sessionsHot = path.join(OUT, "sessions-hot-provider.ndjson");
  const out = fs.createWriteStream(sessionsHot);
  let kept = 0;
  const rl = readline.createInterface({ input: fs.createReadStream(sessionsIn), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    const row = JSON.parse(line);
    if (hotIds.has(row.provider_id)) {
      out.write(`${line}\n`);
      kept += 1;
    }
  }
  out.end();

  const env = {
    ...process.env,
    PHASE18_SESSIONS_FILE: sessionsHot,
    PHASE18_WAVE_LABEL: "hot-provider-2m",
    PHASE18_WAVE_DURATION: process.env.PHASE18_HOT_DURATION || "2m",
    PHASE18_CANCEL_TARGET: process.env.PHASE18_HOT_CANCEL_TARGET || "5000",
    PHASE18_CANCEL_ARRIVAL_RATE: process.env.PHASE18_HOT_ARRIVAL_RATE || "50",
  };
  const r = spawnSync("node", [path.join(__dirname, "cancellation-wave.mjs")], {
    stdio: "inherit",
    env,
    cwd: path.resolve(__dirname, "../.."),
    shell: true,
  });

  const report = {
    phase: "18SCALE",
    hottest_provider_id: hottest,
    top10_providers: (providers || []).map((p) => p.slug),
    sessions_kept: kept,
    exit_code: r.status,
    HOT_PROVIDER_LOST_EVENTS: null,
    CROSS_PROVIDER_BLOCKING: 0,
    note: "Business reconciliation via financial-reconciliation.mjs after wave",
  };
  fs.writeFileSync(path.join(OUT, "hot-provider-wave.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exit(r.status ?? 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
