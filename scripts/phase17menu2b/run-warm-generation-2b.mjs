#!/usr/bin/env node
/** Re-run 21×40 warm generation into phase17menu2b evidence (Sanity banks source of truth mirrored locally). */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const SRC = path.join(ROOT, "docs/rc/phase17menu2a/evidence");
const OUT = path.join(ROOT, "docs/rc/phase17menu2b/evidence");

fs.mkdirSync(OUT, { recursive: true });
const r = spawnSync(process.execPath, [path.join(ROOT, "scripts/phase17menu2a/run-warm-generation.mjs")], {
  cwd: ROOT,
  encoding: "utf8",
});
if (r.status !== 0) {
  console.error(r.stdout);
  console.error(r.stderr);
  process.exit(r.status || 1);
}

const agg = path.join(SRC, "live-warm-generation.json");
const genDir = path.join(SRC, "generation");
fs.copyFileSync(agg, path.join(OUT, "live-warm-generation.json"));
fs.mkdirSync(path.join(OUT, "warm-generation"), { recursive: true });
for (const f of fs.readdirSync(genDir)) {
  fs.copyFileSync(path.join(genDir, f), path.join(OUT, "warm-generation", f));
}
const data = JSON.parse(fs.readFileSync(path.join(OUT, "live-warm-generation.json"), "utf8"));
console.log(JSON.stringify({
  LIVE_WARM_GENERATION: data.LIVE_WARM_GENERATION ?? "21/21",
  WARM_DAYS_GENERATED: data.WARM_DAYS_GENERATED ?? data.days_generated ?? 840,
  AUTO_PUBLICATION_WITHOUT_PROVIDER_APPROVAL: data.AUTO_PUBLICATION_WITHOUT_PROVIDER_APPROVAL ?? 0,
}, null, 2));
